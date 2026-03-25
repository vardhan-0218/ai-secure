import { useState } from 'react'
import { Wrench, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import RiskBadge from './RiskBadge'

export default function FixSuggestions({ findings = [] }) {
  const [expanded, setExpanded] = useState(null)

  const topFindings = findings
    .filter(f => f.fixSuggestions?.length > 0)
    .slice(0, 10)

  if (topFindings.length === 0) return null

  return (
    <div className="card overflow-hidden animate-slide-up">
      <div className="flex items-center gap-2 p-4 border-b border-slate-800">
        <Wrench className="w-4 h-4 text-emerald-400" />
        <h4 className="font-semibold text-white text-sm">Fix Suggestions</h4>
        <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
          {topFindings.length} issues
        </span>
      </div>

      <div className="divide-y divide-slate-800">
        {topFindings.map((finding, i) => {
          const isOpen = expanded === i
          return (
            <div key={i}>
              <button onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-slate-800/30 transition-colors text-left">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center mt-0.5 shrink-0
                  ${finding.risk === 'critical' ? 'bg-red-500/15' : finding.risk === 'high' ? 'bg-orange-500/15' : 'bg-yellow-500/15'}`}>
                  <AlertTriangle className={`w-3 h-3
                    ${finding.risk === 'critical' ? 'text-red-400' : finding.risk === 'high' ? 'text-orange-400' : 'text-yellow-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-sm font-medium text-slate-200">{finding.type}</span>
                    <RiskBadge level={finding.risk} showDot={false} />
                  </div>
                  <p className="text-xs text-slate-500 truncate">{finding.rootCause?.split('.')[0]}.</p>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-600 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-600 shrink-0 mt-1" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 bg-slate-900/40 border-t border-slate-800/50 animate-slide-up">
                  {/* Root cause */}
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Root Cause</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{finding.rootCause}</p>
                  </div>
                  {/* Fixes */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Remediation Steps</p>
                    <ol className="space-y-2">
                      {finding.fixSuggestions.map((fix, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400
                                           flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-slate-300 leading-relaxed">{fix}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
