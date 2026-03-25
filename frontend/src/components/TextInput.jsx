import { useState } from 'react'
import { FileText, Terminal, Database, MessageSquare, Bug } from 'lucide-react'

const TABS = [
  { id: 'text',  label: 'Text',  icon: FileText,     placeholder: 'Paste any text content to scan for sensitive data...' },
  { id: 'log',   label: 'Log',   icon: Terminal,     placeholder: '2024-01-15 10:23:45 ERROR Login failed for user admin\npassword=secret123\n...' },
  { id: 'sql',   label: 'SQL',   icon: Database,     placeholder: "SELECT * FROM users WHERE password='admin123';\n-- Paste SQL query or schema..." },
  { id: 'chat',  label: 'Chat',  icon: MessageSquare,placeholder: 'Paste chat logs, messages, or conversation data...' },
]

export default function TextInput({ onContentChange, disabled }) {
  const [activeTab, setActiveTab]   = useState('text')
  const [content, setContent]       = useState('')
  const charCount = content.length
  const lineCount = content.split('\n').length

  const handleChange = (e) => {
    setContent(e.target.value)
    onContentChange?.(e.target.value, activeTab)
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    onContentChange?.(content, tabId)
  }

  const activeTabData = TABS.find(t => t.id === activeTab)

  return (
    <div className="w-full">
      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl border border-slate-700/50 mb-3">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => handleTabChange(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                        transition-all flex-1 justify-center
                        ${activeTab === id
                          ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'}`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={content}
          onChange={handleChange}
          disabled={disabled}
          rows={10}
          placeholder={activeTabData?.placeholder}
          className="input-field font-mono text-sm resize-none w-full leading-relaxed
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {/* Clear button */}
        {content && !disabled && (
          <button onClick={() => { setContent(''); onContentChange?.('', activeTab) }}
            className="absolute top-3 right-3 text-slate-500 hover:text-slate-300
                       text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg transition-all">
            Clear
          </button>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between mt-2 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <span className="capitalize text-slate-500">{activeTab} mode</span>
        </span>
        <span>{lineCount.toLocaleString()} lines · {charCount.toLocaleString()} chars</span>
      </div>
    </div>
  )
}
