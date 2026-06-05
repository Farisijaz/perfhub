'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Search, BarChart3, Eye, Map, X, Check, AlertCircle } from 'lucide-react'

const INDUSTRIES = ['F&B / Restaurant','E-commerce','Real Estate','Healthcare','Education','Automotive','Finance','Retail','Travel & Hospitality','Technology','Fashion','Beauty & Wellness','Other']
const COLORS = [['bg-purple-50','text-purple-800'],['bg-teal-50','text-teal-800'],['bg-blue-50','text-blue-800'],['bg-orange-50','text-orange-800'],['bg-pink-50','text-pink-800']]
const STATUS = { active: ['badge-green','Active'], pending: ['badge-amber','Pending'], paused: ['badge-gray','Paused'] }

export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name:'', industry:'', website:'', monthly_budget:'', google_ads_id:'', meta_ad_account_id:'', status:'active', notes:'' })
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createBrowserClient()
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
    setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setError('')
    const supabase = createBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('clients').insert([{ ...form, monthly_budget: form.monthly_budget ? Number(form.monthly_budget) : null, user_id: user.id }])
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); setModal(false)
    setForm({ name:'', industry:'', website:'', monthly_budget:'', google_ads_id:'', meta_ad_account_id:'', status:'active', notes:'' })
    load()
  }

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.industry||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage all your performance marketing clients</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}><Plus size={14}/> Add client</button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[['Total clients', clients.length],['Active', clients.filter(c=>c.status==='active').length],['Monthly spend', clients.reduce((s,c)=>s+(c.monthly_budget||0),0) ? '$'+clients.reduce((s,c)=>s+(c.monthly_budget||0),0).toLocaleString() : '—']].map(([l,v]) => (
          <div key={l} className="card p-4"><p className="text-xs text-gray-400 mb-1">{l}</p><p className="text-2xl font-medium text-gray-900">{v}</p></div>
        ))}
      </div>
      <div className="relative max-w-xs mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
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
                <p className="text-sm font-medium text-gray-900 mb-0.5">{c.name}</p>
                <p className="text-xs text-gray-400 mb-3">{c.industry||'No industry'}{c.website ? ` · ${c.website.replace(/https?:\/\//,'')}` : ''}</p>
                <div className="grid grid-cols-2 gap-2 py-3 border-t border-gray-50 mb-3">
                  <div><p className="text-[10px] text-gray-400 mb-0.5">Monthly budget</p><p className="text-sm font-medium">{c.monthly_budget ? `$${c.monthly_budget.toLocaleString()}` : '—'}</p></div>
                  <div><p className="text-[10px] text-gray-400 mb-0.5">Platforms</p><p className="text-sm font-medium">{platforms.length ? platforms.join(', ') : '—'}</p></div>
                </div>
                <div className="flex gap-2">
                  {[['Audit', BarChart3, '/audit'],['Competitors', Eye, '/competitors'],['Strategy', Map, '/strategy']].map(([lbl, Icon, href]) => (
                    <button key={lbl} className="btn-secondary flex-1 justify-center text-xs py-1.5" onClick={()=>router.push(`${href}?client=${c.id}`)}>
                      <Icon size={12}/> {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <button className="card p-4 border-dashed flex flex-col items-center justify-center min-h-[200px] text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors cursor-pointer" onClick={()=>setModal(true)}>
            <Plus size={20} className="mb-2"/><span className="text-sm">Add new client</span>
          </button>
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-100 w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-50">
              <h2 className="text-sm font-semibold">Add new client</h2>
              <button onClick={()=>setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {error && <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg p-3"><AlertCircle size={13}/>{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Name *</label><input className="input" placeholder="Client name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
                <div><label className="block text-xs text-gray-500 mb-1">Industry</label><select className="select" value={form.industry} onChange={e=>setForm({...form,industry:e.target.value})}><option value="">Select...</option>{INDUSTRIES.map(i=><option key={i}>{i}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Website</label><input className="input" placeholder="https://..." value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></div>
                <div><label className="block text-xs text-gray-500 mb-1">Monthly budget</label><input className="input" type="number" placeholder="10000" value={form.monthly_budget} onChange={e=>setForm({...form,monthly_budget:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Google Ads ID</label><input className="input" placeholder="123-456-7890" value={form.google_ads_id} onChange={e=>setForm({...form,google_ads_id:e.target.value})}/></div>
                <div><label className="block text-xs text-gray-500 mb-1">Meta Ad Account ID</label><input className="input" placeholder="act_123456789" value={form.meta_ad_account_id} onChange={e=>setForm({...form,meta_ad_account_id:e.target.value})}/></div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">Status</label><select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Active</option><option value="pending">Pending</option><option value="paused">Paused</option></select></div>
            </form>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-50">
              <button className="btn-secondary" onClick={()=>setModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}><Check size={13}/>{saving?'Saving...':'Save client'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}