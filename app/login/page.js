'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function submit(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/clients')
        router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccess('Check your email to confirm your account, then sign in.')
        setMode('signin')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{minHeight:'100vh',background:'#080c18',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',fontFamily:'Inter,-apple-system,sans-serif'}}>
      <div style={{width:'100%',maxWidth:'380px'}}>

        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:'10px',justifyContent:'center',marginBottom:'32px'}}>
          <div style={{width:'36px',height:'36px',borderRadius:'10px',background:'linear-gradient(135deg,#e8c97e,#c9a84c)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'700',color:'#0a0e1a'}}>P</div>
          <div>
            <div style={{fontSize:'16px',fontWeight:'600',color:'#e8eaf6',lineHeight:'1'}}>PerfHub</div>
            <div style={{fontSize:'10px',color:'#4a5580',marginTop:'2px',letterSpacing:'0.05em',textTransform:'uppercase'}}>AI Performance OS</div>
          </div>
        </div>

        {/* Card */}
        <div style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:'16px',padding:'32px'}}>
          <h1 style={{fontSize:'18px',fontWeight:'600',color:'#e8eaf6',margin:'0 0 4px'}}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h1>
          <p style={{fontSize:'13px',color:'#4a5580',margin:'0 0 24px'}}>Performance marketing, powered by AI</p>

          {error && (
            <div style={{fontSize:'13px',color:'#fca5a5',background:'#2a0f0f',border:'1px solid #3a1515',borderRadius:'8px',padding:'10px 14px',marginBottom:'16px'}}>
              {error}
            </div>
          )}
          {success && (
            <div style={{fontSize:'13px',color:'#86efac',background:'#14301a',border:'1px solid #1a4025',borderRadius:'8px',padding:'10px 14px',marginBottom:'16px'}}>
              {success}
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'11px',color:'#4a5580',marginBottom:'6px',fontWeight:'500'}}>Email</label>
              <input
                type="email"
                placeholder="you@agency.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{width:'100%',padding:'9px 12px',fontSize:'13px',background:'#111827',border:'1px solid #1e2a48',borderRadius:'8px',color:'#e8eaf6',outline:'none',boxSizing:'border-box'}}
                onFocus={e => e.target.style.borderColor='#4a5580'}
                onBlur={e => e.target.style.borderColor='#1e2a48'}
              />
            </div>
            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block',fontSize:'11px',color:'#4a5580',marginBottom:'6px',fontWeight:'500'}}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{width:'100%',padding:'9px 12px',fontSize:'13px',background:'#111827',border:'1px solid #1e2a48',borderRadius:'8px',color:'#e8eaf6',outline:'none',boxSizing:'border-box'}}
                onFocus={e => e.target.style.borderColor='#4a5580'}
                onBlur={e => e.target.style.borderColor='#1e2a48'}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{width:'100%',background:'#e8c97e',color:'#0a0e1a',fontSize:'13px',fontWeight:'600',padding:'10px',borderRadius:'8px',border:'none',cursor:loading?'not-allowed':'pointer',opacity:loading?0.6:1}}
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p style={{textAlign:'center',fontSize:'12px',color:'#3a4468',marginTop:'20px'}}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              style={{color:'#8090c0',background:'none',border:'none',cursor:'pointer',fontSize:'12px',textDecoration:'underline'}}
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <p style={{textAlign:'center',fontSize:'11px',color:'#2e3858',marginTop:'20px'}}>
          PerfHub · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
