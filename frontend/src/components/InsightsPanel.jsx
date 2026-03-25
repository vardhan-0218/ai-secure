import { Brain, Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Zap, Clock } from 'lucide-react'

const RISK_GLOW = {
  critical: 'shadow-red-500/20',
  high:     'shadow-orange-500/20',
  medium:   'shadow-yellow-500/10',
  low:      'shadow-blue-500/10',
  clean:    '',
}

const RISK_RING = {
  critical: 'border-red-500/50',
  high:     'border-orange-500/50',
  medium:   'border-yellow-500/50',
  low:      'border-blue-500/50',
  clean:    'border-emerald-500/50',
}

export default function InsightsPanel({ summary, insights, riskLevel, riskScore, riskSummary, stats, rootCause, fixSuggestions, anomalies, confidence }) {
  const ring = RISK_RING[riskLevel] || 'border-slate-700'
  const glow = RISK_GLOW[riskLevel] || ''
  const scoreColor = riskScore >= 8 ? 'text-red-400' : riskScore >= 6 ? 'text-orange-400' : riskScore >= 3 ? 'text-yellow-400' : 'text-emerald-400'

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Risk Score Card */}
      <div className={`card p-5 border ${ring} shadow-lg ${glow}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-brand-400" />
            <span className="font-semibold text-white">AI Risk Assessment</span>
          </div>
          {confidence > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {Math.round(confidence * 100)}% confidence
            </span>
          )}
        </div>

        <div className="flex items-center gap-5 mb-4">
          <div className="relative">
            <svg viewBox="0 0 64 64" className="w-20 h-20 -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" className="text-slate-800" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none" strokeWidth="6"
                stroke={riskScore >= 8 ? '#ef4444' : riskScore >= 6 ? '#f97316' : riskScore >= 3 ? '#eab308' : '#10b981'}
                strokeLinecap="round"
                strokeDasharray={`${(riskScore / 10) * 163} 163`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${scoreColor}`}>{riskScore}</span>
              <span className="text-[9px] text-slate-500 font-medium">/10</span>
            </div>
          </div>
          <div>
            <p className={`text-lg font-bold uppercase tracking-wider ${scoreColor}`}>{riskLevel}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stats?.totalFindings || 0} findings detected</p>
            {stats?.aiMode && (
              <p className="text-[10px] text-brand-400 mt-1">Mode: {stats.aiMode}</p>
            )}
          </div>
        </div>

        {riskSummary && (
          <div className="text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2 leading-relaxed">
            {riskSummary}
          </div>
        )}
      </div>

      {/* AI Summary */}
      {summary && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-white">AI Executive Summary</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Root Cause */}
      {rootCause && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">Root Cause Analysis</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{rootCause}</p>
        </div>
      )}

      {/* Fix Suggestions */}
      {fixSuggestions?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-slate-800">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">AI Fix Recommendations</span>
          </div>
          <div className="p-4 space-y-3">
            {fixSuggestions.map((fix, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 mt-0.5
                  ${fix.priority === 'immediate' ? 'bg-red-500/20 text-red-400' :
                    fix.priority === 'short_term' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-blue-500/20 text-blue-400'}`}>
                  {fix.priority?.replace('_', ' ').toUpperCase() || 'FIX'}
                </span>
                <div>
                  <p className="text-sm text-slate-300">{fix.action}</p>
                  {fix.code_example && (
                    <code className="text-[10px] font-mono text-emerald-400 bg-slate-900 rounded px-2 py-1 block mt-1">
                      {fix.code_example}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy insights array (backward compat) */}
      {!fixSuggestions?.length && insights?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-slate-800">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">AI Insights</span>
          </div>
          <ul className="p-4 space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-brand-400 shrink-0">›</span>
                <span>{typeof insight === 'string' ? insight : insight.action || JSON.stringify(insight)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Anomalies */}
      {anomalies?.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">Anomalies Detected</span>
          </div>
          <div className="space-y-2">
            {anomalies.map((a, i) => (
              <div key={i} className={`text-xs px-3 py-2 rounded-lg flex items-start gap-2
                ${a.severity === 'high' ? 'bg-red-500/8 text-red-300' :
                  a.severity === 'medium' ? 'bg-orange-500/8 text-orange-300' :
                  'bg-yellow-500/8 text-yellow-300'}`}>
                <span className="shrink-0">⚠</span>
                <span>{typeof a === 'string' ? a : `${a.type}: ${a.description}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats footer */}
      {stats && (
        <div className="card p-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'Processing Time', value: `${stats.processingMs || 0}ms` },
              { label: 'AI Mode', value: stats.aiMode || 'AI' },
              { label: 'Confidence', value: confidence ? `${Math.round(confidence * 100)}%` : 'N/A' },
              { label: 'Content Size', value: stats.contentLength ? `${(stats.contentLength / 1024).toFixed(1)}KB` : 'N/A' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                <span className="text-slate-500">{s.label}</span>
                <span className="text-slate-300 font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
