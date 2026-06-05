'use client'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TrendingUp, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const router = useRouter()

  async function submit(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    const supabase = createBrowserClient()
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/clients')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
      }
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-dark flex items-center justify-center"><TrendingUp size={18} className="text-brand-gold"/></div>
          <span className="text-xl font-semibold text-gray-900">PerfHub</span>
        </div>
        <div className="card p-6">
          <h1 className="text-base font-semibold text-gray-900 mb-1">{mode === 'signin' ? 'Sign in to your account' : 'Create your account'}</h1>
          <p className="text-sm text-gray-400 mb-6">Performance marketing, powered by AI</p>
          {error && <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 mb-4"><AlertCircle size={14}/>{error}</div>}
          {success && <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg p-3 mb-4">{success}</div>}
          <form onSubmit={submit} className="space-y-3">
            <div><label className="block text-xs text-gray-500 mb-1.5">Email</label><input className="input" type="email" placeholder="you@agency.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
            <div><label className="block text-xs text-gray-500 mb-1.5">Password</label><input className="input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/></div>
            <button type="submit" className="btn-primary w-full justify-center mt-1" disabled={loading}>{loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-4">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button className="text-gray-600 underline" onClick={() => { setMode(mode==='signin'?'signup':'signin'); setError('') }}>{mode === 'signin' ? 'Sign up' : 'Sign in'}</button>
          </p>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">PerfHub · Internal tool · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}