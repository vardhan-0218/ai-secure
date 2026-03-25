import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Lock, Mail, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [tab, setTab]           = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('user')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const { login, register }     = useAuth()
  const navigate                = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(email, password)
      } else {
        await register(email, password, role)
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900/30
                      flex-col items-center justify-center p-16 relative overflow-hidden">
        {/* Decorative glows */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-brand-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-60 h-60 bg-emerald-600/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-md text-center">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-brand-600/20 border border-brand-500/30
                           flex items-center justify-center shadow-2xl shadow-brand-900/50">
              <Shield className="w-10 h-10 text-brand-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            AI Secure<br />
            <span className="text-brand-400">Data Intelligence</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-10">
            Enterprise-grade security scanning, log analysis, and AI-powered risk assessment in one platform.
          </p>

          {/* Feature pills */}
          {[
            { icon: '🔍', label: 'Sensitive Data Detection' },
            { icon: '📋', label: 'Log Security Analysis' },
            { icon: '🤖', label: 'AI-Powered Insights' },
            { icon: '⚡', label: 'Real-time Risk Scoring' },
          ].map((f) => (
            <div key={f.label}
              className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50
                         rounded-xl px-4 py-3 mb-3 text-left">
              <span className="text-xl">{f.icon}</span>
              <span className="text-slate-300 font-medium">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-950">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <Shield className="w-8 h-8 text-brand-400" />
            <span className="text-xl font-bold text-white">AI Secure</span>
          </div>

          <div className="card p-8">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-800 rounded-xl mb-8">
              {['login', 'register'].map((t) => (
                <button key={t} onClick={() => { setTab(t); setError('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                    tab === t ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                  }`}>
                  {t === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">
              {tab === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              {tab === 'login'
                ? 'Sign in to access your security dashboard'
                : 'Start securing your data with AI-powered analysis'}
            </p>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30
                              text-red-400 rounded-xl px-4 py-3 mb-5 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input id="email" type="email" value={email} required
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10"
                    placeholder="you@company.com" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input id="password" type={showPwd ? 'text' : 'password'}
                    value={password} required minLength={8}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10 pr-10"
                    placeholder={tab === 'register' ? 'Min 8 chars, uppercase + number' : 'Your password'} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role (register only) */}
              {tab === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Account Role</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <select value={role} onChange={(e) => setRole(e.target.value)}
                      className="input-field pl-10 appearance-none">
                      <option value="user">User — Standard access</option>
                      <option value="admin">Admin — Full access</option>
                    </select>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-6">
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {loading ? 'Authenticating...' : (tab === 'login' ? 'Sign In Securely' : 'Create Account')}
              </button>
            </form>

            {tab === 'login' && (
              <p className="text-center text-slate-500 text-xs mt-6">
                Demo: <span className="text-slate-400 font-mono">admin@aisecure.dev</span> / <span className="text-slate-400 font-mono">Admin1234!</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
