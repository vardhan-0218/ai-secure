import { useMemo } from 'react'

const RISK_COLORS = {
  critical: { base: 'bg-red-500', shadow: 'shadow-red-500/50', border: 'border-red-500/30', text: 'text-red-400' },
  high:     { base: 'bg-orange-500', shadow: 'shadow-orange-500/50', border: 'border-orange-500/30', text: 'text-orange-400' },
  medium:   { base: 'bg-yellow-500', shadow: 'shadow-yellow-500/50', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  low:      { base: 'bg-blue-500', shadow: 'shadow-blue-500/50', border: 'border-blue-500/30', text: 'text-blue-400' },
  clean:    { base: 'bg-emerald-500', shadow: 'shadow-emerald-500/50', border: 'border-emerald-500/30', text: 'text-emerald-400' },
}

export default function RiskSphere3D({
  riskLevel = 'clean',
  riskScore = 0,
  heightClassName = 'h-56',
  showHeader = false,
  title = 'Risk Assessment',
}) {
  const theme = RISK_COLORS[riskLevel] || RISK_COLORS.clean
  const score = Math.round(Number(riskScore) || 0)

  const orb = (
    <div
      className={`w-full ${heightClassName} relative flex items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-900/40 overflow-hidden isolate`}
      aria-label="2D risk sphere visualization"
    >
      {/* Background glow radial */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 ${theme.base}`} />

      {/* Outer rings */}
      <div className="absolute w-44 h-44 rounded-full border border-slate-700/30 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] animate-[spin_15s_linear_infinite]" />
      <div className="absolute w-36 h-36 rounded-full border border-dashed border-slate-600/30 animate-[spin_20s_linear_infinite_reverse]" />
      
      {/* Inner tick ring */}
      <div className={`absolute w-[104px] h-[104px] rounded-full border border-dashed opacity-40 animate-[spin_30s_linear_infinite] ${theme.border}`} />

      {/* The Orb / Gauge */}
      <div className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center bg-slate-900 shadow-xl ${theme.shadow} border ${theme.border} transform transition-all hover:scale-105 duration-500 group-hover:shadow-[0_0_30px_rgba(var(--opacity),0.5)]`}>
        {/* Inner subtle glow */}
        <div className={`absolute inset-0 rounded-full opacity-10 ${theme.base}`} />
        
        {/* Value */}
        <span className={`text-3xl font-extrabold tracking-tight ${theme.text} drop-shadow-md z-10`}>
          {score}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5 font-medium z-10">
          {riskLevel}
        </span>
      </div>
    </div>
  )

  if (!showHeader) return orb

  return (
    <div className="card p-4 relative overflow-hidden flex flex-col h-full bg-slate-900/50">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full ${theme.base} shadow-[0_0_8px_currentColor]`} />
        <h3 className="font-semibold text-white text-sm">{title}</h3>
        <span className="ml-auto text-[10px] text-slate-500 font-medium px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/50">
          {score} score
        </span>
      </div>
      <div>{orb}</div>
    </div>
  )
}
