import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Shield, Eye, EyeOff, Lock, Mail, User, AlertCircle, Brain, Activity, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function LoginPage() {
  const [tab, setTab]           = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('user')
  const [showPwd, setShowPwd]   = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]       = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [passwordErr, setPasswordErr] = useState('')

  // Forgot password flow
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryStep, setRecoveryStep] = useState('request') // request | reset
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const { login, register, user, loading: authLoading }     = useAuth()
  const navigate                = useNavigate()
  const [searchParams]         = useSearchParams()

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    if (requestedTab === 'register') setTab('register')
  }, [searchParams])

  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard', { replace: true })
  }, [authLoading, user, navigate])

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

  const validateClient = () => {
    let ok = true
    setEmailErr('')
    setPasswordErr('')
    const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

    if (!email.trim()) {
      setEmailErr('Enter your email')
      ok = false
    } else if (!isValidEmail(email)) {
      setEmailErr('Email format is invalid')
      ok = false
    }

    if (!password.trim()) {
      setPasswordErr('Enter your password')
      ok = false
    } else if (tab === 'register' && !strongPwd.test(password)) {
      setPasswordErr('Use 8+ chars with upper/lowercase and a number')
      ok = false
    }

    if (!ok) setError('Please fix the highlighted fields.')
    return ok
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setEmailErr('')
    setPasswordErr('')

    if (!validateClient()) return

    setSubmitting(true)
    try {
      if (tab === 'login') {
        await login(email, password)
      } else {
        await register(email, password, role)
      }
      navigate('/dashboard')
    } catch (err) {
      const payload = err.response?.data
      const firstMsg = payload?.data?.errors?.[0]?.msg
      setError(payload?.error || firstMsg || 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

  const startRecovery = () => {
    setRecoveryOpen(true)
    setRecoveryError('')
    setRecoveryMessage('')
    setRecoveryStep('request')
    setResetToken('')
    setNewPassword('')
    setConfirmPassword('')
    setResetError('')
    setRecoveryEmail(email || '')
  }

  const submitRecoveryRequest = async (e) => {
    e.preventDefault()
    setRecoveryError('')
    setRecoveryMessage('')

    const em = recoveryEmail.trim()
    if (!em) {
      setRecoveryError('Enter your email')
      return
    }
    if (!isValidEmail(em)) {
      setRecoveryError('Email format is invalid')
      return
    }

    setRecoveryLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { email: em })
      setRecoveryMessage(data.message || 'Recovery instructions sent')
      setResetToken(data.resetToken || '')
      setRecoveryStep('reset')
    } catch (err) {
      const payload = err.response?.data
      setRecoveryError(payload?.error || payload?.message || 'Recovery request failed')
    } finally {
      setRecoveryLoading(false)
    }
  }

  const submitPasswordReset = async (e) => {
    e.preventDefault()
    setResetError('')

    const token = resetToken.trim()
    if (!token) {
      setResetError('Enter the reset token')
      return
    }
    if (!newPassword.trim()) {
      setResetError('Enter your new password')
      return
    }
    if (!strongPwd.test(newPassword)) {
      setResetError('Use 8+ chars with upper/lowercase and a number')
      return
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match')
      return
    }

    setResetLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword })
      setRecoveryOpen(false)
      setRecoveryStep('request')
      setRecoveryError('')
      setResetError('')
      setRecoveryMessage('')
      setResetToken('')
      setNewPassword('')
      setConfirmPassword('')
      setError('Password updated. Please sign in.')
      setTab('login')
    } catch (err) {
      const payload = err.response?.data
      setResetError(payload?.error || 'Reset failed')
    } finally {
      setResetLoading(false)
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

          {/* Feature highlights */}
          {[
            { icon: <Shield className="w-4 h-4 text-brand-400" />, label: 'Sensitive Data Detection' },
            { icon: <Activity className="w-4 h-4 text-emerald-400" />, label: 'Log Security Analysis' },
            { icon: <Brain className="w-4 h-4 text-slate-300" />, label: 'AI-Powered Insights' },
            { icon: <Sparkles className="w-4 h-4 text-orange-400" />, label: 'Real-time Risk Scoring' },
          ].map((f) => (
            <div key={f.label}
              className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50
                         rounded-xl px-4 py-3 mb-3 text-left">
              {f.icon}
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
                <button key={t} onClick={() => { setTab(t); setError(''); setEmailErr(''); setPasswordErr('') }}
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
                    placeholder="Enter your email" autoComplete="email" />
                </div>
                {emailErr && <p className="mt-1 text-xs text-red-400">{emailErr}</p>}
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
                    placeholder="Enter your password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErr && <p className="mt-1 text-xs text-red-400">{passwordErr}</p>}
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
                      <option value="admin" disabled>
                        Admin — Disabled (requires invite)
                      </option>
                    </select>
                  </div>
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center mt-6">
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {submitting ? 'Authenticating...' : (tab === 'login' ? 'Sign In Securely' : 'Create Account')}
              </button>
            </form>

            {tab === 'login' && !recoveryOpen && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={startRecovery}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {tab === 'login' && (
              <p className="text-center text-slate-500 text-xs mt-6">
                Use your account credentials to sign in.
              </p>
            )}

            {recoveryOpen && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-brand-400" />
                    <h3 className="text-sm font-semibold text-white">
                      {recoveryStep === 'request' ? 'Recover your account' : 'Reset your password'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecoveryOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>

                {recoveryError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30
                                  text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {recoveryError}
                  </div>
                )}
                {resetError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30
                                  text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {resetError}
                  </div>
                )}
                {recoveryMessage && recoveryStep === 'request' && (
                  <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
                    {recoveryMessage}
                  </div>
                )}

                {recoveryStep === 'request' ? (
                  <form onSubmit={submitRecoveryRequest} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          id="recoveryEmail"
                          type="email"
                          value={recoveryEmail}
                          required
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          className="input-field pl-10"
                          placeholder="Enter your email"
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={recoveryLoading} className="btn-primary w-full justify-center">
                      {recoveryLoading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                      {recoveryLoading ? 'Sending…' : 'Send recovery instructions'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={submitPasswordReset} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Reset token</label>
                      <input
                        type="text"
                        value={resetToken}
                        required
                        onChange={(e) => setResetToken(e.target.value)}
                        className="input-field"
                        placeholder="Enter reset token"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        If you did not receive an email yet, use the token shown after requesting recovery.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">New password</label>
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={newPassword}
                        required
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field"
                        placeholder="Enter new password"
                        autoComplete="new-password"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm password</label>
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={confirmPassword}
                        required
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-field"
                        placeholder="Confirm password"
                        autoComplete="new-password"
                      />
                    </div>

                    <button type="submit" disabled={resetLoading} className="btn-primary w-full justify-center">
                      {resetLoading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                      {resetLoading ? 'Updating…' : 'Update password'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
