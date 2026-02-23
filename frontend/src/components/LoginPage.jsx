import { useState } from 'react'

export function LoginPage({ onLogin, onSwitchToRegister, onDemoMode, error, clearError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError?.()
    setLoading(true)
    try {
      await onLogin(email, password)
    } catch (err) {
      clearError?.(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="auth-page-bg absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/30" />
      <div className="auth-page-glow absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent)]" />
      <div className="w-full max-w-md relative z-10">
        <div className="auth-card rounded-2xl border border-slate-700/80 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl shadow-cyan-500/5">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">
              SecureMind AI
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Sign in to access your security dashboard
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email or username</label>
              <input
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                placeholder="you@example.com or username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 py-3 font-semibold text-white hover:from-cyan-500 hover:to-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 transition-all shadow-lg shadow-cyan-500/20"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <button type="button" onClick={onSwitchToRegister} className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
              Create one
            </button>
          </p>
          {onDemoMode && (
            <p className="mt-4 text-center">
              <button
                type="button"
                onClick={onDemoMode}
                className="text-sm text-slate-500 hover:text-cyan-400 transition-colors"
              >
                Try without signing in →
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
