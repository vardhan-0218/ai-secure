import { useMemo } from 'react'

const RISK_COLORS = {
  critical: 'bg-red-500 shadow-red-500/40 text-red-400 border-red-500/20',
  high:     'bg-orange-500 shadow-orange-500/40 text-orange-400 border-orange-500/20',
  medium:   'bg-yellow-500 shadow-yellow-500/40 text-yellow-400 border-yellow-500/20',
  low:      'bg-blue-500 shadow-blue-500/40 text-blue-400 border-blue-500/20',
  clean:    'bg-emerald-500 shadow-emerald-500/40 text-emerald-400 border-emerald-500/20',
}

const getRelativeTime = (isoString) => {
  if (!isoString) return 'Just now'
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export default function TimelineFlow3D({ events = [], heightClassName = 'h-72' }) {
  const limitedEvents = useMemo(() => {
    if (!Array.isArray(events)) return []
    return events.slice(0, 10) // Show up to 10 events
  }, [events])

  const headerRiskColor = limitedEvents?.[0]?.risk || 'clean'
  const headerColorClass = (RISK_COLORS[headerRiskColor] || RISK_COLORS.clean).split(' ')[0]

  return (
    <div className="card p-4 relative flex flex-col h-full bg-slate-900/50">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full ${headerColorClass} shadow-[0_0_8px_currentColor]`} />
        <h3 className="font-semibold text-white text-sm">Timeline Flow</h3>
        <span className="ml-auto text-[10px] text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded-full border border-slate-700/50 font-medium">
          {limitedEvents.length} nodes
        </span>
      </div>

      <div className={`w-full ${heightClassName} overflow-y-auto pr-2 flex flex-col custom-scrollbar relative`}>
        {/* Subtle background line for the whole timeline track */}
        {limitedEvents.length > 0 && (
          <div className="absolute left-[9px] top-3 bottom-8 w-[1px] bg-slate-800/60 rounded-full" />
        )}

        {limitedEvents.map((e, idx) => {
          const riskStyle = RISK_COLORS[e.risk || 'clean'] || RISK_COLORS.clean
          const [bgColor, shadowColor, textColor, borderColor] = riskStyle.split(' ')

          return (
            <div key={idx} className="relative pl-7 group mb-3 last:mb-0 shrink-0">
              {/* Vertical line connecting nodes - layered above the subtle background line */}
              {idx !== limitedEvents.length - 1 && (
                <div className="absolute left-[9px] top-[14px] w-[2px] h-[calc(100%+8px)] bg-slate-800 group-hover:bg-slate-700 transition-colors z-[1]" />
              )}
              
              {/* Node indicator */}
              <div 
                className={`absolute left-1 top-1.5 w-[12px] h-[12px] rounded-full border-[2.5px] border-slate-900 ${bgColor} ${shadowColor} shadow-md z-10 transition-transform group-hover:scale-125 duration-300 ring-2 ring-transparent group-hover:ring-${bgColor.replace('bg-', '')}/30`} 
              />
              
              <div className={`px-3 py-2.5 rounded-xl border bg-slate-800/40 backdrop-blur-sm transition-all hover:bg-slate-800/80 ${borderColor} hover:shadow-lg hover:translate-x-0.5 duration-300`}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight">
                    {e.label || 'Event'}
                  </h4>
                  <span className={`text-[9px] whitespace-nowrap font-semibold uppercase tracking-wider ${textColor}`}>
                    {getRelativeTime(e.time)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  {e.description || e.type}
                </p>
                {e.line && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[9px] text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded-md border border-slate-700/80 shadow-inner">
                    <span className="font-mono text-slate-300">L:{e.line}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {limitedEvents.length === 0 && (
           <div className="h-full flex items-center justify-center text-xs text-slate-500 font-medium">
             No recent events
           </div>
        )}
      </div>
      
      {/* Global custom scrollbar style injected via inline style for localized fix */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #475569;
        }
      `}} />
    </div>
  )
}
