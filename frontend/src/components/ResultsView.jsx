import { useState } from 'react'
import { ShieldCheck, ShieldAlert, ShieldX, List, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import RiskBadge from './RiskBadge'

const ACTION_CONFIG = {
  masked:  { icon: ShieldCheck, label: 'Masked',  cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  blocked: { icon: ShieldX,     label: 'Blocked', cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
  allowed: { icon: ShieldCheck, label: 'Allowed', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
}

export default function ResultsView({ findings = [], action, processedContent, maskedCount }) {
  const [expanded, setExpanded] = useState(null)
  const [copied, setCopied]     = useState(false)
  const [showContent, setShowContent] = useState(false)

  const actionCfg = ACTION_CONFIG[action] || ACTION_CONFIG.allowed
  const ActionIcon = actionCfg.icon

  const sorted = [...findings].sort((a, b) => (b.score || 0) - (a.score || 0))

  const copyContent = () => {
    navigator.clipboard.writeText(processedContent || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (findings.length === 0 && !processedContent) return null

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Action Banner */}
      <div className={`flex items-center gap-3 p-4 rounded-2xl border ${actionCfg.cls}`}>
        <ActionIcon className="w-5 h-5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-white">Policy Action: <span className="capitalize">{action}</span></p>
          {action === 'masked' && maskedCount > 0 && (
            <p className="text-xs opacity-70 mt-0.5">{maskedCount} sensitive value(s) redacted from output</p>
          )}
          {action === 'blocked' && (
            <p className="text-xs opacity-70 mt-0.5">Content withheld — high risk level detected</p>
          )}
          {action === 'allowed' && (
            <p className="text-xs opacity-70 mt-0.5">No masking required — content passed policy checks</p>
          )}
        </div>
      </div>

      {/* Findings Table */}
      {sorted.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-800">
            <List className="w-4 h-4 text-brand-400" />
            <h4 className="font-semibold text-white text-sm">Findings</h4>
            <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
              {sorted.length}
            </span>
          </div>
          <div className="divide-y divide-slate-800">
            {sorted.map((finding, i) => {
              const isOpen = expanded === i
              return (
                <div key={i}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
                  >
                    <span className="text-xs text-slate-600 font-mono w-8 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-slate-200 font-medium">{finding.type}</span>
                        {finding.line && (
                          <span className="text-xs text-slate-500">Line {finding.line}</span>
                        )}
                      </div>
                    </div>
                    <RiskBadge level={finding.risk} showDot={false} />
                    <span className="text-xs text-slate-500 font-mono w-8 text-right">{finding.score || '-'}</span>
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 pt-1 bg-slate-900/50 border-t border-slate-800/50 animate-slide-up">
                      <p className="text-sm text-slate-400">{finding.description || 'No description available'}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Processed Content */}
      {processedContent && action !== 'blocked' && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-white text-sm">Processed Output</h4>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowContent(!showContent)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
                {showContent ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {showContent ? 'Hide' : 'Show'}
              </button>
              <button onClick={copyContent}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg transition-all">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          {showContent && (
            <pre className="font-mono text-xs text-slate-300 bg-slate-900 rounded-xl p-4 overflow-auto max-h-64
                           border border-slate-800 whitespace-pre-wrap animate-slide-up leading-relaxed">
              {processedContent}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
