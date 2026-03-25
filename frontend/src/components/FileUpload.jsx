import { useState, useCallback } from 'react'
import { Upload, File, X, CheckCircle } from 'lucide-react'

const ACCEPTED = '.txt,.log,.pdf,.docx,.sql,.csv,.json'
const MAX_MB = 20

export default function FileUpload({ onFileSelect, disabled }) {
  const [dragging, setDragging]   = useState(false)
  const [selected, setSelected]   = useState(null)
  const [error, setError]         = useState('')

  const processFile = useCallback((file) => {
    setError('')
    if (!file) return
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.split(',').includes(ext)) {
      setError(`Unsupported file type: ${ext}. Accepted: ${ACCEPTED}`)
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Max size: ${MAX_MB}MB`)
      return
    }
    setSelected(file)
    onFileSelect?.(file)
  }, [onFileSelect])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  const onInputChange = (e) => processFile(e.target.files[0])

  const clear = (e) => {
    e.stopPropagation()
    setSelected(null)
    setError('')
    onFileSelect?.(null)
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="w-full">
      <label
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        className={`
          relative block w-full rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer
          transition-all duration-300 group
          ${dragging
            ? 'border-brand-500 bg-brand-500/10 scale-[1.01]'
            : selected
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-slate-700 bg-slate-800/30 hover:border-brand-500/50 hover:bg-slate-800/60'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input type="file" accept={ACCEPTED} className="sr-only"
          onChange={onInputChange} disabled={disabled} />

        {selected ? (
          <div className="flex items-center justify-center gap-4 animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30
                            flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-white truncate max-w-xs">{selected.name}</p>
              <p className="text-sm text-slate-400">{formatSize(selected.size)}</p>
            </div>
            {!disabled && (
              <button onClick={clear}
                className="ml-2 p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700
                            flex items-center justify-center mx-auto mb-4 group-hover:border-brand-500/50
                            group-hover:bg-brand-600/10 transition-all">
              <Upload className="w-7 h-7 text-slate-500 group-hover:text-brand-400 transition-colors" />
            </div>
            <p className="font-semibold text-slate-200 mb-1">
              Drop your file here, or <span className="text-brand-400">browse</span>
            </p>
            <p className="text-sm text-slate-500">
              TXT, LOG, PDF, DOCX, SQL, CSV, JSON — up to {MAX_MB}MB
            </p>
          </div>
        )}
      </label>
      {error && (
        <p className="text-red-400 text-sm mt-2 flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> {error}
        </p>
      )}
    </div>
  )
}
