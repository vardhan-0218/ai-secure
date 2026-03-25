import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal, Play, Square, Pause, Wifi, WifiOff, AlertTriangle, Zap, Brain, TrendingUp, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react'
import RiskBadge from './RiskBadge'

const RISK_COLORS = {
  critical: 'bg-red-500/12 border-l-2 border-red-500',
  high:     'bg-orange-500/10 border-l-2 border-orange-500',
  medium:   'bg-yellow-500/8 border-l border-yellow-500',
  low:      'bg-blue-500/6 border-l border-blue-500/50',
  clean:    '',
}

export default function LiveLogStream() {
  const [lines, setLines]               = useState([])
  const [chunkResults, setChunkResults] = useState([])
  const [alerts, setAlerts]             = useState([])
  const [connected, setConnected]       = useState(false)
  const [streaming, setStreaming]       = useState(false)
  const [connError, setConnError]       = useState('')
  const [logInput, setLogInput]         = useState('')
  const [paused, setPaused]             = useState(false)
  const [progress, setProgress]         = useState(null)   // {done, total, percent}
  const [sessionSummary, setSessionSummary] = useState(null)
  const [expandedChunks, setExpandedChunks] = useState(new Set())
  const [stats, setStats]               = useState({ total: 0, suspicious: 0, critical: 0, high: 0 })

  const wsRef     = useRef(null)
  const bottomRef = useRef(null)
  const pausedRef = useRef(false)
  const lineMapRef = useRef({}) // chunk_index → chunk data

  useEffect(() => () => wsRef.current?.close(), [])

  useEffect(() => {
    if (!pausedRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const connect = () => {
    setConnError('')
    const auth  = localStorage.getItem('auth')
    const token = auth ? JSON.parse(auth).accessToken : ''
    try {
      const ws = new WebSocket(`ws://localhost:3001/stream?token=${token}`)
      wsRef.current = ws

      ws.onopen  = () => { setConnected(true); setConnError('') }
      ws.onclose = (e) => {
        setConnected(false); setStreaming(false)
        if (e.code === 4001) setConnError('Auth failed — please refresh and log in again.')
      }
      ws.onerror = () => {
        setConnected(false)
        setConnError('Cannot connect to WebSocket. Make sure backend is running on port 3001.')
      }

      ws.onmessage = (evt) => {
        if (pausedRef.current) return
        try {
          const msg = JSON.parse(evt.data)
          handleWsMessage(msg)
        } catch {}
      }
    } catch (err) {
      setConnError(`WebSocket error: ${err.message}`)
    }
  }

  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'stream_start':
        setLines([]); setChunkResults([]); setAlerts([])
        setStats({ total: 0, suspicious: 0, critical: 0, high: 0 })
        setProgress({ done: 0, total: msg.totalChunks, percent: 0 })
        setSessionSummary(null)
        break

      case 'chunk_start':
        // Visual indicator that a chunk is being processed
        setChunkResults(prev => [
          ...prev,
          { chunk_index: msg.chunk_index, start_line: msg.start_line, end_line: msg.end_line, loading: true }
        ])
        break

      case 'chunk_ai_result':
        setChunkResults(prev => prev.map(c =>
          c.chunk_index === msg.chunk_index
            ? { ...c, ...msg, loading: false }
            : c
        ))
        // Update stats
        const newFindings = msg.findings || []
        setStats(s => ({
          total: s.total + (msg.end_line - msg.start_line + 1),
          suspicious: s.suspicious + newFindings.length,
          critical: s.critical + newFindings.filter(f => f.risk === 'critical').length,
          high: s.high + newFindings.filter(f => f.risk === 'high').length,
        }))
        break

      case 'stream_alert':
        setAlerts(prev => [msg, ...prev.slice(0, 29)])
        break

      case 'stream_progress':
        setProgress({ done: msg.chunks_done, total: msg.total_chunks, percent: msg.percent })
        break

      case 'stream_complete':
        setStreaming(false)
        setProgress({ done: msg.totalChunks, total: msg.totalChunks, percent: 100 })
        setSessionSummary(msg)
        break
    }
  }, [])

  const disconnect = () => {
    wsRef.current?.close()
    setLines([]); setChunkResults([]); setStats({ total: 0, suspicious: 0, critical: 0, high: 0 })
    setProgress(null); setSessionSummary(null); setConnError('')
  }

  const startStream = () => {
    if (!connected || !logInput.trim()) return
    setStreaming(true); setExpandedChunks(new Set())
    wsRef.current.send(JSON.stringify({ type: 'stream_log', content: logInput }))
  }

  const cancelStream = () => {
    wsRef.current?.send(JSON.stringify({ type: 'cancel_stream' }))
    setStreaming(false)
  }

  const togglePause = () => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  const toggleChunk = (idx) => {
    setExpandedChunks(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Controls Card */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border transition-all
            ${connected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          {streaming && (
            <div className="flex items-center gap-1.5 text-xs text-brand-400 animate-pulse">
              <Brain className="w-3.5 h-3.5" /> AI Processing Chunks…
            </div>
          )}
          {progress && (
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }} />
              </div>
              <span>{progress.percent}%</span>
            </div>
          )}
        </div>

        <textarea value={logInput} onChange={e => setLogInput(e.target.value)} rows={5}
          placeholder="Paste log content here, or click 'Load Sample'…"
          className="input-field font-mono text-xs w-full mb-4 resize-none" />

        <div className="flex flex-wrap gap-2">
          {!connected
            ? <button onClick={connect} className="btn-primary flex items-center gap-2"><Wifi className="w-4 h-4" /> Connect</button>
            : <button onClick={disconnect} className="btn-secondary flex items-center gap-2"><Square className="w-4 h-4" /> Disconnect</button>
          }
          <button onClick={startStream} disabled={!connected || !logInput.trim() || streaming}
            className="btn-primary flex items-center gap-2">
            <Play className="w-4 h-4" /> Stream & Analyze
          </button>
          {streaming && (
            <button onClick={cancelStream} className="btn-secondary flex items-center gap-2 text-red-400">
              <Square className="w-4 h-4" /> Cancel
            </button>
          )}
          <button onClick={togglePause} className={`btn-secondary flex items-center gap-2 ${paused ? 'text-yellow-400' : ''}`}>
            <Pause className="w-4 h-4" /> {paused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={() => setLogInput(SAMPLE_LOG)} className="btn-secondary">
            Load Sample
          </button>
        </div>

        {connError && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{connError}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      {(stats.total > 0 || streaming) && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Lines Processed', val: stats.total, color: 'text-brand-400', icon: Terminal },
            { label: 'Suspicious', val: stats.suspicious, color: 'text-yellow-400', icon: AlertTriangle },
            { label: 'High Risk', val: stats.high, color: 'text-orange-400', icon: TrendingUp },
            { label: 'Critical', val: stats.critical, color: 'text-red-400', icon: Zap },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Session Complete Summary */}
      {sessionSummary && (
        <div className="card p-5 border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-emerald-300">Stream Analysis Complete</span>
          </div>
          <p className="text-sm text-slate-300">{sessionSummary.summary}</p>
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span>{sessionSummary.totalLines} lines</span>
            <span>{sessionSummary.totalChunks} chunks</span>
            <span>{sessionSummary.totalFindings} findings</span>
            <RiskBadge level={sessionSummary.finalRiskLevel} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Chunk Results Panel */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-slate-800">
            <Brain className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-white">AI Chunk Analysis</span>
            <span className="ml-auto text-xs text-slate-500">{chunkResults.length} chunks</span>
          </div>
          <div className="overflow-auto h-[480px]">
            {chunkResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                <Terminal className="w-10 h-10 opacity-20" />
                <p className="text-sm">Connect and stream a log to see AI analysis</p>
              </div>
            ) : (
              chunkResults.map(chunk => (
                <ChunkRow key={chunk.chunk_index} chunk={chunk}
                  expanded={expandedChunks.has(chunk.chunk_index)}
                  onToggle={() => toggleChunk(chunk.chunk_index)} />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Live Alert Feed */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-slate-800">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-white">Live Alerts</span>
            {alerts.length > 0 && (
              <span className="ml-auto text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full">{alerts.length}</span>
            )}
          </div>
          <div className="overflow-auto h-[480px]">
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">No alerts yet</div>
            ) : (
              alerts.map((a, i) => (
                <div key={i} className={`p-3 border-b border-slate-800/50 animate-slide-up
                  ${a.severity === 'critical' ? 'bg-red-500/8' : a.severity === 'high' ? 'bg-orange-500/6' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <RiskBadge level={a.severity} showDot />
                    <span className="text-[10px] text-slate-600 ml-auto">Chunk #{a.chunk_index}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{a.description}</p>
                  {a.ai_reasoning && (
                    <p className="text-[10px] text-slate-600 mt-1 italic">{a.ai_reasoning.slice(0, 80)}…</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChunkRow({ chunk, expanded, onToggle }) {
  const riskColor = RISK_COLORS[chunk.chunk_risk_level] || ''
  const hasFindings = (chunk.findings?.length || 0) > 0
  const chunkText = chunk.chunk_content_masked || ''
  const showMaskedContent = Boolean(chunkText.trim())

  return (
    <div className={`border-b border-slate-900 ${riskColor}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 transition-colors text-left">
        <span className="text-xs text-slate-600 font-mono w-24 shrink-0">
          L{chunk.start_line}–{chunk.end_line}
        </span>

        {chunk.loading ? (
          <div className="flex items-center gap-2 text-xs text-brand-400">
            <div className="w-3 h-3 border border-brand-500 border-t-transparent rounded-full animate-spin" />
            AI analyzing…
          </div>
        ) : (
          <>
            <RiskBadge level={chunk.chunk_risk_level || 'clean'} />
            {chunk.escalation?.detected && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-semibold">ESCALATION</span>
            )}
            <span className="text-xs text-slate-400 flex-1 truncate">{chunk.ai_commentary}</span>
            {hasFindings && (
              <span className="text-xs text-slate-500 shrink-0">{chunk.findings.length} finding{chunk.findings.length !== 1 ? 's' : ''}</span>
            )}
            {expanded ? <ChevronUp className="w-3 h-3 text-slate-600 shrink-0" /> : <ChevronDown className="w-3 h-3 text-slate-600 shrink-0" />}
          </>
        )}
      </button>

      {expanded && !chunk.loading && (
        <div className="px-4 pb-3 space-y-2 border-t border-slate-800/50 pt-2 animate-slide-up">
          {chunk.ai_commentary && (
            <div className="flex items-start gap-2">
              <Brain className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300">{chunk.ai_commentary}</p>
            </div>
          )}
          {chunk.escalation?.detected && (
            <div className="text-xs text-red-300 bg-red-500/10 rounded px-2 py-1">
              ⚡ Escalation: {chunk.escalation.explanation}
            </div>
          )}
          {chunk.findings?.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <RiskBadge level={f.risk} showDot={false} />
              <span className="text-slate-400">{f.description}</span>
            </div>
          ))}

          {showMaskedContent && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-slate-500 font-semibold px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800/30">
                  Masked chunk
                </span>
                <span className="text-[10px] text-slate-600 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                  Sensitive lines highlighted
                </span>
              </div>
              <pre className="font-mono text-[11px] leading-relaxed text-slate-300 bg-slate-900/40 border border-slate-800 rounded-xl p-3 overflow-auto max-h-36 whitespace-pre-wrap">
                {renderHighlightedLines(chunkText)}
              </pre>
            </div>
          )}
          {chunk.anomalies?.map((a, i) => (
            <div key={i} className="text-xs text-yellow-400 bg-yellow-500/8 rounded px-2 py-1">⚠ {a}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function renderHighlightedLines(text) {
  if (!text) return null
  const lines = String(text).split('\n')

  return lines.map((line, idx) => {
    const isSensitive = /\[REDACTED\]/.test(line)
    return (
      <span
        key={idx}
        className={isSensitive ? 'block bg-red-500/10 rounded px-1 py-0.5' : 'block'}
      >
        {highlightSensitiveLine(line)}
        {idx < lines.length - 1 ? <br /> : null}
      </span>
    )
  })
}

function highlightSensitiveLine(line) {
  // Render spans only (no HTML injection).
  const regex = /(password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*\[REDACTED\]/gi
  const matches = Array.from(String(line).matchAll(regex))
  if (!matches.length) return line

  const parts = []
  let last = 0

  for (const m of matches) {
    const start = m.index ?? 0
    const end = start + m[0].length
    if (start > last) parts.push(line.slice(last, start))

    parts.push(
      <span key={`${start}-${end}`} className="text-red-300 bg-red-500/15 border border-red-500/20 px-1 rounded">
        {line.slice(start, end)}
      </span>
    )
    last = end
  }

  if (last < line.length) parts.push(line.slice(last))
  return parts
}

const SAMPLE_LOG = `2024-01-15 09:00:01 INFO  Application started on port 8080
2024-01-15 09:01:12 ERROR Login failed for user: admin@corp.com from IP 10.0.0.100
2024-01-15 09:01:13 ERROR Login failed for user: admin@corp.com from IP 10.0.0.100
2024-01-15 09:01:14 ERROR Login failed for user: admin@corp.com from IP 10.0.0.100
2024-01-15 09:01:15 ERROR Login failed for user: admin@corp.com from IP 10.0.0.100
2024-01-15 09:01:16 ERROR Login failed for user: admin@corp.com from IP 10.0.0.100
2024-01-15 09:01:17 WARN  Account admin@corp.com temporarily locked after 5 failures
2024-01-15 09:02:00 WARN  Config dump: password=Pr0dSecr3t!2024 api_key=sk-prod-abc123def456ghi789jkl
2024-01-15 09:02:01 INFO  AWS credentials loaded: AKIAIOSFODNN7EXAMPLE
2024-01-15 09:03:11 ERROR HTTP 500 Internal Server Error at /api/users
2024-01-15 09:03:11 ERROR   at com.app.UserService.getUser(UserService.java:142:19)
2024-01-15 09:03:11 ERROR   at com.app.UserController.handleRequest(UserController.java:89:5)
2024-01-15 09:04:20 WARN  DB: postgresql://admin:D@tabase_P@ss@prod.db.internal:5432/app_prod
2024-01-15 09:04:25 INFO  User 3421 accessed /admin/users without role check
2024-01-15 09:05:33 WARN  Request path=../../etc/passwd returned 200
2024-01-15 09:05:40 WARN  Request path=../../etc/shadow returned 200
2024-01-15 09:06:01 INFO  Scheduled backup completed
2024-01-15 09:07:44 ERROR Authentication failed for user_id=2091
2024-01-15 09:08:12 INFO  User 2091 reset password for admin (UNAUTHORIZED)
2024-01-15 09:09:00 ERROR UNION SELECT username,password FROM users-- detected in request
2024-01-15 09:10:00 INFO  Exporting 50000 user records to external endpoint: 203.0.113.42`
