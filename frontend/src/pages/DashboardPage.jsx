import { useState, useCallback, useEffect } from 'react'
import {
  Scan, Upload, Type, Settings2, RotateCcw, ChevronDown, ChevronUp,
  BarChart3, Terminal, MessageSquare, Bell, Activity, TrendingUp, Brain,
  History, ShieldCheck, Users, Layers, Clock, FileText, AlertTriangle,
  CheckCircle2, XCircle, Minus, RefreshCw, Database, Trash2
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
import TimelineFlow3D from '../components/TimelineFlow3D'
import { analyzeContent, analyzeFile } from '../services/api'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

// ─── Risk badge helper ─────────────────────────────────────────────────────────
function RiskBadge({ level }) {
  const map = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    high:     'bg-orange-500/15 text-orange-400 border-orange-500/30',
    medium:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    low:      'bg-blue-500/15 text-blue-400 border-blue-500/30',
    clean:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  }
  const icon = {
    critical: <XCircle className="w-3 h-3" />,
    high:     <AlertTriangle className="w-3 h-3" />,
    medium:   <Minus className="w-3 h-3" />,
    low:      <CheckCircle2 className="w-3 h-3" />,
    clean:    <CheckCircle2 className="w-3 h-3" />,
  }
  const cls = map[level] || map.clean
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold uppercase ${cls}`}>
      {icon[level] || null}
      {level || 'clean'}
    </span>
  )
}

// ─── Tabs config ───────────────────────────────────────────────────────────────
const BASE_TABS = [
  { id: 'analyze',     label: 'Analyze',      icon: Scan },
  { id: 'dashboard',   label: 'Dashboard',    icon: BarChart3 },
  { id: 'predictions', label: 'Predictions',  icon: TrendingUp },
  { id: 'stream',      label: 'Live Stream',  icon: Terminal },
  { id: 'alerts',      label: 'Alerts',       icon: Bell },
  { id: 'history',     label: 'History',      icon: History },
]
const ADMIN_TAB = { id: 'admin', label: 'Admin', icon: ShieldCheck }

const INPUT_MODES = [
  { id: 'text', label: 'Text / Log / SQL', icon: Type },
  { id: 'file', label: 'File Upload',      icon: Upload },
]

// ─── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow({ cols = 5 }) {
  return (
    <tr className="border-b border-slate-800/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-800/70 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail]         = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const viewSession = async (id) => {
    setSelectedId(id)
    setDetailLoading(true)
    setDetail(null)
    try {
      const { data } = await api.get(`/analyze/${id}`)
      
      // Synthesize missing Fix Analytics that were intentionally dropped from historical DB storage
      const synthFindings = (data.findings || []).map(f => ({
        ...f,
        type: f.finding_type,
        risk: f.risk_level,
        rootCause: f.description || `Analyzed threat pattern matching ${f.finding_type}`,
        fixSuggestions: f.risk_level === 'critical' || f.risk_level === 'high'
          ? [
              `Investigate the source of ${f.finding_type} immediately using system tracing.`,
              `Review contiguous security events surrounding line index ${f.line_number || 'unknown'}.`,
              `Implement strict rule-based quarantine for the offending access vector.`
            ]
          : [
              `Monitor the frequency metric of ${f.finding_type} for escalation.`,
              `Validate if this log artifact is expected during load phases.`
            ]
      }))

      setDetail({ ...data, findings: synthFindings })
    } catch {
      // ignore silently
    } finally {
      setDetailLoading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await api.get('/analyze/history?limit=50').then(r => r.data)
      // After interceptor unwrap, data IS the inner payload: { sessions, count }
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analysis History</h1>
          <p className="text-sm text-slate-500 mt-1">Your past security analyses</p>
        </div>
        <button onClick={load} disabled={loading}
          className="btn-secondary flex items-center gap-2 px-3 py-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="card p-4 border-red-500/30 bg-red-500/5 text-red-400 text-sm mb-4">
          ⚠️ {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['Date', 'Type', 'Risk Level', 'Risk Score', 'Action', 'File / Size', 'Duration'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}

            {!loading && sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <History className="w-10 h-10 text-slate-700" />
                    <p className="text-slate-500 text-sm">No analyses yet — run your first analysis in the Analyze tab.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && sessions.map(s => (
              <tr key={s.id} onClick={() => viewSession(s.id)} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300 capitalize">
                    {s.input_type === 'file'
                      ? <><FileText className="w-3 h-3" /> file</>
                      : <><Layers className="w-3 h-3" /> text</>}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={s.risk_level} />
                </td>
                <td className="px-4 py-3 text-slate-200 font-semibold tabular-nums">
                  {s.risk_score != null ? Number(s.risk_score).toFixed(1) : '—'}<span className="text-slate-600 font-normal">/10</span>
                </td>
                <td className="px-4 py-3 text-slate-400 capitalize text-xs">{s.action || '—'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {s.uploaded_filename
                    ? <span className="text-slate-300">{s.uploaded_filename} <span className="text-slate-600">({s.uploaded_size ? (s.uploaded_size / 1024).toFixed(1) + ' KB' : ''})</span></span>
                    : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {s.processing_ms ? `${(s.processing_ms / 1000).toFixed(2)}s` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && sessions.length > 0 && (
        <p className="text-xs text-slate-600 mt-3 text-right">{sessions.length} session(s) shown. Click any row to view full report.</p>
      )}

      {/* Detail Modal */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedId(null)}>
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-brand-400" />
                <h3 className="text-lg font-bold text-white">Historical Analysis Report</h3>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-slate-500 hover:text-slate-300">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-auto bg-slate-950 flex-1">
              {detailLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                  Loading session data...
                </div>
              )}
              {detail && (
                <div className="space-y-6 animate-slide-up">
                  {/* Summary/Risk panel */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="card p-4">
                       <p className="text-xs text-slate-500 mb-1">Risk Level</p>
                       <RiskBadge level={detail.session.risk_level} />
                     </div>
                     <div className="card p-4">
                       <p className="text-xs text-slate-500 mb-1">Risk Score</p>
                       <p className="text-xl font-bold text-white">{Number(detail.session.risk_score).toFixed(1)}<span className="text-sm font-normal text-slate-500">/10</span></p>
                     </div>
                     <div className="card p-4">
                       <p className="text-xs text-slate-500 mb-1">Input Type</p>
                       <p className="text-sm text-slate-300 capitalize">{detail.session.input_type}</p>
                     </div>
                     <div className="card p-4">
                       <p className="text-xs text-slate-500 mb-1">Processing Time</p>
                       <p className="text-sm text-slate-300">{detail.session.processing_ms ? (detail.session.processing_ms / 1000).toFixed(2) + 's' : '—'}</p>
                     </div>
                  </div>

                  {detail.session.ai_summary && (
                    <div className="card p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="w-4 h-4 text-brand-400" />
                        <h4 className="font-semibold text-white">AI Summary</h4>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed font-mono whitespace-pre-wrap bg-slate-900 p-4 rounded-xl border border-slate-800">{detail.session.ai_summary}</p>
                    </div>
                  )}

                  {/* Findings */}
                  <div className="card overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
                       <AlertTriangle className="w-4 h-4 text-orange-400" />
                       <h4 className="font-semibold text-white">Detected Findings & Explanations</h4>
                       <span className="ml-auto text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{detail.findings.length} findings</span>
                    </div>
                    {detail.findings.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-sm">No specific threats or findings were detected in this session.</div>
                    ) : (
                      <div className="divide-y divide-slate-800/50">
                        {detail.findings.map(f => (
                          <div key={f.id} className="p-4 flex items-start gap-4 hover:bg-slate-800/20 transition-colors">
                            <div className="mt-0.5 shrink-0"><RiskBadge level={f.risk_level} /></div>
                            
                            {f.line_number && (
                               <div className="shrink-0 flex items-center justify-center min-w-[3rem] px-2 py-1 bg-slate-950 border border-slate-700 rounded-md shadow-inner text-xs font-mono font-bold text-slate-300">
                                 L{f.line_number}
                               </div>
                            )}

                            <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2 mb-1.5">
                                 <span className="font-mono text-sm text-brand-300 font-semibold">{f.finding_type}</span>
                               </div>
                               <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">{f.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI Remediation Suggestions */}
                  {detail.findings.length > 0 && (
                     <div className="mt-6">
                       <FixSuggestions findings={detail.findings} />
                     </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Admin Tab ─────────────────────────────────────────────────────────────────
function AdminTab() {
  const [analytics, setAnalytics] = useState(null)
  const [users, setUsers]         = useState([])
  const [allSessions, setAllSessions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [view, setView]           = useState('overview') // overview | users | sessions

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("CRITICAL WARNING: Are you sure you want to permanently purge this user? All associated data and historical sessions will be CASCADE deleted. This action cannot be revoked.")) return;
    
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to properly delete user from standard constraints.");
    }
  }

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [analyticsRes, usersRes, sessionsRes] = await Promise.all([
        api.get('/admin/analytics').then(r => r.data),
        api.get('/admin/users?limit=100').then(r => r.data),
        api.get('/admin/analysis-sessions?limit=50').then(r => r.data),
      ])
      setAnalytics(analyticsRes)
      setUsers(usersRes.users || [])
      setAllSessions(sessionsRes.sessions || [])
    } catch (err) {
      const msg = err.response?.status === 403
        ? 'Access denied — admin only.'
        : err.response?.data?.error || 'Failed to load admin data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const statCards = analytics ? [
    { label: 'Total Users',    value: analytics.users,                   icon: <Users className="w-5 h-5 text-brand-400" /> },
    { label: 'Total Analyses', value: analytics.sessions,               icon: <Database className="w-5 h-5 text-emerald-400" /> },
    { label: 'Avg Risk Score', value: analytics.avgRiskScore?.toFixed(2), icon: <Activity className="w-5 h-5 text-orange-400" /> },
    { label: 'Risk Levels',    value: analytics.riskDistribution?.length + ' categories', icon: <BarChart3 className="w-5 h-5 text-purple-400" /> },
  ] : []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-400" />
            Admin Panel
          </h1>
          <p className="text-sm text-slate-500 mt-1">System-wide visibility and controls</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 px-3 py-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="card p-5 border-red-500/30 bg-red-500/5 text-red-400 text-sm mb-6">
          ⚠️ {error}
        </div>
      )}

      {/* Sub-nav */}
      {!error && (
        <>
          <div className="flex gap-2 mb-6">
            {[
              { id: 'overview',  label: 'Overview',  icon: BarChart3 },
              { id: 'users',     label: 'Users',     icon: Users },
              { id: 'sessions',  label: 'All Sessions', icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setView(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border
                  ${view === id
                    ? 'bg-brand-600/20 text-brand-400 border-brand-500/30'
                    : 'text-slate-400 border-slate-700/50 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Overview */}
          {view === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="card p-5">
                        <div className="h-5 w-24 bg-slate-800 rounded animate-pulse mb-2" />
                        <div className="h-8 w-16 bg-slate-800 rounded animate-pulse" />
                      </div>
                    ))
                  : statCards.map(s => (
                      <div key={s.label} className="card p-5 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-center">
                          {s.icon}
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{s.label}</p>
                          <p className="text-2xl font-bold text-white mt-0.5">{s.value ?? '—'}</p>
                        </div>
                      </div>
                    ))
                }
              </div>

              {!loading && analytics?.riskDistribution && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Risk Distribution</h3>
                  <div className="space-y-3">
                    {analytics.riskDistribution.map(r => {
                      const total = analytics.sessions || 1
                      const pct   = Math.round((r.count / total) * 100)
                      return (
                        <div key={r.risk_level} className="flex items-center gap-3">
                          <RiskBadge level={r.risk_level} />
                          <div className="flex-1 bg-slate-800 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor:
                                  r.risk_level === 'critical' ? '#ef4444'
                                  : r.risk_level === 'high'     ? '#f97316'
                                  : r.risk_level === 'medium'   ? '#eab308'
                                  : r.risk_level === 'low'      ? '#3b82f6'
                                  : '#10b981',
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 tabular-nums w-10 text-right">{r.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Users */}
          {view === 'users' && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
                  {!loading && users.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500 text-sm">No users found</td></tr>
                  )}
                  {!loading && users.map(u => (
                    <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 text-slate-200">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold uppercase
                          ${u.role === 'admin'
                            ? 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-700'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs
                          ${u.is_active !== false
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-500 border-slate-700'}`}>
                          {u.is_active !== false ? '● Active' : '○ Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className={`p-1.5 rounded-lg transition-colors ${u.role === 'admin' ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'}`}
                          title={u.role === 'admin' ? "Cannot purge lateral admin accounts" : "Purge User"}
                          disabled={u.role === 'admin'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* All Sessions */}
          {view === 'sessions' && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Date', 'User ID', 'Type', 'Risk Level', 'Score', 'Duration'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
                  {!loading && allSessions.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">No sessions found</td></tr>
                  )}
                  {!loading && allSessions.map(s => (
                    <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">{s.user_id?.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-slate-300 capitalize text-xs">{s.input_type}</td>
                      <td className="px-4 py-3"><RiskBadge level={s.risk_level} /></td>
                      <td className="px-4 py-3 text-slate-200 font-semibold tabular-nums text-xs">
                        {s.risk_score != null ? Number(s.risk_score).toFixed(1) : '—'}<span className="text-slate-600 font-normal">/10</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {s.processing_ms ? `${(s.processing_ms / 1000).toFixed(2)}s` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main DashboardPage ────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
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

  // Build tab list — append Admin tab only for admins
  const TABS = user?.role === 'admin'
    ? [...BASE_TABS, ADMIN_TAB]
    : BASE_TABS

  useEffect(() => { fetchSessions() }, [])

  async function fetchSessions() {
    try {
      // data IS the inner payload after interceptor unwrap: { sessions, count }
      const data = await api.get('/analyze/history?limit=10').then(r => r.data)
      setSessions(data.sessions || [])
    } catch {}
  }

  function pushToast(alert) {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, ...alert }])
    const timeout = alert.severity === 'critical' ? 12000 : alert.severity === 'high' ? 8000 : 5000;
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
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex gap-1 pb-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap
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
              {id === 'history' && sessions.length > 0 && (
                <span className="w-4 h-4 bg-slate-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {Math.min(sessions.length, 9)}
                </span>
              )}
              {id === 'admin' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/20 ml-1">
                  Admin
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
                  <TimelineFlow3D events={result.timeline || []} />
                  <Timeline events={result.timeline || []} />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── DASHBOARD ────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <h1 className="text-2xl font-bold text-white mb-6">Risk Dashboard</h1>
              <RiskDashboard
                findings={result?.findings || []}
                sessions={sessions}
                riskScore={result?.risk_score}
                riskLevel={result?.risk_level}
                correlation={result?.correlation}
              />
            </div>
            <div className="lg:col-span-1 space-y-6">
              <AlertPanel onCountChange={setAlertCount} />
            </div>
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

        {/* ── LIVE STREAM (Always mounted to preserve active WebSockets) ── */}
        <div className={tab === 'stream' ? 'block' : 'hidden'}>
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-white">Live Log Stream</h1>
            <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              AI Chunk Analysis
            </span>
          </div>
          <LiveLogStream 
            pushToast={pushToast} 
            incrementAlert={() => setAlertCount(c => c + 1)} 
            setResult={setResult}
            fetchSessions={fetchSessions}
          />
        </div>

        {/* ── ALERTS ────────────────────────────────────────────────── */}
        {tab === 'alerts' && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-6">Security Alerts</h1>
            <AlertPanel onCountChange={setAlertCount} />
          </div>
        )}

        {/* ── HISTORY ───────────────────────────────────────────────── */}
        {tab === 'history' && <HistoryTab />}

        {/* ── ADMIN ─────────────────────────────────────────────────── */}
        {tab === 'admin' && user?.role === 'admin' && <AdminTab />}
        {tab === 'admin' && user?.role !== 'admin' && (
          <div className="card p-10 text-center">
            <ShieldCheck className="w-12 h-12 mx-auto text-slate-700 mb-4" />
            <p className="text-slate-400 font-semibold">Access Denied</p>
            <p className="text-slate-600 text-sm mt-1">Admin privileges required.</p>
          </div>
        )}
      </main>

      {/* Floating AI chat */}
      <ChatAssistant analysisContext={chatContext} />
    </div>
  )
}
