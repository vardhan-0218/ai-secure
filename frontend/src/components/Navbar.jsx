import { Shield, LogOut, User, Activity, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Navbar({ activeSession, minimal = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Minimal mode: just user badge + logout (for embedding in custom headers)
  if (minimal) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-xl">
          <div className="w-6 h-6 rounded-full bg-brand-600/30 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <div>
            <p className="text-xs text-white font-medium leading-none">{user?.email?.split('@')[0]}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-xl transition-all text-sm border border-transparent hover:border-red-500/20">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block">Logout</span>
        </button>
      </div>
    )
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-lg">AI Secure</span>
            <span className="hidden sm:block text-slate-500 text-sm">
              <ChevronRight className="inline w-3 h-3" /> Data Intelligence Platform
            </span>
          </div>
        </div>

        {/* Center — live indicator */}
        {activeSession && (
          <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20
                          text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            Analysis Active
          </div>
        )}

        {/* Right — user */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/50
                          px-3 py-1.5 rounded-xl">
            <div className="w-6 h-6 rounded-full bg-brand-600/30 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-brand-400" />
            </div>
            <div className="text-right">
              <p className="text-xs text-white font-medium leading-none">{user?.email?.split('@')[0]}</p>
              <p className="text-[10px] text-slate-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10
                       px-3 py-1.5 rounded-xl transition-all text-sm border border-transparent
                       hover:border-red-500/20">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
