"""
AI Session Memory Engine  v1.0
================================
Maintains per-session rolling context for the AI service.

A session lives for SESSION_TTL_SECONDS (default 30 min) of inactivity.
It stores:
  - cumulative findings across all chunks
  - rolling risk timeline (one entry per chunk)
  - patterns seen so far (for anomaly context)
  - compressed rolling window of last N chunk summaries
  - chat history (last 20 messages)

Public API:
  get_session(session_id)                      → dict
  update_session(session_id, chunk_result)     → None
  add_chat_message(session_id, role, content)  → None
  get_chat_history(session_id, limit=10)       → list
  build_context_summary(session_id)            → str  (for prompt injection)
  clear_session(session_id)                    → None
  list_sessions()                              → list[str]
  cleanup_expired()                            → int  (number purged)
"""

import time
import logging
import threading
from typing import Optional, Any

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SESSION_TTL_SECONDS  = 1800   # 30 minutes of inactivity
MAX_WINDOW_SIZE      = 10     # Keep last N chunk summaries in rolling window
MAX_FINDINGS_STORED  = 100    # Cap total findings per session
MAX_CHAT_HISTORY     = 20     # Cap chat turns per session

# ── Storage ───────────────────────────────────────────────────────────────────

_store: dict[str, Any] = {}     # session_id → SessionData
_lock = threading.RLock()       # Thread-safe access


def _now() -> float:
    return time.time()


def _default_session(session_id: str) -> dict:
    return {
        "session_id":      session_id,
        "created_at":      _now(),
        "last_active":     _now(),
        "chunk_count":     0,
        "total_findings":  0,
        "cumulative_risk": 0,          # running max risk_score seen
        "risk_timeline":   [],         # [{"chunk": i, "score": n, "level": "..."}]
        "patterns_seen":   [],         # list of finding types encountered
        "rolling_window":  [],         # last MAX_WINDOW_SIZE chunk summaries
        "findings_store":  [],         # deduplicated cumulative findings
        "chat_history":    [],         # [{"role": "user"|"assistant", "content": "..."}]
    }


# ── Core CRUD ────────────────────────────────────────────────────────────────

def get_session(session_id: str) -> dict:
    """Return session data (creates it if new)."""
    with _lock:
        if session_id not in _store:
            _store[session_id] = _default_session(session_id)
            logger.info(f"Memory: new session '{session_id}'")
        sess = _store[session_id]
        sess["last_active"] = _now()
        return dict(sess)  # return a snapshot copy


def update_session(session_id: str, chunk_result: dict) -> None:
    """
    Update session with results from a processed chunk.
    chunk_result expected keys: findings, chunk_risk_score, chunk_risk_level, ai_commentary, chunk_index, new_patterns
    """
    with _lock:
        if session_id not in _store:
            _store[session_id] = _default_session(session_id)

        sess = _store[session_id]
        sess["last_active"] = _now()
        sess["chunk_count"] += 1

        chunk_idx   = chunk_result.get("chunk_index", sess["chunk_count"] - 1)
        risk_score  = int(chunk_result.get("chunk_risk_score", 0))
        risk_level  = chunk_result.get("chunk_risk_level", "clean")
        commentary  = chunk_result.get("ai_commentary", "")
        new_findings = chunk_result.get("findings", [])
        new_patterns = chunk_result.get("new_patterns", [])

        # Update risk timeline
        sess["risk_timeline"].append({
            "chunk": chunk_idx,
            "score": risk_score,
            "level": risk_level,
        })

        # Track cumulative max risk
        sess["cumulative_risk"] = max(sess["cumulative_risk"], risk_score)

        # Merge new patterns (dedup)
        for p in new_patterns:
            if p and p not in sess["patterns_seen"]:
                sess["patterns_seen"].append(p)

        # Merge findings (dedup by type + match_hint)
        existing_keys = {
            (f.get("type"), f.get("match_hint", "")[:60])
            for f in sess["findings_store"]
        }
        for f in new_findings:
            key = (f.get("type"), f.get("match_hint", "")[:60])
            if key not in existing_keys:
                sess["findings_store"].append(f)
                existing_keys.add(key)

        # Cap findings store
        if len(sess["findings_store"]) > MAX_FINDINGS_STORED:
            sess["findings_store"] = sess["findings_store"][-MAX_FINDINGS_STORED:]

        sess["total_findings"] = len(sess["findings_store"])

        # Rolling window — store compressed chunk summary
        window_entry = {
            "chunk":       chunk_idx,
            "risk_level":  risk_level,
            "risk_score":  risk_score,
            "findings":    len(new_findings),
            "commentary":  commentary[:300] if commentary else "",
        }
        sess["rolling_window"].append(window_entry)
        if len(sess["rolling_window"]) > MAX_WINDOW_SIZE:
            sess["rolling_window"] = sess["rolling_window"][-MAX_WINDOW_SIZE:]

        logger.debug(
            f"Memory updated: session={session_id} chunk={chunk_idx} "
            f"findings={len(new_findings)} cumulative_risk={sess['cumulative_risk']}"
        )


def add_chat_message(session_id: str, role: str, content: str) -> None:
    """Append a chat message to the session history."""
    with _lock:
        if session_id not in _store:
            _store[session_id] = _default_session(session_id)
        sess = _store[session_id]
        sess["last_active"] = _now()
        sess["chat_history"].append({"role": role, "content": content})
        # Cap history
        if len(sess["chat_history"]) > MAX_CHAT_HISTORY:
            sess["chat_history"] = sess["chat_history"][-MAX_CHAT_HISTORY:]


def get_chat_history(session_id: str, limit: int = 10) -> list:
    """Return the last `limit` chat messages for the session."""
    with _lock:
        sess = _store.get(session_id)
        if not sess:
            return []
        return list(sess["chat_history"][-limit:])


def clear_session(session_id: str) -> None:
    """Delete a session from memory."""
    with _lock:
        if session_id in _store:
            _store.pop(session_id, None)
            logger.info(f"Memory: cleared session '{session_id}'")


def list_sessions() -> list:
    """Return all active session IDs."""
    with _lock:
        return list(_store.keys())


def cleanup_expired() -> int:
    """Remove sessions inactive longer than SESSION_TTL_SECONDS. Returns count purged."""
    cutoff = _now() - SESSION_TTL_SECONDS
    with _lock:
        expired = [sid for sid, s in _store.items() if s["last_active"] < cutoff]
        for sid in expired:
            _store.pop(sid, None)
    if expired:
        logger.info(f"Memory cleanup: purged {len(expired)} expired sessions")
    return len(expired)


# ── Context Builder (for prompt injection) ────────────────────────────────────

def build_context_summary(session_id: str) -> str:
    """
    Build a compact text summary of the session context for injection into AI prompts.
    Returns an empty string if no session exists.
    """
    with _lock:
        sess = _store.get(session_id)
    if not sess:
        return ""

    window   = sess["rolling_window"]
    patterns = sess["patterns_seen"]
    timeline = sess["risk_timeline"]

    lines = [
        f"SESSION CONTEXT (session_id={session_id}):",
        f"  Chunks processed so far: {sess['chunk_count']}",
        f"  Cumulative max risk score: {sess['cumulative_risk']}/10",
        f"  Total findings accumulated: {sess['total_findings']}",
        f"  Threat patterns seen: {', '.join(patterns[:15]) if patterns else 'none'}",
    ]

    if timeline:
        recent = timeline[-5:]
        lines.append(
            "  Recent risk trend: " +
            " → ".join(f"chunk{r['chunk']}:{r['level']}({r['score']})" for r in recent)
        )

    if window:
        lines.append(f"  Last {len(window)} chunk summaries:")
        for w in window[-3:]:  # Only last 3 to keep prompt tight
            lines.append(
                f"    [Chunk {w['chunk']}] risk={w['risk_level']} "
                f"findings={w['findings']} — {w.get('commentary', '')[:120]}"
            )

    return "\n".join(lines)


# ── Background Cleanup Thread ─────────────────────────────────────────────────

def _start_cleanup_daemon() -> None:
    """Start a background thread that cleans expired sessions every 5 minutes."""
    def _loop():
        while True:
            time.sleep(300)  # 5 minutes
            try:
                cleanup_expired()
            except Exception as e:
                logger.warning(f"Memory cleanup error: {e}")

    t = threading.Thread(target=_loop, daemon=True, name="memory-cleanup")
    t.start()
    logger.info("Memory: cleanup daemon started (TTL=30min, interval=5min)")


# Start daemon when module is imported
_start_cleanup_daemon()
