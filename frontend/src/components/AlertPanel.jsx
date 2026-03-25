import { useState, useEffect } from 'react'
import { Bell, X, Check, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import api from '../services/api'

const CONFIG = {
  critical: { Icon: AlertTriangle, cls: 'border-red-500/40 bg-red-500/10',    iconCls: 'text-red-400',    label: 'Critical' },
  high:     { Icon: AlertCircle,   cls: 'border-orange-500/40 bg-orange-500/10', iconCls: 'text-orange-400', label: 'High' },
  medium:   { Icon: Info,          cls: 'border-yellow-500/40 bg-yellow-500/8',  iconCls: 'text-yellow-400', label: 'Medium' },
  low:      { Icon: Info,          cls: 'border-slate-700 bg-slate-800/50',      iconCls: 'text-slate-400',  label: 'Info' },
}

// Toast-notification layer (top-right)
export function AlertToasts({ toasts, onDismiss }) {
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none" style={{ maxWidth: '360px' }}>
      {toasts.map(t => {
        const cfg = CONFIG[t.severity] || CONFIG.low
        const Icon = cfg.Icon
        return (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-2xl animate-slide-up backdrop-blur-sm ${cfg.cls}`}>
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconCls}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white mb-0.5">{cfg.label} Alert</p>
              <p className="text-xs text-slate-300 leading-relaxed">{t.message}</p>
            </div>
            <button onClick={() => onDismiss(t.id)}
              className="text-slate-500 hover:text-slate-300 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Bell icon for Navbar
export function AlertBell({ count, onClick }) {
  return (
    <button onClick={onClick}
      className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all">
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px]
                         flex items-center justify-center rounded-full font-bold animate-pulse">
          {Math.min(count, 9)}
        </span>
      )}
    </button>
  )
}

// Full alert panel (for a popover / page section)
export default function AlertPanel({ onCountChange }) {
  const [alerts, setAlerts]     = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetchAlerts()
  }, [])

  async function fetchAlerts() {
    try {
      const { data } = await api.get('/alerts?limit=30')
      setAlerts(data.alerts || [])
      onCountChange?.(data.unreadCount || 0)
    } catch (err) {
      // no-op
    } finally {
      setLoading(false)
    }
  }

  async function markRead(id) {
    try {
      await api.patch(`/alerts/${id}/read`)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
      onCountChange?.(alerts.filter(a => !a.is_read && a.id !== id).length)
    } catch {}
  }

  async function markAllRead() {
    try {
      await api.patch('/alerts/read-all')
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
      onCountChange?.(0)
    } catch {}
  }

  const unread = alerts.filter(a => !a.is_read).length

  if (loading) return (
    <div className="card p-8 text-center">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="flex items-center gap-3 p-4 border-b border-slate-800">
        <Bell className="w-4 h-4 text-brand-400" />
        <h3 className="font-semibold text-white text-sm">Security Alerts</h3>
        {unread > 0 && (
          <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
            {unread} unread
          </span>
        )}
        {unread > 0 && (
          <button onClick={markAllRead}
            className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <Check className="w-3 h-3" /> Mark all read
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="p-10 text-center">
          <Bell className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No alerts yet. Alerts will appear here after high-risk analyses.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800 max-h-[500px] overflow-auto">
          {alerts.map(alert => {
            const cfg = CONFIG[alert.severity] || CONFIG.low
            const Icon = cfg.Icon
            return (
              <div key={alert.id}
                className={`flex items-start gap-3 p-4 transition-colors
                  ${alert.is_read ? 'opacity-60' : `${cfg.cls.split(' ')[1]}`}`}>
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconCls}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold ${cfg.iconCls}`}>{cfg.label}</span>
                    <span className="text-[10px] text-slate-600">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
                </div>
                {!alert.is_read && (
                  <button onClick={() => markRead(alert.id)}
                    className="shrink-0 text-slate-600 hover:text-brand-400 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
