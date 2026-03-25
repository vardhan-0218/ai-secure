const RISK_CONFIG = {
  critical: { cls: 'risk-badge-critical', label: 'Critical', dot: 'bg-red-400' },
  high:     { cls: 'risk-badge-high',     label: 'High',     dot: 'bg-orange-400' },
  medium:   { cls: 'risk-badge-medium',   label: 'Medium',   dot: 'bg-yellow-400' },
  low:      { cls: 'risk-badge-low',      label: 'Low',      dot: 'bg-emerald-400' },
}

export default function RiskBadge({ level, showDot = true, size = 'sm' }) {
  const cfg = RISK_CONFIG[level?.toLowerCase()] || RISK_CONFIG.low
  return (
    <span className={`inline-flex items-center gap-1.5 ${cfg.cls} ${size === 'md' ? 'px-3 py-1 text-sm' : ''}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse-slow`} />}
      {cfg.label}
    </span>
  )
}
