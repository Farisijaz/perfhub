'use client'
import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Play, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

const AD_TYPES = ['Search ads (Google)','Responsive display ads','Meta feed ads','Meta story ads','YouTube bumper ads','LinkedIn sponsored content']
const OBJECTIVES = ['Drive conversions','Generate leads','Increase brand awareness','Drive website traffic','Promote an offer/discount','App installs']

function CreativePageInner() {
  const params = useSearchParams()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(params.get('client') || '')
  const [adType, setAdType] = useState('Search ads (Google)')
  const [objective, setObjective] = useState('Drive conversions')
  const [product, setProduct] = useState('')
  const [usp, setUsp] = useState('')
  const [cta, setCta] = useState('Learn More')
  const [tone, setTone] = useState('professional')
  const [running, setRunning] = useState(false)
  const [ads, setAds] = useState(null)
  const [tracking, setTracking] = useState(null)
  const [activeTab, setActiveTab] = useState('ads')
  const [copied, setCopied] = useState('')
  const [expandedTracking, setExpandedTracking] = useState(0)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  function copy(text, id) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  async function generate() {
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    setRunning(true); setAds(null); setTracking(null)
    try {
      const [adsRes, trackingRes] = await Promise.all([
        fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'creative', payload: { clientName: client.name, industry: client.industry, adType, objective, product, usp, cta, tone } }) }),
        fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'tracking', payload: { clientName: client.name, industry: client.industry, platform: adType.toLowerCase().includes('meta') ? 'meta' : 'google' } }) })
      ])
      const adsData = await adsRes.json()
      const trackingData = await trackingRes.json()
      if (adsData.success) setAds(adsData.creative)
      if (trackingData.success) setTracking(trackingData.tracking)
    } catch (e) { alert('Error: ' + e.message) }
    setRunning(false)
  }

  const priorityColor = { First: 'badge-red', Second: 'badge-amber', Third: 'badge-green', Fourth: 'badge-gray' }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div><h1 className="text-lg font-semibold text-gray-900">Ad creative & tracking</h1><p className="text-sm text-gray-400 mt-0.5">Agent 4 — AI ad copy, creative briefs and full tracking setup guide</p></div>
        <button className="btn-primary" onClick={generate} disabled={running || !clientId}><Play size={13}/>{running ? 'Generating...' : 'Generate'}</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div><label className="block text-xs text-gray-500 mb-1.5">Client</label>
          <select className="select" value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1.5">Ad type</label>
          <select className="select" value={adType} onChange={e => setAdType(e.target.value)}>{AD_TYPES.map(t => <option key={t}>{t}</option>)}</select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1.5">Objective</label>
          <select className="select" value={objective} onChange={e => setObjective(e.target.value)}>{OBJECTIVES.map(o => <option key={o}>{o}</option>)}</select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1.5">Product / service</label>
          <input className="input" placeholder="What are you advertising?" value={product} onChange={e => setProduct(e.target.value)}/>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1.5">Key USPs</label>
          <input className="input" placeholder="e.g. Free delivery, 24/7 support" value={usp} onChange={e => setUsp(e.target.value)}/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="block text-xs text-gray-500 mb-1.5">CTA</label>
            <select className="select" value={cta} onChange={e => setCta(e.target.value)}>
              {['Learn More','Shop Now','Get Quote','Book Now','Sign Up','Contact Us','Download','Get Started'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-500 mb-1.5">Tone</label>
            <select className="select" value={tone} onChange={e => setTone(e.target.value)}>
              {['professional','friendly','urgent','luxury','playful','authoritative'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {running && <div className="card p-4 mb-4"><div className="flex gap-1.5 items-center">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}<span className="text-xs text-gray-400 ml-2">Generating ad copy and tracking setup...</span></div></div>}

      {(ads || tracking) && (
        <>
          <div className="flex gap-1 mb-4 border-b border-gray-100">
            {[['ads','Ad copy (3 variants)'],['tracking','Tracking setup']].map(([tab,label]) => (
              <button key={tab} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab===tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`} onClick={() => setActiveTab(tab)}>{label}</button>
            ))}
          </div>

          {activeTab === 'ads' && ads && (
            <div className="space-y-4">
              {ads.ab_test_recommendation && <div className="card p-3 bg-blue-50 border-blue-100"><p className="text-xs font-medium text-blue-700 mb-1">A/B test recommendation</p><p className="text-sm text-blue-600">{ads.ab_test_recommendation}</p></div>}
              {(ads.ads||[]).map((ad, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div><span className="text-sm font-medium text-gray-900">{ad.variant}</span><span className="ml-2 text-xs text-gray-400">— {ad.angle}</span></div>
                    <button className="btn-secondary text-xs py-1" onClick={() => copy(JSON.stringify(ad,null,2), `ad-${i}`)}>{copied===`ad-${i}` ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy all</>}</button>
                  </div>
                  <div className="space-y-3">
                    {ad.headlines?.length > 0 && (
                      <div><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Headlines</p>
                        {ad.headlines.map((h,j) => <div key={j} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 mb-1"><span className="text-sm text-gray-700">{h}</span><div className="flex items-center gap-2"><span className={`text-[10px] ${h.length>30?'text-red-500':'text-gray-400'}`}>{h.length}/30</span><button onClick={()=>copy(h,`h-${i}-${j}`)} className="text-gray-300 hover:text-gray-500">{copied===`h-${i}-${j}`?<Check size={11}/>:<Copy size={11}/>}</button></div></div>)}
                      </div>
                    )}
                    {ad.descriptions?.length > 0 && (
                      <div><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Descriptions</p>
                        {ad.descriptions.map((d,j) => <div key={j} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 mb-1"><span className="text-sm text-gray-700">{d}</span><div className="flex items-center gap-2"><span className={`text-[10px] ${d.length>90?'text-red-500':'text-gray-400'}`}>{d.length}/90</span><button onClick={()=>copy(d,`d-${i}-${j}`)} className="text-gray-300 hover:text-gray-500">{copied===`d-${i}-${j}`?<Check size={11}/>:<Copy size={11}/>}</button></div></div>)}
                      </div>
                    )}
                    {ad.primary_text && <div><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Primary text (Meta)</p><div className="flex items-start justify-between bg-gray-50 rounded px-3 py-2"><span className="text-sm text-gray-700 flex-1 mr-2">{ad.primary_text}</span><button onClick={()=>copy(ad.primary_text,`pt-${i}`)} className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5">{copied===`pt-${i}`?<Check size={11}/>:<Copy size={11}/>}</button></div></div>}
                    {ad.image_direction && <div><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Creative direction</p><p className="text-sm text-gray-500 italic bg-amber-50 px-3 py-2 rounded border-l-2 border-amber-200">{ad.image_direction}</p></div>}
                  </div>
                </div>
              ))}
              {ads.creative_notes && <div className="card p-3 bg-gray-50"><p className="text-xs font-medium text-gray-500 mb-1">Notes for design team</p><p className="text-sm text-gray-600">{ads.creative_notes}</p></div>}
            </div>
          )}

          {activeTab === 'tracking' && tracking && (
            <div className="space-y-3">
              {tracking.key_events_to_track?.length > 0 && <div className="card p-4 mb-2"><p className="text-xs font-medium text-gray-500 mb-2">Key events to track</p><div className="flex flex-wrap gap-2">{tracking.key_events_to_track.map((e,i) => <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-mono">{e}</span>)}</div></div>}
              {(tracking.tracking_setup||[]).map((platform, i) => (
                <div key={i} className="card overflow-hidden">
                  <button className="w-full flex items-center justify-between p-4" onClick={() => setExpandedTracking(expandedTracking === i ? null : i)}>
                    <div className="flex items-center gap-3"><span className={priorityColor[platform.priority]||'badge-gray'}>{platform.priority}</span><p className="text-sm font-medium text-gray-900">{platform.platform}</p></div>
                    {expandedTracking === i ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                  </button>
                  {expandedTracking === i && (
                    <div className="border-t border-gray-50 p-4 space-y-3">
                      {(platform.steps||[]).map((s,j) => <div key={j} className="flex gap-3"><div className="w-6 h-6 rounded-full bg-gray-900 text-white text-[11px] font-medium flex items-center justify-center shrink-0 mt-0.5">{s.step}</div><div><p className="text-sm font-medium text-gray-900 mb-0.5">{s.action}</p><p className="text-xs text-gray-500 leading-relaxed">{s.detail}</p></div></div>)}
                    </div>
                  )}
                </div>
              ))}
              {tracking.verification_checklist?.length > 0 && <div className="card p-4"><p className="text-xs font-medium text-gray-500 mb-3">Verification checklist</p><div className="space-y-2">{tracking.verification_checklist.map((item,i) => <div key={i} className="flex items-start gap-2"><div className="w-4 h-4 border border-gray-300 rounded mt-0.5 shrink-0"></div><p className="text-sm text-gray-700">{item}</p></div>)}</div></div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
export default function CreativePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading...</div>}>
      <CreativePageInner />
    </Suspense>
  )
}
