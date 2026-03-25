import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, X, Minimize2, Maximize2, Bot, User, Zap, RefreshCw } from 'lucide-react'
import api from '../services/api'

export default function ChatAssistant({ analysisContext }) {
  const [open, setOpen]         = useState(false)
  const [minimized, setMin]     = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "👋 I'm your **AI Security Assistant**. I've been trained on your analysis results and can explain risks, predict threats, and recommend fixes. What would you like to know?", confidence: 1 }
  ])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [followUps, setFollowUps] = useState([
    "What are the most critical risks?",
    "Why is this dangerous?",
    "How do I fix these issues?",
  ])
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async (msg) => {
    const text = (msg || input).trim()
    if (!text || loading) return
    setInput('')
    setFollowUps([])
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const { data } = await api.post('/chat', {
        message: text,
        context: analysisContext || {},
        // Note: backend maintains session history server-side too
      })

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        confidence: data.confidence,
        mode: data.mode,
      }])

      if (data.follow_up_suggestions?.length) {
        setFollowUps(data.follow_up_suggestions.slice(0, 3))
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ AI chat unavailable. Please check the backend is running and the API key is configured.',
        isError: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = async () => {
    try { await api.delete('/chat/history') } catch {}
    setMessages([{ role: 'assistant', content: "Chat cleared. How can I help you with your security analysis?", confidence: 1 }])
    setFollowUps(["What are the most critical risks?", "How do I fix these issues?", "What attacks are predicted?"])
  }

  const formatMessage = (text) => {
    // Simple markdown: bold, code, bullets
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="font-mono text-xs bg-slate-800 text-emerald-400 px-1 rounded">$1</code>')
      .replace(/^• /gm, '&nbsp;&nbsp;• ')
      .replace(/\\n/g, '\n')
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl shadow-xl flex items-center justify-center transition-all hover:scale-110 group">
          <MessageSquare className="w-6 h-6" />
          {analysisContext && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className={`fixed bottom-6 right-6 z-50 flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl transition-all duration-300
          ${minimized ? 'h-14 w-80' : 'w-96 h-[600px]'}`}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 rounded-t-2xl bg-slate-900/90">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none">AI Security Assistant</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {analysisContext
                  ? `Context: ${analysisContext.risk_level || 'loaded'} • ${analysisContext.risk_score ?? '—'}/10 • ${analysisContext.findings?.length ?? 0} findings`
                  : 'No analysis loaded'}
              </p>
            </div>
            <button onClick={clearChat} className="text-slate-600 hover:text-slate-400 transition-colors" title="Clear chat">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setMin(m => !m)} className="text-slate-600 hover:text-slate-400 transition-colors">
              {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0
                      ${msg.role === 'user' ? 'bg-brand-600' : 'bg-slate-800 border border-slate-700'}`}>
                      {msg.role === 'user'
                        ? <User className="w-3.5 h-3.5 text-white" />
                        : <Bot className="w-3.5 h-3.5 text-brand-400" />
                      }
                    </div>
                    <div className={`max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className={`rounded-2xl px-3 py-2.5 text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-brand-600 text-white rounded-tr-sm'
                          : msg.isError
                            ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm'
                            : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                        }`}
                        dangerouslySetInnerHTML={{ __html: formatMessage(msg.content).replace(/\n/g, '<br/>') }} />
                      {msg.role === 'assistant' && msg.confidence > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-600 px-1">
                          <Zap className="w-2.5 h-2.5" />
                          {Math.round(msg.confidence * 100)}% confidence
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-brand-400" />
                    </div>
                    <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Follow-up suggestions */}
              {followUps.length > 0 && !loading && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                  {followUps.map((fu, i) => (
                    <button key={i} onClick={() => send(fu)}
                      className="text-xs px-2.5 py-1 bg-slate-800 border border-slate-700 hover:border-brand-500/50 hover:text-brand-400 text-slate-400 rounded-full transition-all">
                      {fu}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-slate-800">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder="Ask about your security analysis…"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 transition-colors"
                  />
                  <button onClick={() => send()} disabled={!input.trim() || loading}
                    className="w-9 h-9 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shrink-0">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
