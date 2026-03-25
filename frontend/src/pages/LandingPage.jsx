import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield,
  Brain,
  Activity,
  Sparkles,
  ArrowRight,
  Lock,
  Gauge,
  Clock,
  Layers,
  CheckCircle2,
  Zap,
  BadgeCheck,
  Menu,
  X,
  Star,
  HelpCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import RiskSphere3D from '../components/RiskSphere3D'
import TimelineFlow3D from '../components/TimelineFlow3D'

const pricingPlans = [
  {
    name: 'Starter',
    price: '$19',
    desc: 'For individuals running secure analysis.',
    bullets: ['AI analysis for text and logs', 'Basic alerts', '1 workspace'],
    featured: false,
  },
  {
    name: 'Pro',
    price: '$59',
    desc: 'For teams that need continuous monitoring.',
    bullets: ['Everything in Starter', 'Live streaming risk monitoring', 'History and risk reports', 'Priority queue handling'],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'For organizations with compliance needs.',
    bullets: ['Advanced access controls', 'System-wide analytics (admin)', 'SLA + dedicated tuning', 'Audit-friendly reporting'],
    featured: false,
  },
]

const faqItems = [
  {
    q: 'Is this rule-based or AI-first?',
    a: 'AI-first intelligence powers findings, root cause, predictions, and confidence. Regex is used only as contextual hinting to improve reasoning speed.',
  },
  {
    q: 'Do I see my past analyses?',
    a: 'Yes. Each user has a dedicated history of analyses, logs, and risk reports stored in PostgreSQL.',
  },
  {
    q: 'How does live streaming work?',
    a: 'Logs are split into chunks and processed asynchronously. The UI receives progressive chunk results and live alerts over WebSocket.',
  },
  {
    q: 'Can admins view system-wide data?',
    a: 'Admin endpoints are role-protected. Regular users are restricted to their own data.',
  },
]

function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {icon}
      <h2 className="text-white text-lg font-semibold">{children}</h2>
    </div>
  )
}

function TinyDot({ color }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(0)

  const previewEvents = useMemo(
    () => [
      {
        label: 'Credential exposure',
        type: 'finding',
        risk: 'critical',
        description: 'Detected secrets in log text and applied safe masking.',
        line: 42,
        time: new Date(Date.now() - 900000).toISOString(),
      },
      {
        label: 'Auth anomaly',
        type: 'finding',
        risk: 'high',
        description: 'Suspicious login attempts with escalation indicators.',
        line: 118,
        time: new Date(Date.now() - 720000).toISOString(),
      },
      {
        label: 'Policy action',
        type: 'finding',
        risk: 'medium',
        description: 'Content masked for safety while preserving analysis context.',
        line: 203,
        time: new Date(Date.now() - 540000).toISOString(),
      },
      {
        label: 'Predictive risk',
        type: 'finding',
        risk: 'high',
        description: 'Likely escalation path if issues remain unpatched.',
        line: 260,
        time: new Date(Date.now() - 360000).toISOString(),
      },
      {
        label: 'Stabilization',
        type: 'finding',
        risk: 'clean',
        description: 'Behavior returns to expected patterns after remediation.',
        line: null,
        time: new Date(Date.now() - 180000).toISOString(),
      },
    ],
    []
  )

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true })
  }, [loading, user, navigate])

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Premium background grid + glows */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at 50% 20%, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 70%)',
        }}
      />
      <div
        aria-hidden
        className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-brand-600/15 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-60 -right-40 w-[520px] h-[520px] rounded-full bg-emerald-600/10 blur-3xl pointer-events-none"
      />
      {/* Top Bar */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-brand-400" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">AI Secure</div>
            <div className="text-xs text-slate-500">Data Intelligence Platform</div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Features
          </a>
          <a href="#pricing" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Pricing
          </a>
          <a href="#faq" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            FAQ
          </a>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => navigate('/login')} className="btn-secondary px-4 py-2 rounded-xl">
              Login
            </button>
            <button onClick={() => navigate('/login?tab=register')} className="btn-primary px-4 py-2 rounded-xl">
              <ArrowRight className="w-4 h-4" />
              Get Started
            </button>
          </div>

          <button
            className="md:hidden p-2 rounded-xl border border-slate-800 bg-slate-900/30 text-slate-200"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm">
          <div className="absolute right-4 top-4 w-[320px] card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-white">AI Secure</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <a
                href="#features"
                onClick={() => setMobileNavOpen(false)}
                className="block text-sm text-slate-300 hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileNavOpen(false)}
                className="block text-sm text-slate-300 hover:text-white transition-colors"
              >
                Pricing
              </a>
              <a
                href="#faq"
                onClick={() => setMobileNavOpen(false)}
                className="block text-sm text-slate-300 hover:text-white transition-colors"
              >
                FAQ
              </a>
              <div className="pt-3 border-t border-slate-800" />
              <button
                onClick={() => {
                  setMobileNavOpen(false)
                  navigate('/login')
                }}
                className="w-full btn-secondary rounded-xl px-4 py-2"
              >
                Login
              </button>
              <button
                onClick={() => {
                  setMobileNavOpen(false)
                  navigate('/login?tab=register')
                }}
                className="w-full btn-primary rounded-xl px-4 py-2"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600/15 border border-brand-500/25 text-brand-300 text-xs mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              AI-first security, end-to-end
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
              Secure your data with
              <span className="text-brand-400"> real-time AI intelligence</span>.
            </h1>
            <p className="text-slate-400 text-lg mt-5 leading-relaxed">
              Detect sensitive data, explain root cause, predict likely next threats, and monitor risky logs as they stream in.
            </p>

            <div className="flex flex-wrap gap-3 mt-7">
              <button onClick={() => navigate('/login')} className="btn-primary justify-center">
                <Shield className="w-4 h-4" />
                Login
              </button>
              <button onClick={() => navigate('/login?tab=register')} className="btn-secondary justify-center">
                <ArrowRight className="w-4 h-4" />
                Get Started
              </button>
            </div>

            <div className="mt-8 space-y-2">
              {[
                { icon: <Brain className="w-4 h-4 text-brand-400" />, label: 'Structured AI findings' },
                { icon: <Activity className="w-4 h-4 text-emerald-400" />, label: 'Real-time monitoring' },
                { icon: <Sparkles className="w-4 h-4 text-orange-400" />, label: 'Predictions + fix guidance' },
              ].map((x) => (
                <div
                  key={x.label}
                  className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 mb-3 text-left"
                >
                  {x.icon}
                  <span className="text-sm font-medium text-slate-200">{x.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <TinyDot color="#10b981" />
                AI confidence scoring included
              </div>
              <div className="flex items-center gap-2">
                <TinyDot color="#6366f1" />
                History stored in PostgreSQL
              </div>
            </div>
          </div>

          {/* Visual panel */}
          <div className="relative">
            <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full bg-brand-600/15 blur-3xl" />
            <div className="absolute bottom-0 -right-10 w-72 h-72 rounded-full bg-emerald-600/10 blur-3xl" />

            <div className="card p-6 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-brand-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Live preview</div>
                  <div className="text-xs text-slate-500">Risk scoring + 3D timeline flow</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RiskSphere3D showHeader heightClassName="h-[190px]" riskLevel="high" riskScore={8} />
                <TimelineFlow3D heightClassName="h-[190px]" events={previewEvents} />
              </div>

              <div className="mt-6 text-xs text-slate-500 flex items-start gap-2">
                <span className="mt-0.5 inline-block w-2 h-2 rounded-full bg-brand-500/40 border border-brand-500/30" />
                Structured outputs enable dashboards, alerts, and chat context.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-14">
        <SectionTitle icon={<Layers className="w-4 h-4 text-brand-400" />}>Built for security teams</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              icon: <Shield className="w-4 h-4 text-brand-400" />,
              title: 'AI-first analysis',
              desc: 'Findings, root cause reasoning, anomalies, predictions, and fix suggestions in one schema.',
            },
            {
              icon: <Zap className="w-4 h-4 text-orange-400" />,
              title: 'Real-time risk monitoring',
              desc: 'Chunk-based streaming with progressive context and live alerts.',
            },
            {
              icon: <BadgeCheck className="w-4 h-4 text-emerald-400" />,
              title: 'Policy-safe handling',
              desc: 'Masking and blocking enforced to prevent sensitive data exposure.',
            },
            {
              icon: <HelpCircle className="w-4 h-4 text-slate-300" />,
              title: 'Actionable outputs',
              desc: 'Clear next steps with AI confidence and contextual summaries.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="card p-6 transition-all hover:-translate-y-0.5 hover:border-brand-500/20 hover:bg-slate-900/60"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center">
                  {f.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{f.title}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">{f.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-16">
        <SectionTitle icon={<Star className="w-4 h-4 text-brand-400" />}>Pricing that scales</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pricingPlans.map((p) => (
            <div
              key={p.name}
              className={`card p-6 transition-all hover:-translate-y-0.5 hover:border-brand-500/20 ${
                p.featured ? 'border-brand-500/40 bg-brand-600/5 shadow-lg shadow-brand-900/20' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">{p.desc}</div>
                </div>
                {p.featured && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300">
                    Most popular
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-end gap-2">
                <div className="text-3xl font-extrabold text-white">{p.price}</div>
                <div className="text-xs text-slate-500 mb-1">/ month</div>
              </div>

              <div className="mt-4 space-y-2">
                {p.bullets.map((b) => (
                  <div key={b} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate('/login?tab=register')}
                className={`mt-6 w-full btn-primary ${
                  p.featured ? '' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 shadow-none'
                }`}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-20">
        <SectionTitle icon={<HelpCircle className="w-4 h-4 text-brand-400" />}>Frequently asked questions</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {faqItems.map((item, idx) => {
            const open = faqOpen === idx
            return (
              <button
                key={item.q}
                onClick={() => setFaqOpen(open ? -1 : idx)}
                className="card p-5 text-left transition-all hover:-translate-y-0.5 hover:bg-slate-900/60"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <span className={`text-xs font-bold ${open ? 'text-brand-400' : 'text-slate-300'}`}>?</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{item.q}</div>
                    {open && <div className="text-xs text-slate-500 mt-2 leading-relaxed">{item.a}</div>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 bg-slate-950/60">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-sm font-semibold text-white">AI Secure</div>
            <div className="text-xs text-slate-500 mt-1">AI-powered security intelligence SaaS</div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/login')} className="btn-secondary px-4 py-2 rounded-xl">
              Login
            </button>
            <button onClick={() => navigate('/login?tab=register')} className="btn-primary px-4 py-2 rounded-xl">
              <ArrowRight className="w-4 h-4" />
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

