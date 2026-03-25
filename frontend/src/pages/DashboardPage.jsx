import { useState, useCallback, useEffect } from 'react'
import {
  Scan, Upload, Type, Settings2, RotateCcw, ChevronDown, ChevronUp,
  BarChart3, Terminal, MessageSquare, Bell, Activity, TrendingUp, Brain
} from 'lucide-react'
import Navbar from '../components/Navbar'
import FileUpload from '../components/FileUpload'
import TextInput from '../components/TextInput'
import LogViewer from '../components/LogViewer'
import InsightsPanel from '../components/InsightsPanel'
import ResultsView from '../components/ResultsView'
import FixSuggestions from '../components/FixSuggestions'
import RiskDashboard from '../components/RiskDashboard'
import ChatAssistant from '../components/ChatAssistant'
import LiveLogStream from '../components/LiveLogStream'
import Timeline from '../components/Timeline'
import AlertPanel, { AlertBell, AlertToasts } from '../components/AlertPanel'
import PredictivePanel from '../components/PredictivePanel'
import { analyzeContent, analyzeFile } from '../services/api'
import api from '../services/api'

const TABS = [
  { id: 'analyze',     label: 'Analyze',      icon: Scan },
  { id: 'dashboard',   label: 'Dashboard',    icon: BarChart3 },
  { id: 'predictions', label: 'Predictions',  icon: TrendingUp },
  { id: 'stream',      label: 'Live Stream',  icon: Terminal },
  { id: 'alerts',      label: 'Alerts',       icon: Bell },
]

const INPUT_MODES = [
  { id: 'text', label: 'Text / Log / SQL', icon: Type },
  { id: 'file', label: 'File Upload',      icon: Upload },
]

export default function DashboardPage() {
  const [tab, setTab]             = useState('analyze')
  const [inputMode, setInputMode] = useState('text')
  const [content, setContent]     = useState('')
  const [contentType, setType]    = useState('text')
  const [file, setFile]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')
  const [showOpts, setShowOpts]   = useState(false)
  const [options, setOptions]     = useState({ mask: true, block_high_risk: false, log_analysis: true })
  const [sessions, setSessions]   = useState([])
  const [alertCount, setAlertCount] = useState(0)
  const [toasts, setToasts]         = useState([])

  useEffect(() => { fetchSessions() }, [])

  async function fetchSessions() {
    try {
      const { data } = await api.get('/analyze/history?limit=10')
      setSessions(data.sessions || [])
    } catch {}
  }

  function pushToast(alert) {
    const id = Date.now()
    setToasts(prev => [...prev, { id, ...alert }])
    const timeout = alert.severity === 'critical' ? 12000 : alert.severity === 'high' ? 8000 : 5000
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), timeout)
  }

  const handleText = useCallback((val, type) => { setContent(val); setType(type) }, [])
  const handleReset = () => { setResult(null); setError(''); setContent(''); setFile(null) }

  const handleAnalyze = async () => {
    if (!content.trim() && !file) { setError('Provide content or upload a file.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      let data
      if (inputMode === 'file' && file) data = await analyzeFile(file, contentType, options)
      else data = await analyzeContent({ input_type: contentType, content, options })
      setResult(data)
      fetchSessions()
      // Toast alerts
      if (data.risk_level === 'critical' || data.risk_level === 'high') {
        pushToast({ severity: data.risk_level, message: `${data.risk_level.toUpperCase()}: ${data.findings?.length} finding(s) — score ${data.risk_score}/10` })
      }
      data.predictions?.filter(p => p.likelihood === 'high').slice(0, 1).forEach(p =>
        pushToast({ severity: 'high', message: `⚡ Predicted: ${p.threat}` })
      )
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed. Check backend is running.')
    } finally { setLoading(false) }
  }

  // Chat context includes the full AI result fields
  const chatContext = result ? {
    findings: result.findings,
    risk_level: result.risk_level,
    risk_score: result.risk_score,
    root_cause: result.root_cause,
    predictions: result.predictions,
    summary: result.summary,
  } : null

  return (
    <div className="min-h-screen bg-slate-950">
      <AlertToasts toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800/60">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">AI Secure</span>
              <span className="text-slate-500 text-sm"> › Intelligence Platform</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertBell count={alertCount} onClick={() => setTab('alerts')} />
            <Navbar activeSession={loading} minimal />
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex gap-1 pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-all
                ${tab === id
                  ? 'bg-brand-600/20 text-brand-400 border-b-2 border-brand-500'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'}`}>
              <Icon className="w-4 h-4" />
              {label}
              {id === 'alerts' && alertCount > 0 && (
                <span className="w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {Math.min(alertCount, 9)}
                </span>
              )}
              {id === 'predictions' && result?.predictions?.length > 0 && (
                <span className="w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {Math.min(result.predictions.length, 9)}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">

        {/* ── ANALYZE ─────────────────────────────────────────────── */}
        {tab === 'analyze' && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Left: Input */}
            <div className="xl:col-span-3 space-y-5">
              <div className="card p-5">
                {/* Mode toggle */}
                <div className="flex gap-2 mb-5 p-1 bg-slate-800/60 rounded-xl border border-slate-700/50">
                  {INPUT_MODES.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => { setInputMode(id); handleReset() }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all
                        ${inputMode === id ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>
                      <Icon className="w-4 h-4" />{label}
                    </button>
                  ))}
                </div>
                {inputMode === 'text'
                  ? <TextInput onContentChange={handleText} disabled={loading} />
                  : <FileUpload onFileSelect={setFile} disabled={loading} />}
              </div>

              {/* Options */}
              <div className="card">
                <button onClick={() => setShowOpts(!showOpts)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">Analysis Options</span>
                  </div>
                  {showOpts ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {showOpts && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-4 animate-slide-up">
                    {[
                      { key: 'mask',            label: 'Mask Sensitive Data',     desc: 'Replace detected values with [REDACTED]' },
                      { key: 'block_high_risk', label: 'Block High Risk Content', desc: 'Withhold content if risk is critical' },
                      { key: 'log_analysis',    label: 'Enable Log Analysis',     desc: 'Run log-specific threat detection' },
                    ].map(({ key, label, desc }) => (
                      <label key={key} className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative mt-0.5">
                          <input type="checkbox" checked={options[key]}
                            onChange={e => setOptions(o => ({ ...o, [key]: e.target.checked }))}
                            className="sr-only" />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                            ${options[key] ? 'bg-brand-600 border-brand-600' : 'border-slate-600'}`}>
                            {options[key] && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">{label}</p>
                          <p className="text-xs text-slate-500">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button onClick={handleAnalyze} disabled={loading || (!content.trim() && !file)}
                  className="btn-primary flex-1 justify-center py-3 text-base">
                  {loading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing with AI…</>
                    : <><Scan className="w-5 h-5" /> Run AI Security Analysis</>}
                </button>
                {result && (
                  <button onClick={handleReset} className="btn-secondary flex items-center gap-2 px-4">
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm animate-fade-in">
                  ⚠️ {error}
                </div>
              )}

              {result?.line_analysis && <LogViewer lineAnalysis={result.line_analysis} content={content} />}

              {result && (
                <>
                  <ResultsView
                    findings={result.findings || []}
                    action={result.action}
                    processedContent={result.processed_content}
                    maskedCount={result.masked_count}
                  />
                  <FixSuggestions findings={result.findings || []} />
                </>
              )}
            </div>

            {/* Right: Insights */}
            <div className="xl:col-span-2 space-y-5">
              {!result && !loading && (
                <div className="card p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-8 h-8 text-brand-400 opacity-60" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">AI-First Security Analysis</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Paste content or upload a file. AI will detect risks, explain root causes, predict future threats, and suggest fixes.
                  </p>
                  <div className="mt-6 space-y-2 text-left">
                    {['🔑 AI-detected credentials & secrets', '🧠 Root cause reasoning', '⚡ Predictive threat analysis', '🔧 Code-level fix suggestions', '🔗 Cross-log correlation', '📊 AI confidence scoring'].map(tip => (
                      <div key={tip} className="text-xs text-slate-400 bg-slate-800/40 rounded-lg px-3 py-2">{tip}</div>
                    ))}
                  </div>
                </div>
              )}

              {loading && (
                <div className="card p-10 flex flex-col items-center gap-5 animate-fade-in">
                  <div className="relative">
                    <div className="w-16 h-16 border-2 border-brand-500/20 rounded-full" />
                    <div className="absolute inset-0 w-16 h-16 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <Brain className="absolute inset-0 m-auto w-6 h-6 text-brand-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white mb-1">AI Analyzing…</p>
                    <p className="text-slate-400 text-sm">Running AI security pipeline</p>
                  </div>
                  <div className="w-full space-y-2">
                    {['AI Detection Engine', 'Root Cause Analysis', 'Predictive Threats', 'Fix Suggestions', 'Cross-Log Correlation', 'Confidence Scoring'].map((step, i) => (
                      <div key={step} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-4 h-4 border border-brand-500/40 border-t-brand-400 rounded-full animate-spin" style={{ animationDelay: `${i * 0.12}s` }} />
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result && !loading && (
                <>
                  <InsightsPanel
                    summary={result.summary}
                    insights={result.insights}
                    riskLevel={result.risk_level}
                    riskScore={result.risk_score}
                    riskSummary={result.riskSummary}
                    stats={result.stats}
                    rootCause={result.root_cause}
                    fixSuggestions={result.fix_suggestions}
                    anomalies={result.anomalies}
                    confidence={result.confidence}
                  />
                  <Timeline events={result.timeline || []} />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── DASHBOARD ────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-6">Risk Dashboard</h1>
            <RiskDashboard
              findings={result?.findings || []}
              sessions={sessions}
              riskScore={result?.risk_score}
              riskLevel={result?.risk_level}
              correlation={result?.correlation}
            />
          </div>
        )}

        {/* ── PREDICTIONS ──────────────────────────────────────────── */}
        {tab === 'predictions' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-2xl font-bold text-white">Predictive Threat Intelligence</h1>
              {result?.confidence > 0 && (
                <span className="text-sm px-3 py-1 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full">
                  AI Confidence: {Math.round(result.confidence * 100)}%
                </span>
              )}
            </div>
            {!result ? (
              <div className="card p-10 text-center">
                <TrendingUp className="w-12 h-12 mx-auto text-slate-700 mb-4" />
                <p className="text-slate-500 text-sm">Run an analysis first to see AI threat predictions</p>
              </div>
            ) : (
              <PredictivePanel
                predictions={result.predictions || []}
                threatTrajectory={result.threat_trajectory}
                attackStage={result.attack_stage}
                blastRadius={result.blast_radius}
                urgency={result.predictions?.[0]?.likelihood || 'medium'}
                confidence={result.confidence}
              />
            )}
          </div>
        )}

        {/* ── LIVE STREAM ───────────────────────────────────────────── */}
        {tab === 'stream' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-2xl font-bold text-white">Live Log Stream</h1>
              <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                AI Chunk Analysis
              </span>
            </div>
            <LiveLogStream />
          </div>
        )}

        {/* ── ALERTS ────────────────────────────────────────────────── */}
        {tab === 'alerts' && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-6">Security Alerts</h1>
            <AlertPanel onCountChange={setAlertCount} />
          </div>
        )}
      </main>

      {/* Floating AI chat — passes full AI context */}
      <ChatAssistant analysisContext={chatContext} />
    </div>
  )
}
