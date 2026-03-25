import { BarChart3, Shield, AlertTriangle, TrendingUp, Activity, Clock, Database, Zap } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import RiskSphere3D from './RiskSphere3D'

const RISK_COLORS_HEX = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#3b82f6',
  clean:    '#10b981',
}

const RISK_BG = {
  critical: 'bg-red-500/15 border-red-500/30 text-red-300',
  high:     'bg-orange-500/15 border-orange-500/30 text-orange-300',
  medium:   'bg-yellow-500/15 border-yellow-500/30 text-yellow-300',
  low:      'bg-blue-500/15 border-blue-500/30 text-blue-300',
  clean:    'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
}

export default function RiskDashboard({ findings = [], sessions = [], riskScore, riskLevel, correlation }) {
  // Type frequency map
  const typeCounts = {}
  findings.forEach(f => { typeCounts[f.type] = (typeCounts[f.type] || 0) + 1 })
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])

  // Risk distribution
  const riskDist = { critical: 0, high: 0, medium: 0, low: 0 }
  findings.forEach(f => { if (riskDist[f.risk] !== undefined) riskDist[f.risk]++ })
  const totalFindings = findings.length || 1

  // Session history chart data
  const last10Sessions = sessions.slice(0, 10).reverse()
  const riskTrendData = last10Sessions.map(s => {
    const dt = s.created_at ? new Date(s.created_at) : null
    return {
      label: dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
      risk_score: Number(s.risk_score) || 0,
    }
  })

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 3D Risk Sphere */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-400" />
            <h3 className="font-semibold text-white text-sm">3D Risk Sphere</h3>
          </div>
          <span className="text-[10px] text-slate-500">
            {riskLevel ? String(riskLevel).toUpperCase() : 'N/A'}
          </span>
        </div>
        <RiskSphere3D riskLevel={riskLevel} riskScore={riskScore} />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Risk Score', val: riskScore ? `${riskScore}/10` : '—', icon: Activity, color: 'text-brand-400', desc: riskLevel?.toUpperCase() || 'N/A' },
          { label: 'Total Findings', val: findings.length, icon: AlertTriangle, color: 'text-orange-400', desc: `${Object.keys(typeCounts).length} types` },
          { label: 'Critical', val: riskDist.critical, icon: Zap, color: 'text-red-400', desc: 'Immediate action' },
          { label: 'Sessions', val: sessions.length, icon: Database, color: 'text-blue-400', desc: 'Analysis history' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.val}</p>
            <p className="text-xs text-slate-600 mt-0.5">{kpi.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Risk Distribution Heatmap */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-white">Risk Distribution</span>
          </div>
          <div className="space-y-3">
            {Object.entries(riskDist).map(([level, count]) => {
              const pct = Math.round((count / totalFindings) * 100)
              return (
                <div key={level}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`capitalize font-medium ${RISK_BG[level]?.split(' ')[2] || 'text-slate-400'}`}>{level}</span>
                    <span className="text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: RISK_COLORS_HEX[level] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Finding Types Heatmap */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">Finding Types</span>
          </div>
          {typeEntries.length === 0 ? (
            <p className="text-sm text-slate-600 text-center mt-8">Run an analysis to see finding types</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {typeEntries.slice(0, 10).map(([type, count]) => {
                const risk = findings.find(f => f.type === type)?.risk || 'low'
                const intensity = Math.min(count / Math.max(...Object.values(typeCounts)), 1)
                return (
                  <div key={type}
                    className={`rounded-lg px-2.5 py-2 border text-xs font-medium transition-all ${RISK_BG[risk] || 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    style={{ opacity: 0.6 + intensity * 0.4 }}>
                    <div className="flex items-center justify-between">
                      <span className="truncate">{type.replace(/_/g, ' ')}</span>
                      <span className="font-bold ml-1">{count}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Risk Trend Chart */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-brand-400" />
          <h3 className="font-semibold text-white text-sm">Risk Trend (Last Sessions)</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={riskTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} />
              <YAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid #243447', borderRadius: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v) => `${Number(v).toFixed(0)}`}
              />
              <Line
                type="monotone"
                dataKey="risk_score"
                stroke="#4f46e5"
                strokeWidth={2.2}
                dot={{ r: 3, fill: '#6366f1', stroke: 'transparent' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Session History */}
      {sessions.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-white">Analysis History</span>
          </div>
          {/* Mini bar chart of risk scores */}
          <div className="flex items-end gap-1.5 h-20 mb-4">
            {last10Sessions.map((s, i) => {
              const height = Math.max((s.risk_score / 10) * 100, 8)
              const color = RISK_COLORS_HEX[s.risk_level] || '#64748b'
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="flex-1 w-full flex items-end">
                    <div className="w-full rounded-t-sm transition-all duration-700"
                      style={{ height: `${height}%`, backgroundColor: color, opacity: 0.8 }} />
                  </div>
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {s.risk_level} ({s.risk_score}/10)
                  </div>
                </div>
              )
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left pb-2">Type</th>
                  <th className="text-left pb-2">Risk</th>
                  <th className="text-left pb-2">Score</th>
                  <th className="text-left pb-2">Action</th>
                  <th className="text-left pb-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {sessions.slice(0, 8).map(s => (
                  <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2 text-slate-400 capitalize">{s.input_type}</td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${RISK_BG[s.risk_level] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {s.risk_level}
                      </span>
                    </td>
                    <td className={`py-2 font-bold ${RISK_COLORS_HEX[s.risk_level] ? 'text-' : 'text-slate-400'}`}
                      style={{ color: RISK_COLORS_HEX[s.risk_level] || undefined }}>
                      {s.risk_score}/10
                    </td>
                    <td className="py-2 text-slate-500 capitalize">{s.action}</td>
                    <td className="py-2 text-slate-600">
                      {new Date(s.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Correlation */}
      {correlation?.correlations?.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">AI Correlation Analysis</span>
          </div>
          {correlation.attack_chain && (
            <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-slate-300">
              {correlation.attack_chain}
            </div>
          )}
          <div className="space-y-2">
            {correlation.correlations.slice(0, 4).map((c, i) => (
              <div key={i} className="bg-slate-800/40 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-300 capitalize">{c.type?.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-purple-400">{Math.round((c.confidence || 0) * 100)}% confidence</span>
                </div>
                <p className="text-xs text-slate-500">{c.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {findings.length === 0 && sessions.length === 0 && (
        <div className="card p-10 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-700 mb-4" />
          <p className="text-slate-500 text-sm">Run an analysis to see the risk dashboard</p>
        </div>
      )}
    </div>
  )
}
