'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Plus, Search, BarChart3, Eye, Map, X, Check, AlertCircle, FileText } from 'lucide-react'

const INDUSTRIES = ['F&B / Restaurant','E-commerce','Real Estate','Healthcare','Education','Automotive','Finance','Retail','Travel & Hospitality','Technology','Fashion','Beauty & Wellness','Other']
const COLORS = [['bg-surface-tertiary','text-brand-gold'],['bg-surface-tertiary','text-status-green'],['bg-surface-tertiary','text-status-blue'],['bg-surface-tertiary','text-text-primary'],['bg-surface-tertiary','text-text-secondary']]
const STATUS = { active: ['badge-green','Active'], pending: ['badge-amber','Pending'], paused: ['badge-gray','Paused'] }

function isValidUrl(str) {
  if (!str) return true
  try { new URL(str.startsWith('http') ? str : 'https://' + str); return true } catch { return false }
}

export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [urlError, setUrlError] = useState('')
  const [form, setForm] = useState({ name:'', industry:'', website:'', monthly_budget:'', meta_ad_account_id:'', status:'active', notes:'' })
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createBrowserClient()
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
    setLoading(false)
  }

  function validateWebsite(val) {
    if (val && !isValidUrl(val)) setUrlError('Please enter a valid website URL (e.g. https://example.com)')
    else setUrlError('')
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (urlError) return
    if (form.website && !isValidUrl(form.website)) { setUrlError('Please enter a valid website URL'); return }
    setSaving(true); setError('')
    const supabase = createBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    const website = form.website && !form.website.startsWith('http') ? 'https://' + form.website : form.website
    const { error: err } = await supabase.from('clients').insert([{ ...form, website, monthly_budget: form.monthly_budget ? Number(form.monthly_budget) : null, user_id: user.id }])
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); setModal(false)
    setForm({ name:'', industry:'', website:'', monthly_budget:'', meta_ad_account_id:'', status:'active', notes:'' })
    setUrlError('')
    load()
  }

  const totalBudget = clients.reduce((s,c)=>s+(c.monthly_budget||0),0)
  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.industry||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="text-sm text-text-dim mt-0.5">Manage all your performance marketing clients</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}><Plus size={14}/> Add client</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          ['Total clients', clients.length],
          ['Active', clients.filter(c=>c.status==='active').length],
          ['Monthly spend', totalBudget ? 'AED ' + totalBudget.toLocaleString() : '—']
        ].map(([l,v]) => (
          <div key={l} className="card p-4"><p className="text-xs text-text-dim mb-1">{l}</p><p className="text-2xl font-medium text-text-primary">{v}</p></div>
        ))}
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"/>
        <input className="input pl-8" placeholder="Search clients..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c, i) => {
            const [bg, text] = COLORS[i % COLORS.length]
            const [badgeCls, label] = STATUS[c.status] || STATUS.active
            const platforms = [c.google_ads_id && 'Google', c.meta_ad_account_id && 'Meta'].filter(Boolean)
            return (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${bg} ${text} flex items-center justify-center text-xs font-medium`}>
                    {c.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
                  </div>
                  <span className={badgeCls}>{label}</span>
                </div>
                <p className="text-sm font-medium text-text-primary mb-0.5">{c.name}</p>
                <p className="text-xs text-text-dim mb-3">{c.industry||'No industry'}{c.website ? ` · ${c.website.replace(/https?:\/\//,'')}` : ''}</p>
                <div className="grid grid-cols-2 gap-2 py-3 border-t border-surface-border mb-3">
                  <div><p className="text-[10px] text-text-dim mb-0.5">Monthly budget</p><p className="text-sm font-medium">{c.monthly_budget ? `AED ${c.monthly_budget.toLocaleString()}` : '—'}</p></div>
                  <div><p className="text-[10px] text-text-dim mb-0.5">Platforms</p><p className="text-sm font-medium">{platforms.length ? platforms.join(', ') : '—'}</p></div>
                </div>
                <div className="flex gap-2 mb-2">
                  {[['Audit', BarChart3, '/audit'],['Competitors', Eye, '/competitors'],['Strategy', Map, '/strategy']].map(([lbl, Icon, href]) => (
                    <button key={lbl} className="btn-secondary flex-1 justify-center text-xs py-1.5" onClick={()=>router.push(`${href}?client=${c.id}`)}>
                      <Icon size={12}/> {lbl}
                    </button>
                  ))}
                </div>
                <button className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-surface-border-light text-text-muted hover:bg-surface-secondary hover:text-text-primary transition-colors" onClick={()=>router.push(`/clients/${c.id}`)}>
                  <FileText size={12}/> Full report
                </button>
              </div>
            )
          })}
          <button className="card p-4 border-dashed flex flex-col items-center justify-center min-h-[200px] text-text-dim hover:text-text-secondary hover:border-surface-border-light transition-colors cursor-pointer" onClick={()=>setModal(true)}>
            <Plus size={20} className="mb-2"/><span className="text-sm">Add new client</span>
          </button>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-primary rounded-xl border border-surface-border w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-surface-border">
              <h2 className="text-sm font-semibold">Add new client</h2>
              <button onClick={()=>{setModal(false);setUrlError('');setError('')}} className="text-text-dim hover:text-text-secondary"><X size={16}/></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {error && <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg p-3"><AlertCircle size={13}/>{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-text-muted mb-1">Name *</label><input className="input" placeholder="Client name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
                <div><label className="block text-xs text-text-muted mb-1">Industry</label><select className="select" value={form.industry} onChange={e=>setForm({...form,industry:e.target.value})}><option value="">Select...</option>{INDUSTRIES.map(i=><option key={i}>{i}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Website</label>
                  <input className={`input ${urlError ? 'border-red-300' : ''}`} placeholder="https://example.com" value={form.website} onChange={e=>{setForm({...form,website:e.target.value});validateWebsite(e.target.value)}} onBlur={e=>validateWebsite(e.target.value)}/>
                  {urlError && <p className="text-[10px] text-red-500 mt-1">{urlError}</p>}
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Monthly budget (AED)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-dim">AED</span>
                    <input className="input pl-10" type="number" placeholder="10,000" value={form.monthly_budget} onChange={e=>setForm({...form,monthly_budget:e.target.value})}/>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-text-muted mb-1">Meta Ad Account ID</label><input className="input" placeholder="act_123456789" value={form.meta_ad_account_id} onChange={e=>setForm({...form,meta_ad_account_id:e.target.value})}/></div>
                <div><label className="block text-xs text-text-muted mb-1">Status</label><select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Active</option><option value="pending">Pending</option><option value="paused">Paused</option></select></div>
              </div>
            </form>
            <div className="flex justify-end gap-2 p-4 border-t border-surface-border">
              <button className="btn-secondary" onClick={()=>{setModal(false);setUrlError('');setError('')}}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving || !!urlError}><Check size={13}/>{saving?'Saving...':'Save client'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
