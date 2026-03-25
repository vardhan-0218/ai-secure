import { Clock, Shield, AlertTriangle, Search, Code } from 'lucide-react'
import RiskBadge from './RiskBadge'

const TYPE_ICONS = {
  finding:       Shield,
  attack_pattern: AlertTriangle,
  login:         Search,
  sql:           Code,
}

const TYPE_LABELS = {
  finding:        'Finding',
  attack_pattern: 'Attack Pattern',
}

export default function Timeline({ events = [] }) {
  if (!events.length) {
    return (
      <div className="card p-10 text-center">
        <Clock className="w-10 h-10 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">No timeline data yet. Run an analysis to see events.</p>
      </div>
    )
  }

  const grouped = groupByMinute(events)

  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-5">
        <Clock className="w-4 h-4 text-brand-400" />
        <h3 className="font-semibold text-white text-sm">Risk Timeline</h3>
        <span className="ml-auto text-xs text-slate-500">{events.length} events</span>
      </div>

      <div className="space-y-4">
        {grouped.map(({ minute, items }) => (
          <div key={minute}>
            {/* Time marker */}
            <div className="flex items-center gap-3 mb-2">
              <div className="text-xs text-slate-600 font-mono w-16 text-right">{minute}</div>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Events in minute */}
            <div className="space-y-2 pl-20">
              {items.map((event, i) => {
                const Icon = TYPE_ICONS[event.type] || Shield
                return (
                  <div key={i}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all
                      ${event.type === 'attack_pattern'
                        ? 'bg-red-500/5 border-red-500/20'
                        : 'bg-slate-800/40 border-slate-700/40'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                      ${event.risk === 'critical' ? 'bg-red-500/15'
                        : event.risk === 'high' ? 'bg-orange-500/15'
                        : event.risk === 'medium' ? 'bg-yellow-500/15'
                        : 'bg-emerald-500/15'}`}>
                      <Icon className={`w-3.5 h-3.5
                        ${event.risk === 'critical' ? 'text-red-400'
                          : event.risk === 'high' ? 'text-orange-400'
                          : event.risk === 'medium' ? 'text-yellow-400'
                          : 'text-emerald-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-medium text-slate-200">{event.label}</span>
                        <RiskBadge level={event.risk} showDot={false} />
                        {event.line && (
                          <span className="text-[10px] text-slate-600">Line {event.line}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed truncate">{event.description}</p>
                    </div>
                    <span className="text-[10px] text-slate-700 font-mono shrink-0">
                      {new Date(event.time).toLocaleTimeString([], { timeStyle: 'medium' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function groupByMinute(events) {
  const grouped = {}
  events.forEach(e => {
    const d = new Date(e.time)
    const key = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(e)
  })
  return Object.entries(grouped).map(([minute, items]) => ({ minute, items }))
}
