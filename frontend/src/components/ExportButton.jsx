import { useState } from 'react'

const API = '/api'

function authHeaders() {
  const token = localStorage.getItem('securemind_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function ExportButton() {
  const [loading, setLoading] = useState(null)

  const exportFormat = async (format) => {
    setLoading(format)
    try {
      const res = await fetch(`${API}/export/activity?format=${format}&limit=500`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `securemind_activity.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (_) {
      setLoading(null)
    }
    setLoading(null)
  }

  return (
    <div className="flex gap-3 items-center">
      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Export</span>
      <button
        type="button"
        onClick={() => exportFormat('csv')}
        disabled={loading !== null}
        className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm font-medium hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5 disabled:opacity-50 transition-all"
      >
        {loading === 'csv' ? '…' : 'CSV'}
      </button>
      <button
        type="button"
        onClick={() => exportFormat('pdf')}
        disabled={loading !== null}
        className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm font-medium hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5 disabled:opacity-50 transition-all"
      >
        {loading === 'pdf' ? '…' : 'PDF'}
      </button>
    </div>
  )
}
