import os
import json
import logging
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from analyzer import (
    analyze_with_ai,
    analyze_chunk_with_ai,
    chat_with_ai,
    predict_threats_ai,
    correlate_logs_ai,
)
from memory import get_session, clear_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "AI Secure — Python AI Service (AI-First v3.0)",
        "version": "3.0.0",
        "llm_backend": os.getenv("LLM_BACKEND", "gemini"),
        "endpoints": [
            "POST /ai/analyze",
            "POST /ai/analyze/chunk",
            "POST /ai/chat",
            "POST /ai/predict",
            "POST /ai/correlate",
        ],
    })


# ── Full AI Analysis ──────────────────────────────────────────────────────────

@app.route("/ai/analyze", methods=["POST"])
def analyze():
    """
    AI-first full document analysis.
    Input:  { content, context?, inputType?, findings?, stats?, riskLevel?, riskScore? }
    Output: { findings, root_cause, predictions, fix_suggestions, anomalies, risk_score, confidence, summary, mode }
    """
    try:
        raw_data = request.get_json(force=True) or {}
        data = dict(raw_data) # typing pass
        content = data.get("content", "")
        if not content.strip():
            return jsonify({"error": "content is required"}), 400

        context = data.get("context", {})
        if not isinstance(context, dict):
            context = {}
            
        # Merge legacy fields into context if provided
        for field in ["inputType", "riskLevel", "riskScore", "findings", "stats"]:
            if field in data and data.get(field):
                context[field] = data.get(field)

        session_id = data.get("session_id", "default")

        logger.info(f"AI analyze: {len(content)} chars, session={session_id}, backend={os.getenv('LLM_BACKEND','gemini')}")
        result = analyze_with_ai(content, context, session_id)
        return jsonify(result)

    except Exception as e:
        logger.error(f"AI analyze error: {e}", exc_info=True)
        return jsonify({"error": str(e), "mode": "error"}), 500


# ── Chunk Analysis (for real-time streaming) ──────────────────────────────────

@app.route("/ai/analyze/chunk", methods=["POST"])
def analyze_chunk():
    """
    Analyze a single log chunk as part of a streaming session.
    Input:  { chunk, chunk_index, session_context? }
    Output: { chunk_index, findings, chunk_risk_level, chunk_risk_score, escalation, anomalies, ai_commentary, new_patterns }
    """
    try:
        raw_data = request.get_json(force=True) or {}
        data = dict(raw_data)
        
        chunk = data.get("chunk", "")
        chunk_index = data.get("chunk_index", 0)
        session_context = data.get("session_context", {})

        if not chunk.strip():
            return jsonify({
                "chunk_index": chunk_index,
                "findings": [],
                "chunk_risk_level": "clean",
                "chunk_risk_score": 0,
                "escalation": {"detected": False, "explanation": "Empty chunk"},
                "anomalies": [],
                "ai_commentary": "Empty chunk — nothing to analyze.",
                "new_patterns": [],
                "mode": "ai",
            })

        session_id = data.get("session_id", "default")
        
        # Legacy fallback if no session_id provided but session_context is
        if not session_id and not session_context:
            session_context = {}

        logger.info(f"AI chunk analyze: chunk #{chunk_index}, session={session_id}")
        result = analyze_chunk_with_ai(chunk, chunk_index, session_id)
        return jsonify(result)

    except Exception as e:
        logger.error(f"Chunk analyze error: {e}", exc_info=True)
        return jsonify({"error": str(e), "chunk_index": data.get("chunk_index", 0)}), 500


# ── AI Chat ───────────────────────────────────────────────────────────────────

@app.route("/ai/chat", methods=["POST"])
def chat():
    """
    Context-aware AI security chat.
    Input:  { message, history?, context? }
    Output: { reply, confidence, referenced_findings, follow_up_suggestions, mode }
    """
    try:
        raw_data = request.get_json(force=True) or {}
        data = dict(raw_data)
        
        message = data.get("message", "")
        if isinstance(message, str):
            message = message.strip()
        
        if not message:
            return jsonify({"error": "message is required"}), 400

        history = data.get("history", [])
        context = data.get("context", {})
        session_id = data.get("session_id", "default")

        msg_preview = "".join(ch for i, ch in enumerate(message) if i < 80)
        logger.info(f"AI chat: '{msg_preview}...' session={session_id}")
        
        # We pass session_id to let the new memory engine handle history.
        # Fallback to provided history ONLY if no session_id is active.
        result = chat_with_ai(message, session_id, context) if session_id else chat_with_ai(message, None, context)
        return jsonify(result)

    except Exception as e:
        logger.error(f"AI chat error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ── Predictive Threat Analysis ────────────────────────────────────────────────

@app.route("/ai/predict", methods=["POST"])
def predict():
    """
    Predictive threat analysis based on current findings.
    Input:  { findings, timeline?, context? }
    Output: { threat_trajectory, attack_stage, predictions, blast_radius, urgency, confidence }
    """
    try:
        data = request.get_json(force=True) or {}
        findings = data.get("findings", [])
        timeline = data.get("timeline", [])
        context = data.get("context", {})

        if not findings:
            return jsonify({
                "threat_trajectory": "No findings to predict from",
                "attack_stage": "none",
                "predictions": [],
                "blast_radius": {"affected_systems": [], "potential_data_loss": "None", "business_impact": "None"},
                "urgency": "low",
                "confidence": 0.0,
                "mode": "ai",
            })

        logger.info(f"AI predict: {len(findings)} findings")
        result = predict_threats_ai(findings, timeline, context)
        return jsonify(result)

    except Exception as e:
        logger.error(f"AI predict error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ── Cross-Log Correlation ─────────────────────────────────────────────────────

@app.route("/ai/correlate", methods=["POST"])
def correlate():
    """
    AI-driven cross-log correlation.
    Input:  { logs_context }
    Output: { correlations, attack_chain, threat_actor_profile, summary }
    """
    try:
        data = request.get_json(force=True) or {}
        logs_context = data.get("logs_context", {})

        if not logs_context:
            return jsonify({"correlations": [], "attack_chain": "No context provided", "summary": "No data to correlate", "mode": "ai"})

        logger.info("AI correlate: cross-log correlation request")
        result = correlate_logs_ai(logs_context)
        return jsonify(result)

    except Exception as e:
        logger.error(f"AI correlate error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ── Memory Endpoints ──────────────────────────────────────────────────────────

@app.route("/ai/memory/<session_id>", methods=["GET"])
def get_memory(session_id):
    """Retrieve the current state of a session's AI memory."""
    try:
        session_data = get_session(session_id)
        return jsonify(session_data)
    except Exception as e:
        logger.error(f"Memory GET error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/ai/memory/<session_id>", methods=["DELETE"])
def delete_memory(session_id):
    """Clear a session's AI memory."""
    try:
        clear_session(session_id)
        return jsonify({"status": "cleared", "session_id": session_id})
    except Exception as e:
        logger.error(f"Memory DELETE error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("AI_SERVICE_PORT", 5001)))
    logger.info(f"🐍 AI Service v3.0 (AI-First) starting on port {port}")
    logger.info(f"🤖 LLM Backend: {os.getenv('LLM_BACKEND', 'gemini')}")
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
