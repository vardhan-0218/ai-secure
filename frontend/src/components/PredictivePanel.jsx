import { TrendingUp, AlertTriangle, Target, Shield, Zap, Clock, ChevronRight } from 'lucide-react'

const LIKELIHOOD_COLORS = {
  high:   'text-red-400 bg-red-500/10 border-red-500/30',
  medium: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  low:    'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
}

const URGENCY_CONFIG = {
  immediate: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: Zap },
  high:      { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: AlertTriangle },
  medium:    { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: TrendingUp },
  low:       { color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700', icon: Shield },
}

export default function PredictivePanel({ predictions = [], threatTrajectory, attackStage, blastRadius, urgency, confidence }) {
  if (!predictions.length && !threatTrajectory) return null

  const cfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.medium
  const UrgencyIcon = cfg.icon

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header: Threat Trajectory */}
      {(threatTrajectory || attackStage) && (
        <div className={`card p-4 border ${cfg.bg}`}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-900 shrink-0">
              <UrgencyIcon className={`w-4 h-4 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-sm font-semibold text-white">Threat Trajectory</h3>
                {attackStage && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${LIKELIHOOD_COLORS[urgency] || 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                    {attackStage.replace(/_/g, ' ').toUpperCase()}
                  </span>
                )}
                {confidence > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 ml-auto">
                    {Math.round(confidence * 100)}% confidence
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{threatTrajectory}</p>
            </div>
          </div>
        </div>
      )}

      {/* Predictions List */}
      {predictions.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-slate-800">
            <Target className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">AI Predicted Next Threats</span>
            <span className="ml-auto text-xs text-slate-600">{predictions.length} prediction{predictions.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {predictions.map((pred, i) => {
              const lhCfg = LIKELIHOOD_COLORS[pred.likelihood] || 'text-slate-400 bg-slate-800 border-slate-700'
              return (
                <div key={i} className="p-4 hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-xs font-bold text-slate-400">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-white">{pred.threat}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${lhCfg}`}>
                          {pred.likelihood} likelihood
                        </span>
                        {pred.timeframe && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock className="w-2.5 h-2.5" />{pred.timeframe}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-2">{pred.explanation}</p>
                      {pred.attack_vector && (
                        <div className="text-xs text-slate-500 bg-slate-800/60 rounded px-2 py-1 mb-2">
                          <span className="text-slate-400 font-medium">Vector:</span> {pred.attack_vector}
                        </div>
                      )}
                      {pred.mitigations?.length > 0 && (
                        <div className="space-y-1">
                          {pred.mitigations.slice(0, 2).map((m, mi) => (
                            <div key={mi} className="flex items-start gap-1.5 text-xs text-emerald-400">
                              <Shield className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>{m}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Blast Radius */}
      {blastRadius && (blastRadius.affected_systems?.length > 0 || blastRadius.potential_data_loss) && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-white">Blast Radius (If Unaddressed)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            {blastRadius.affected_systems?.length > 0 && (
              <div>
                <p className="text-slate-500 mb-1 font-medium">Affected Systems</p>
                <ul className="space-y-0.5">
                  {blastRadius.affected_systems.map((s, i) => (
                    <li key={i} className="flex items-center gap-1 text-slate-300">
                      <ChevronRight className="w-3 h-3 text-slate-600" />{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {blastRadius.potential_data_loss && (
              <div>
                <p className="text-slate-500 mb-1 font-medium">Data at Risk</p>
                <p className="text-red-300">{blastRadius.potential_data_loss}</p>
              </div>
            )}
            {blastRadius.business_impact && (
              <div>
                <p className="text-slate-500 mb-1 font-medium">Business Impact</p>
                <p className="text-orange-300">{blastRadius.business_impact}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
