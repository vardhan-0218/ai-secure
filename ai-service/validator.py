"""
AI Output Validator & Retry Engine  v1.0
=========================================
Validates every AI response against the strict schema before it reaches the
caller.  If validation fails the prompt is retried with a stricter JSON hint.

Public API:
  validate_and_normalize(result)   → cleaned result dict or raises ValueError
  retry_with_validation(fn, *args, max_retries=2, **kwargs) → validated result
  normalize_findings(findings)     → deduplicated, normalised finding list
"""

import json
import logging
import time
from typing import Any, Callable

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

VALID_RISK_LABELS   = {"critical", "high", "medium", "low", "info"}
VALID_PRIORITY      = {"immediate", "short_term", "long_term"}
VALID_LIKELIHOOD    = {"high", "medium", "low"}

# Required top-level keys and their default values
REQUIRED_SCHEMA = {
    "findings":        [],
    "root_cause":      "",
    "predictions":     [],
    "fix_suggestions": [],
    "anomalies":       [],
    "risk_score":      0,
    "confidence":      0.0,
    "summary":         "",
}

# Strict JSON reminder appended to prompt on retry
STRICT_JSON_SUFFIX = """

⚠️  CRITICAL INSTRUCTION:
You MUST return ONLY valid JSON — no explanations, no markdown, no prose outside the JSON object.
Every field must be present. risk_score must be an integer 0-10. confidence must be a float 0.0-1.0.
Base ALL conclusions strictly on the provided content.  If uncertain, lower the confidence score.
Do NOT hallucinate findings not present in the content.
"""

# ── Schema Validator ─────────────────────────────────────────────────────────

def _clamp(value: Any, lo: float, hi: float, default: float) -> float:
    """Clamp a numeric value to [lo, hi], using default if not numeric."""
    try:
        v = float(value)
        return max(lo, min(hi, v))
    except (TypeError, ValueError):
        return default


def validate_and_normalize(result: dict) -> dict:
    """
    Validate and clean an AI output dict.
    - Fills missing required keys with defaults.
    - Clamps risk_score to [0,10] and confidence to [0.0,1.0].
    - Normalises finding risk labels.
    - Deduplicates findings.
    Raises ValueError only on catastrophic structure (e.g. result is not a dict).
    """
    if not isinstance(result, dict):
        raise ValueError(f"AI output is not a dict, got {type(result)}")

    # Fill missing keys
    for key, default in REQUIRED_SCHEMA.items():
        if key not in result:
            result[key] = default
            logger.debug(f"Validator: filled missing key '{key}' with default")

    # Enforce numeric ranges
    result["risk_score"] = int(_clamp(result.get("risk_score", 0), 0, 10, 0))
    clamped_conf = _clamp(result.get("confidence", 0.5), 0.0, 1.0, 0.5)
    result["confidence"] = int(clamped_conf * 100) / 100.0

    # Normalise findings
    result["findings"] = normalize_findings(result.get("findings", []))

    # Normalise predictions
    preds = result.get("predictions", [])
    clean_preds = []
    for p in preds:
        if isinstance(p, dict):
            p["likelihood"] = p.get("likelihood", "medium")
            if p["likelihood"] not in VALID_LIKELIHOOD:
                p["likelihood"] = "medium"
            clean_preds.append(p)
    result["predictions"] = clean_preds

    # Normalise fix_suggestions
    fixes = result.get("fix_suggestions", [])
    clean_fixes = []
    for f in fixes:
        if isinstance(f, dict):
            f["priority"] = f.get("priority", "short_term")
            if f["priority"] not in VALID_PRIORITY:
                f["priority"] = "short_term"
            clean_fixes.append(f)
    result["fix_suggestions"] = clean_fixes

    # Ensure summary and root_cause are strings
    result["summary"]    = str(result.get("summary", ""))
    result["root_cause"] = str(result.get("root_cause", ""))

    return result


def normalize_findings(findings: list) -> list:
    """
    Deduplicate and normalise finding list:
    - Force valid risk labels
    - Clamp finding-level score
    - Remove exact-duplicate descriptions
    - Merge findings of the same type with identical match_hint
    """
    if not isinstance(findings, list):
        return []

    seen: set = set()
    result: list = []

    for f in findings:
        if not isinstance(f, dict):
            continue

        # Normalise risk label
        risk = str(f.get("risk", "medium")).lower()
        if risk not in VALID_RISK_LABELS:
            risk = "medium"
        f["risk"] = risk

        # Clamp score
        f["score"] = int(_clamp(f.get("score", 0), 0, 10, 0))

        # Ensure required finding fields
        f.setdefault("type", "unknown")
        f.setdefault("description", "")
        f.setdefault("match_hint", "")
        f.setdefault("line", None)

        # Deduplicate by (type, match_hint)
        dedup_key = (f["type"], f["match_hint"][:80])
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        result.append(f)

    # Sort: critical → high → medium → low → info
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    result.sort(key=lambda x: order.get(x.get("risk", "medium"), 2))

    return result


# ── Retry Engine ─────────────────────────────────────────────────────────────

def retry_with_validation(
    fn: Callable,
    *args,
    max_retries: int = 2,
    retry_delay: float = 1.5,
    **kwargs
) -> dict:
    """
    Call fn(*args, **kwargs), validate the result.
    On validation failure, inject STRICT_JSON_SUFFIX into the prompt and retry.

    fn must accept positional args where the FIRST arg is the prompt string
    (or the first kwarg named 'prompt').
    Returns a validated, normalized dict.
    Raises RuntimeError after max_retries exhausted.
    """
    last_error = None

    for attempt in range(max_retries + 1):
        try:
            # On retry, inject strict JSON reminder into the prompt
            current_args = list(args)
            if attempt > 0 and current_args:
                original_prompt = current_args[0]
                current_args[0] = original_prompt + STRICT_JSON_SUFFIX
                logger.warning(f"Retry {attempt}/{max_retries}: injecting strict JSON hint")
                time.sleep(retry_delay)

            raw_result = fn(*current_args, **kwargs)

            # If raw_result is a string, parse it
            if isinstance(raw_result, str):
                try:
                    raw_result = json.loads(raw_result)
                except json.JSONDecodeError as je:
                    raise ValueError(f"Failed to parse JSON: {je}")

            validated = validate_and_normalize(raw_result)
            if attempt > 0:
                logger.info(f"Validation succeeded on attempt {attempt + 1}")
            return validated

        except Exception as e:
            last_error = e
            logger.warning(f"Attempt {attempt + 1}/{max_retries + 1} failed: {e}")
            if attempt == max_retries:
                break

    raise RuntimeError(
        f"AI call failed after {max_retries + 1} attempts. Last error: {last_error}"
    )


# ── Chunk-Specific Validator ─────────────────────────────────────────────────

CHUNK_SCHEMA = {
    "chunk_index":       0,
    "findings":          [],
    "chunk_risk_level":  "clean",
    "chunk_risk_score":  0,
    "escalation":        {"detected": False, "explanation": ""},
    "anomalies":         [],
    "ai_commentary":     "",
    "new_patterns":      [],
}

VALID_CHUNK_RISK = {"clean", "low", "medium", "high", "critical"}


def validate_chunk_result(result: dict, chunk_index: int) -> dict:
    """Validate and normalize a chunk analysis result."""
    if not isinstance(result, dict):
        result = {}
    
    res = dict(result) # Explicit cast for Pyre inferece

    for key, default in CHUNK_SCHEMA.items():
        if key not in res:
            res[key] = default

    res["chunk_index"] = chunk_index
    res["chunk_risk_score"] = int(_clamp(res.get("chunk_risk_score", 0), 0, 10, 0))

    risk_level = str(res.get("chunk_risk_level", "clean")).lower()
    res["chunk_risk_level"] = risk_level if risk_level in VALID_CHUNK_RISK else "medium"

    res["findings"] = normalize_findings(res.get("findings", []))

    esc = res.get("escalation", {})
    if not isinstance(esc, dict):
        esc = {}
    esc.setdefault("detected", False)
    esc.setdefault("explanation", "")
    res["escalation"] = esc

    res["ai_commentary"] = str(res.get("ai_commentary", ""))
    res["new_patterns"]  = res.get("new_patterns", []) if isinstance(res.get("new_patterns"), list) else []

    return res
