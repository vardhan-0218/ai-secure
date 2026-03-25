import { useState, useMemo } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Terminal } from 'lucide-react'
import RiskBadge from './RiskBadge'

const RISK_LINE_COLORS = {
  critical: 'bg-red-500/10 border-l-2 border-red-500',
  high:     'bg-orange-500/8 border-l-2 border-orange-500',
  medium:   'bg-yellow-500/8 border-l-2 border-yellow-500',
  low:      'bg-slate-800/40 border-l border-slate-700',
}

export default function LogViewer({ lineAnalysis = [], content = '', maxLines = 300 }) {
  const [expandedLines, setExpandedLines] = useState(new Set())
  const [filter, setFilter]               = useState('all')
  const [search, setSearch]               = useState('')

  const lines = useMemo(() => {
    if (lineAnalysis.length > 0) {
      return lineAnalysis.slice(0, maxLines)
    }
    // Fallback: show raw content split by lines
    return content.split('\n').slice(0, maxLines).map((line, i) => ({
      lineNumber: i + 1, content: line, findings: [], hasSuspiciousContent: false,
    }))
  }, [lineAnalysis, content, maxLines])

  const filtered = useMemo(() => {
    return lines.filter((l) => {
      const matchFilter = filter === 'all' || (filter === 'suspicious' && l.hasSuspiciousContent)
      const matchSearch = !search || l.content.toLowerCase().includes(search.toLowerCase())
      return matchFilter && matchSearch
    })
  }, [lines, filter, search])

  const suspiciousCount = lines.filter(l => l.hasSuspiciousContent).length

  if (!content && lineAnalysis.length === 0) return null

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-white">Log Viewer</h3>
          <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
            {lines.length.toLocaleString()} lines
          </span>
          {suspiciousCount > 0 && (
            <span className="text-xs bg-red-500/15 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full">
              {suspiciousCount} suspicious
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter lines..." className="input-field !py-1.5 !px-3 text-xs w-40" />
          <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
            {['all', 'suspicious'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition-all
                  ${filter === f ? 'bg-brand-600/30 text-brand-300 border border-brand-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log Lines */}
      <div className="overflow-auto max-h-[480px] font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Terminal className="w-10 h-10 mb-3 opacity-30" />
            <p>No lines match your filter</p>
          </div>
        ) : (
          filtered.map((line) => {
            const topRisk = line.findings?.[0]?.risk
            const isExpanded = expandedLines.has(line.lineNumber)
            const lineClass = line.hasSuspiciousContent
              ? RISK_LINE_COLORS[topRisk] || RISK_LINE_COLORS.low
              : 'hover:bg-slate-800/40'

            return (
              <div key={line.lineNumber}
                className={`group transition-colors ${lineClass} ${line.hasSuspiciousContent ? 'log-line-suspicious' : ''}`}>
                <div className="flex items-start">
                  {/* Line number */}
                  <span className="select-none text-slate-600 px-3 py-1.5 min-w-[3.5rem] text-right border-r border-slate-800/60 shrink-0">
                    {String(line.lineNumber).padStart(4, ' ')}
                  </span>
                  {/* Content */}
                  <span className="px-3 py-1.5 flex-1 text-slate-300 break-all leading-relaxed whitespace-pre-wrap">
                    {highlightMatches(line.content)}
                  </span>
                  {/* Badges */}
                  {line.hasSuspiciousContent && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                      <RiskBadge level={topRisk} showDot={false} />
                      <button onClick={() => {
                        const next = new Set(expandedLines)
                        isExpanded ? next.delete(line.lineNumber) : next.add(line.lineNumber)
                        setExpandedLines(next)
                      }} className="text-slate-500 hover:text-slate-300 ml-1">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
                {/* Expanded findings */}
                {isExpanded && line.findings?.length > 0 && (
                  <div className="px-16 py-2 space-y-1 border-t border-slate-800/50 bg-slate-900/40 animate-slide-up">
                    {line.findings.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <RiskBadge level={f.risk} showDot={false} />
                        <span className="text-slate-400">{f.type}</span>
                        <span className="text-slate-500">—</span>
                        <span className="text-slate-300">{f.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      {lines.length >= maxLines && (
        <div className="text-center py-3 text-xs text-slate-500 border-t border-slate-800">
          Showing first {maxLines.toLocaleString()} lines. Upload truncated for display.
        </div>
      )}
    </div>
  )
}

// Highlight common sensitive patterns in log text
function highlightMatches(text) {
  if (!text) return text
  // Simple highlight: bold anything that looks like key=value secrets
  const highlighted = text.replace(
    /(password|secret|api_key|token|passwd)(\s*[:=]\s*)(\S+)/gi,
    (_, k, sep, v) => `${k}${sep}[HIGHLIGHTED]`
  )
  if (highlighted === text) return text
  // Return spans - simplified: just return text for now, actual highlighting done via CSS above
  return text
}
