"""
AI-First Analyzer Module  v4.0  (Production-Grade)
===================================================
AI (LLM) is the PRIMARY engine for all analysis, reasoning, and predictions.
Regex patterns are ONLY used as a fast pre-filter to supply context to the AI.

New in v4.0:
  - Schema validation + retry via validator.py
  - Per-session memory via memory.py (rolling window context, findings store)
  - Strict JSON enforcement in all prompts (anti-hallucination)
  - Timeline-aware chunk analysis (each chunk sees prior context)
  - Output normalization and finding deduplication on every response

  Endpoints:
    analyze_with_ai, analyze_chunk_with_ai, chat_with_ai,
    predict_threats_ai, correlate_logs_ai
"""

import os
import re
import json
import logging
import requests
from typing import Optional

from validator import (
    validate_and_normalize,
    validate_chunk_result,
    normalize_findings,
    retry_with_validation,
    STRICT_JSON_SUFFIX,
)
from memory import (
    get_session,
    update_session,
    add_chat_message,
    get_chat_history,
    build_context_summary,
    clear_session,
)

logger = logging.getLogger(__name__)

# ─── Structured Output Schema ─────────────────────────────────────────────────
# This is the contract every AI call must return.
EMPTY_RESULT = {
    "findings": [],
    "root_cause": "",
    "predictions": [],
    "fix_suggestions": [],
    "anomalies": [],
    "risk_score": 0,
    "confidence": 0.0,
    "mode": "ai",
}

# ─── Minimal Regex Pre-Filter (context for AI only, NOT final source) ─────────
# These patterns are NOT detections — they inform the AI prompt with structured
# hints so the AI can reason faster and more accurately.
_PREFILTER = [
    (r"(?:password|passwd|pwd|pass)\s*[:=]\s*\S+", "possible_credential"),
    (r"AKIA[0-9A-Z]{16}", "aws_access_key"),
    (r"sk-[A-Za-z0-9]{32,}", "openai_key"),
    (r"AIza[A-Za-z0-9_\-]{35}", "google_api_key"),
    (r"eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+", "jwt_token"),
    (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "private_key"),
    (r"(?:mysql|postgresql|postgres|mongodb|redis)://[^\s'\"]+", "db_connection"),
    (r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b", "credit_card"),
    (r"\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b", "ssn"),
    (r"(?:UNION\s+SELECT|DROP\s+TABLE|OR\s+\d+\s*=\s*\d+)", "sql_injection"),
    (r"\.\./|%2e%2e%2f", "path_traversal"),
    (r"login\s+failed|authentication\s+failed|invalid\s+(?:credentials?|password)", "auth_failure"),
    (r"<script[^>]*>|javascript:|onerror=|onload=", "xss_attempt"),
    (r"HTTP\s+(?:500|502|503|504)|Internal Server Error|Unhandled Exception|FATAL", "server_error"),
    (r"at\s+[\w$.]+\s*\(.*:\d+:\d+\)|Traceback \(most recent call last\)", "stack_trace"),
]


def _regex_prefilter(content: str) -> list:
    """Fast regex pre-scan to supply context hints to AI. NOT a detection engine."""
    hits = []
    for pattern, label in _PREFILTER:
        matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
        if matches:
            first_match = str(matches[0])
            hits.append({
                "hint": label,
                "count": len(matches),
                "sample": "".join(ch for i, ch in enumerate(first_match) if i < 100) if len(first_match) > 0 else ""
            })
    return hits


# ─── LLM Dispatch ─────────────────────────────────────────────────────────────

def _call_llm(prompt: str, max_tokens: int = 2048) -> str:
    """
    Unified LLM dispatcher.
    Strategy: Gemini PRIMARY → OpenRouter FALLBACK (automatic, no manual switching needed).
    If Gemini succeeds → use it. If Gemini fails for any reason (rate limit, error) → OpenRouter.
    """
    # ── Step 1: Try Gemini (primary) ──────────────────────────────────────────
    gemini_error_msg = ""
    try:
        result = _call_gemini(prompt, max_tokens)
        return result
    except Exception as gemini_err:
        gemini_error_msg = str(gemini_err)
        logger.warning(f"Gemini failed → switching to OpenRouter fallback. ({gemini_error_msg})")

    # ── Step 2: OpenRouter fallback (google/gemma-3n-e4b-it:free confirmed working) ──
    try:
        result = _call_openrouter(prompt, max_tokens)
        return result
    except Exception as or_err:
        raise RuntimeError(
            f"All LLM backends failed.\n"
            f"  Gemini: {gemini_error_msg}\n"
            f"  OpenRouter: {or_err}\n"
            f"  Check GEMINI_API_KEY and OPENROUTER_API_KEY in ai-service/.env"
        )



def _parse_json_response(raw_text: str) -> dict:
    """
    Parse LLM JSON response robustly.
    Tries multiple strategies to handle:
    - Markdown code fences (```json ... ```)
    - Conversational wrapping ("Here is the JSON: {...}")
    - Minor syntax issues from smaller models
    """
    text = raw_text.strip()

    # Strategy 1: Strip markdown code fences and try direct parse
    clean = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    clean = re.sub(r"\s*```\s*$", "", clean, flags=re.MULTILINE)
    clean = clean.strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Find the first complete JSON object (handles conversational wrapping)
    match = re.search(r"\{[\s\S]*\}", clean)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # Strategy 3: Find the LARGEST JSON block (in case model outputs multiple objects)
    all_matches = list(re.finditer(r"\{[\s\S]*?\}", clean))
    for m in sorted(all_matches, key=lambda x: len(x.group(0)), reverse=True):
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            continue

    # All strategies failed
    error_prefix = "".join(ch for i, ch in enumerate(raw_text) if i < 200)
    raise json.JSONDecodeError(f"No valid JSON found in LLM response (first 200 chars): {error_prefix}", raw_text, 0)


# Gemini models — ordered best-to-fallback (all confirmed available on this key)
_GEMINI_MODELS = [
    "gemini-2.5-flash",      # Gemini 2.5 Flash — best reasoning
    "gemini-2.5-flash-lite", # Gemini 2.5 Flash Lite
    "gemma-3-27b-it",        # Gemma 3 27B
]


def _call_gemini(prompt: str, max_tokens: int = 2048) -> str:
    """Call Gemini API. Tries primary model first, then falls back through _GEMINI_MODELS."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    model_name = os.getenv("GEMINI_MODEL", _GEMINI_MODELS[0])
    # Safety settings to prevent empty responses during log analysis
    safety_settings = [
        {"category": f"HARM_CATEGORY_{cat}", "threshold": "BLOCK_NONE"}
        for cat in ["HARASSMENT", "HATE_SPEECH", "SEXUALLY_EXPLICIT", "DANGEROUS_CONTENT"]
    ]

    # Try primary model first, then all fallbacks
    models_to_try = [model_name] + [m for m in _GEMINI_MODELS if m != model_name]
    last_err = None
    for model in models_to_try:
        gen_config = {
            "temperature": 0.2, 
            "maxOutputTokens": max_tokens
        }

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": gen_config,
            "safetySettings": safety_settings,
        }
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            resp = requests.post(url, json=payload, timeout=45)
            if resp.status_code == 200:
                logger.info(f"Gemini OK [{model}]")
                data = resp.json()
                
                # Double check for candidates
                if not data.get("candidates") or not data["candidates"][0].get("content"):
                    reason = data.get("promptFeedback", {}).get("blockReason", "REASON_UNKNOWN")
                    logger.warning(f"Gemini [{model}] blocked/empty: {reason}")
                    last_err = f"Blocked/Empty: {reason}"
                    continue
                    
                return data["candidates"][0]["content"]["parts"][0]["text"]
            last_err = f"HTTP {resp.status_code}"
            logger.warning(f"Gemini [{model}] → {resp.status_code}, trying next")
        except Exception as e:
            last_err = str(e)
            logger.warning(f"Gemini [{model}] error: {e}")

    raise RuntimeError(f"All Gemini models failed. Last error: {last_err}")


def _call_openrouter(prompt: str, max_tokens: int = 2048) -> str:
    """Call OpenRouter API (confirmed working: google/gemma-3n-e4b-it:free)."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not set")
    model = os.getenv("OPENROUTER_MODEL", "google/gemma-3n-e4b-it:free")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "AI Secure Data Intelligence Platform",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a senior cybersecurity analyst AI. Always respond with valid JSON only, no markdown, no explanation outside the JSON."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    resp = requests.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=45)
    resp.raise_for_status()
    logger.info(f"OpenRouter OK [{model}]")
    return resp.json()["choices"][0]["message"]["content"]




# ─── Primary: Full Document AI Analysis ───────────────────────────────────────

def analyze_with_ai(content: str, context: Optional[dict] = None, session_id: Optional[str] = None) -> dict:
    """
    AI-first full document analysis.
    Returns the full structured schema:
      {findings, root_cause, predictions, fix_suggestions, anomalies, risk_score, confidence}
    """
    context = context or {}
    hints = _regex_prefilter(content)
    hints_text = json.dumps(hints, indent=2) if hints else "None detected by pre-filter"
    excerpt = "".join(ch for i, ch in enumerate(content) if i < 3000)

    # Inject memory context if available
    memory_context = build_context_summary(session_id) if session_id else ""
    if memory_context:
        memory_context = f"\n\nSESSION MEMORY (Use this to inform context):\n{memory_context}\n"

    prompt = f"""You are a senior AI cybersecurity analyst and threat intelligence expert.

Analyze the following content (log, code, config, or text) for ALL security issues.

REGEX PRE-FILTER HINTS (use these as starting context, but reason beyond them):
{hints_text}{memory_context}

CONTENT TO ANALYZE (first 3000 chars):
{excerpt}

CONTEXT: {json.dumps(context)}

Your task:
1. Detect ALL sensitive data, credentials, PII, attack patterns, anomalies, and misconfigurations
2. Explain the ROOT CAUSE of each finding (why did this happen, what system behavior caused it)
3. Predict FUTURE RISKS: what is likely to happen next if unaddressed
4. Provide SPECIFIC, CODE-LEVEL fix suggestions
5. Identify ANOMALIES (unusual patterns, statistical outliers, behavioral irregularities)
6. Score overall risk (0-10) and your confidence in the assessment (0.0-1.0)

IMPORTANT: Think like a human security expert, not a pattern matcher.
Consider context, severity, exploitability, and chained attack potential.

Respond ONLY with this exact JSON structure (no markdown, no extra text):
{{
  "findings": [
    {{
      "type": "string (e.g. api_key, sql_injection, brute_force...)",
      "risk": "critical|high|medium|low",
      "score": 0,
      "line": null,
      "description": "string - specific description of what was found",
      "match_hint": "string - brief sanitized reference"
    }}
  ],
  "root_cause": "string - 2-4 sentences explaining why these issues exist",
  "predictions": [
    {{
      "threat": "string - specific predicted next attack",
      "likelihood": "high|medium|low",
      "timeframe": "string",
      "explanation": "string"
    }}
  ],
  "fix_suggestions": [
    {{
      "priority": "immediate|short_term|long_term",
      "action": "string",
      "code_example": "string",
      "finding_types": ["string"]
    }}
  ],
  "anomalies": [
    {{
      "type": "string",
      "description": "string",
      "severity": "high|medium|low"
    }}
  ],
  "risk_score": 0,
  "confidence": 0.0
}}"""

    try:
        # Use retry engine with strict JSON injection on failure
        result = retry_with_validation(_call_llm, prompt, max_tokens=2500, max_retries=2)
        result["mode"] = "ai"
        return result
    except Exception as e:
        logger.error(f"AI full analysis failed after retries: {e}. Returning regex fallback.")
        fallback = dict(EMPTY_RESULT)
        fallback["mode"] = "fallback"
        fallback["findings"] = hints if isinstance(hints, list) else []
        fallback_len = len(hints) if isinstance(hints, list) else 0
        fallback["risk_score"] = min(fallback_len * 2, 9)
        fallback["root_cause"] = f"AI service temporarily unavailable ({type(e).__name__}). Showing regex-detected findings only."
        fallback["confidence"] = 0.3
        return fallback



# ─── Chunk Analysis (for real-time streaming) ─────────────────────────────────

def analyze_chunk_with_ai(chunk: str, chunk_index: int, session_id: Optional[str] = None) -> dict:
    """
    AI analysis of a log chunk (subset of lines) with session memory.
    """
    # Fetch memory context instead of taking it as a param
    memory_context = build_context_summary(session_id) if session_id else ""
    if not memory_context:
        memory_context = "No prior session context available."

    prompt = f"""You are an AI security analyst performing REAL-TIME streaming log analysis.

This is chunk #{chunk_index + 1} from an ongoing log stream.

{memory_context}

CURRENT CHUNK CONTENT:
{chunk}

Analyze this chunk for:
1. New security issues (credentials, attacks, anomalies, PII)
2. Whether this chunk ESCALATES risk compared to prior patterns
3. What these events INDICATE about the system's security state
4. Whether a specific attack is in progress

Respond ONLY with this JSON (no markdown):
{{
  "chunk_index": {chunk_index},
  "findings": [
    {{
      "type": "string",
      "risk": "critical|high|medium|low",
      "score": 0,
      "line_in_chunk": null,
      "description": "string",
      "match_hint": "string"
    }}
  ],
  "chunk_risk_level": "critical|high|medium|low|clean",
  "chunk_risk_score": 0,
  "escalation": {{
    "detected": false,
    "explanation": "string - why this chunk escalates or doesn't escalate risk"
  }},
  "anomalies": ["string"],
  "ai_commentary": "string - 1-2 sentence AI observation about this chunk's security significance",
  "new_patterns": ["string - new attack patterns detected"]
}}"""

    try:
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                # We don't use the full strict validate_and_normalize here because chunk schema is different
                # Instead, we do a raw call and manual chunk validation
                raw = _call_llm(prompt, max_tokens=1500)
                m = re.search(r"\{[\s\S]*\}", raw)
                result = json.loads(m.group(0)) if m else json.loads(raw)
                
                result = validate_chunk_result(result, chunk_index)
                result["mode"] = "ai"

                # Update memory!
                if session_id:
                    update_session(session_id, result)

                return result
            except json.JSONDecodeError as decode_err:
                if attempt < max_retries:
                    logger.warning(f"Chunk {chunk_index} JSON decode failed, retrying... ({decode_err})")
                    prompt += f"\n\nCRITICAL FIX REQUIRED: Your previous response was invalid JSON. Error: {decode_err}. Provide ONLY fully valid JSON matching the schema."
                else:
                    raise
        raise RuntimeError("Unreachable")
    except Exception as e:
        logger.error(f"Chunk AI analysis failed (chunk {chunk_index}): {e}")
        str_e = str(e)
        err_trunc = "".join(ch for i, ch in enumerate(str_e) if i < 100)
        return {
            "chunk_index": chunk_index,
            "findings": [],
            "chunk_risk_level": "unknown",
            "chunk_risk_score": 0,
            "escalation": {"detected": False, "explanation": "AI analysis unavailable"},
            "anomalies": [],
            "ai_commentary": f"AI error: {err_trunc}",
            "new_patterns": [],
            "mode": "error",
            "error": str(e),
        }
    return {}


# ─── AI Chat with Conversation Memory ─────────────────────────────────────────

def chat_with_ai(message: str, session_id: Optional[str] = None, analysis_context: Optional[dict] = None) -> dict:
    """
    Context-aware AI security chat powered by session memory.
    """
    analysis_context = analysis_context or {}

    # Update memory with user message
    if session_id:
        add_chat_message(session_id, "user", message)
        history = get_chat_history(session_id, limit=8)
    else:
        history = [{"role": "user", "content": message}]

    # Build conversation history text
    history_text = ""
    for i, item in enumerate(history):
        if i >= len(history) - 1:
            continue
        msg = dict(item)
        role = "User" if msg.get("role") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('content', '')}\n"

    # Inject memory context
    memory_context = build_context_summary(session_id) if session_id else ""

    context_summary = ""
    if analysis_context:
        findings = analysis_context.get("findings", [])
        risk_score = analysis_context.get("risk_score", 0)
        risk_level = analysis_context.get("risk_level", "unknown")
        predictions = analysis_context.get("predictions", [])
        root_cause = analysis_context.get("root_cause", "")
        context_summary = f"""
CURRENT ANALYSIS CONTEXT:
- Risk Score: {risk_score}/10 ({risk_level})
- Total Findings: {len(findings)}
- Top Finding Types: {list(set(f.get("type","?") for f in findings[:10]))}
- Root Cause: {root_cause[:300] if root_cause else "N/A"}
- Predictions: {json.dumps([p.get("threat","") for p in predictions[:3]])}
"""

    prompt = f"""You are an elite AI cybersecurity assistant with deep expertise in threat analysis, incident response, and secure system design.

{memory_context}

You have access to the user's current security analysis results:
{context_summary}

CONVERSATION HISTORY:
{history_text if history_text else "(New conversation)"}

User's new message: {message}

Provide a helpful, specific, expert response. Reference the actual findings and context when relevant.
Be direct and actionable. Use markdown formatting (bold, bullet points) for clarity.
If you don't have enough context, say so and ask for what you need.

Respond ONLY with this JSON (no markdown outside the json):
{{
  "reply": "string - your full markdown-formatted response",
  "confidence": 0.0,
  "referenced_findings": ["string - finding types you referenced in your answer"],
  "follow_up_suggestions": ["string - 2-3 follow_up questions the user might want to ask"]
}}"""

    try:
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                raw = _call_llm(prompt, max_tokens=1500)
                # Robust extraction
                m = re.search(r"\{[\s\S]*\}", raw)
                result = json.loads(m.group(0)) if m else json.loads(raw)
                result["mode"] = "ai"
                
                # Save assistant reply to memory
                if session_id and "reply" in result:
                    add_chat_message(session_id, "assistant", result["reply"])
                    
                return result
            except json.JSONDecodeError as decode_err:
                if attempt < max_retries:
                    logger.warning(f"Chat JSON decode failed, retrying... ({decode_err})")
                    prompt += f"\n\nCRITICAL FIX REQUIRED: Your previous response was invalid JSON. Error: {decode_err}. Provide ONLY fully valid JSON matching the schema."
                else:
                    raise
        raise RuntimeError("Unreachable")
    except Exception as e:
        logger.error(f"AI chat failed: {e}")
        str_e = str(e)
        err_trunc = "".join(ch for i, ch in enumerate(str_e) if i < 50)
        return {
            "reply": f"Sorry, AI chat is temporarily unavailable ({err_trunc}). Please try again.",
            "confidence": 0.0,
            "referenced_findings": [],
            "follow_up_suggestions": ["Can you check the log stream instead?"],
            "mode": "error"
        }
    return {}


# ─── Predictive Threat Analysis ───────────────────────────────────────────────

def predict_threats_ai(findings: list, timeline: Optional[list] = None, context: Optional[dict] = None) -> dict:
    """
    AI-driven predictive threat analysis.
    Given current findings, predict what attacks or risks are LIKELY TO HAPPEN NEXT.
    """
    timeline = timeline or []
    context = context or {}
    findings_summary = json.dumps(
        [{"type": f.get("type"), "risk": f.get("risk"), "description": f.get("description","")} for i, f in enumerate(findings) if i < 20],
        indent=2
    )
    timeline_summary = json.dumps([x for i, x in enumerate(timeline) if i >= len(timeline) - 10], indent=2) if timeline else "[]"

    prompt = f"""You are an AI threat intelligence analyst specializing in predictive security analysis.

CURRENT SECURITY FINDINGS:
{findings_summary}

RECENT TIMELINE:
{timeline_summary}

CONTEXT: {json.dumps(context)}

Based on these findings and patterns, predict:
1. What are the MOST LIKELY next attack steps or risk escalations?
2. What broader attack campaign does this pattern suggest?
3. What systemic vulnerabilities will be exploited next?
4. What is the potential BLAST RADIUS if unaddressed?

Think like an attacker who will chain these findings into a full attack.

Respond ONLY with this JSON:
{{
  "threat_trajectory": "string - overall description of the attack campaign trend",
  "attack_stage": "string - current phase (e.g., 'reconnaissance', 'initial_access', 'lateral_movement', 'exfiltration')",
  "predictions": [
    {{
      "threat": "string - specific predicted next attack or outcome",
      "likelihood": "high|medium|low",
      "timeframe": "string",
      "attack_vector": "string - how the attack would be executed",
      "explanation": "string - the chain of reasoning",
      "mitigations": ["string - 2-3 specific mitigations to prevent this"]
    }}
  ],
  "blast_radius": {{
    "affected_systems": ["string"],
    "potential_data_loss": "string",
    "business_impact": "string"
  }},
  "urgency": "immediate|high|medium|low",
  "confidence": 0.0
}}"""

    try:
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                raw = _call_llm(prompt, max_tokens=1800)
                m = re.search(r"\{[\s\S]*\}", raw)
                result = json.loads(m.group(0)) if m else json.loads(raw)
                result["mode"] = "ai"
                return result
            except json.JSONDecodeError as decode_err:
                if attempt < max_retries:
                    logger.warning(f"Predict JSON decode failed, retrying... ({decode_err})")
                    prompt += f"\n\nCRITICAL FIX REQUIRED: Your previous response was invalid JSON. Error: {decode_err}. Provide ONLY fully valid JSON matching the schema."
                else:
                    raise
        raise RuntimeError("Unreachable")
    except Exception as e:
        logger.error(f"Predictive threat AI failed: {e}")
        str_e = str(e)
        err_trunc = "".join(ch for i, ch in enumerate(str_e) if i < 50)
        return {
            "threat_trajectory": f"Prediction unavailable: {err_trunc}",
            "attack_stage": "unknown",
            "predictions": [],
            "blast_radius": {"affected_systems": [], "potential_data_loss": "unknown", "business_impact": "unknown"},
            "urgency": "low",
            "confidence": 0.0,
            "mode": "error"
        }
    return {}


# ─── Cross-Log AI Correlation ─────────────────────────────────────────────────

def correlate_logs_ai(logs_context: dict) -> dict:
    """
    AI-driven cross-log correlation.
    Finds connections between findings across multiple log sources, time windows,
    and user sessions that suggest coordinated attacks.
    """
    logs_str = json.dumps(logs_context, indent=2)
    logs_trunc = "".join(ch for i, ch in enumerate(logs_str) if i < 3000)
    prompt = f"""You are an AI security correlation analyst specializing in finding hidden connections in security events.

MULTI-SOURCE LOG CONTEXT:
{logs_trunc}

Perform deep correlation analysis:
1. Find events that are CAUSALLY LINKED across time and sources
2. Identify COORDINATED attack patterns (same actor, different vectors)
3. Detect LATERAL MOVEMENT indicators (pivot points between systems)
4. Find DATA EXFILTRATION patterns (unusual data access + outbound activity)
5. Identify AUTHENTICATION ANOMALIES across user sessions

Respond ONLY with this JSON:
{{
  "correlations": [
    {{
      "correlation_id": "string",
      "type": "string (e.g. coordinated_attack, lateral_movement, data_exfiltration)",
      "confidence": 0.0,
      "events": ["string - description of correlated events"],
      "time_window": "string",
      "explanation": "string - AI reasoning for this correlation"
    }}
  ],
  "attack_chain": "string - narrative description of the full attack chain AI has reconstructed",
  "threat_actor_profile": {{
    "sophistication": "nation_state|organized_crime|script_kiddie|insider|unknown",
    "objectives": ["string"],
    "ttps": ["string - MITRE ATT&CK-style TTPs observed"]
  }},
  "summary": "string - 2-3 sentence correlation summary"
}}"""

    try:
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                raw = _call_llm(prompt, max_tokens=1800)
                m = re.search(r"\{[\s\S]*\}", raw)
                result = json.loads(m.group(0)) if m else json.loads(raw)
                result["mode"] = "ai"
                return result
            except json.JSONDecodeError as decode_err:
                if attempt < max_retries:
                    logger.warning(f"Correlation JSON decode failed, retrying... ({decode_err})")
                    prompt += f"\n\nCRITICAL FIX REQUIRED: Your previous response was invalid JSON. Error: {decode_err}. Provide ONLY fully valid JSON matching the schema."
                else:
                    raise
    except Exception as e:
        logger.error(f"AI correlation failed: {e}")
        str_e = str(e)
        err_trunc = "".join(ch for i, ch in enumerate(str_e) if i < 50)
        return {
            "correlations": [],
            "attack_chain": f"Correlation unavailable: {err_trunc}",
            "threat_actor_profile": {
                "sophistication": "unknown",
                "objectives": [],
                "ttps": []
            },
            "summary": "AI reasoning unavailable",
            "mode": "error"
        }
    return {}


# ─── Legacy Bridge (kept for backward compatibility from old analyze route) ────

def run_analysis(content: str, findings: list, stats: dict, input_type: str) -> dict:
    """Legacy bridge — now calls AI-first analysis internally."""
    try:
        result = analyze_with_ai(content, {"input_type": input_type, "stats": stats})
        return {
            "summary": result.get("root_cause", ""),
            "insights": [s.get("action", "") for s in result.get("fix_suggestions", [])],
            "anomalyScore": result.get("risk_score", 0),
            "patternHits": {},
            "mode": result.get("mode", "ai"),
            **result,
        }
    except Exception as e:
        logger.warning(f"AI analysis failed in legacy bridge, returning minimal result: {e}")
        return {
            "summary": "AI analysis temporarily unavailable.",
            "insights": ["Check API key configuration and retry."],
            "anomalyScore": 0,
            "patternHits": {},
            "mode": "error",
        }


def generate_insights_with_llm(content, findings, risk_level, risk_score, rule_result) -> dict:
    """Legacy bridge — kept for backward compat."""
    try:
        result = analyze_with_ai(content, {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "prior_findings_count": len(findings),
        })
        return {
            "summary": result.get("root_cause", rule_result.get("summary", "")),
            "insights": [s.get("action", "") for s in result.get("fix_suggestions", [])],
            "anomalyScore": result.get("risk_score", 0),
            "patternHits": rule_result.get("patternHits", {}),
            "mode": result.get("mode", "ai"),
            "llmRawResponse": json.dumps(result),
        }
    except Exception as e:
        logger.error(f"LLM insights failed: {e}")
        return rule_result
