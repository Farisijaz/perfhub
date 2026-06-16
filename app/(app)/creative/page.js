'use client'
import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { StepTracker, NextBar, ThinkingBar } from '@/components/StepComponents'
import { Play, Copy, Check, ChevronDown, ChevronUp, ExternalLink, Layout, Shield, CheckCircle } from 'lucide-react'

const AD_TYPES = ['Search ads (Google)','Responsive display ads','Meta feed ads','Meta story ads','YouTube bumper ads','LinkedIn sponsored content']
const OBJECTIVES = ['Drive conversions','Generate leads','Increase brand awareness','Drive website traffic','Promote an offer/discount','App installs']

const canvaTemplates = {
  'Meta feed ads': 'https://www.canva.com/create/facebook-ads/',
  'Meta story ads': 'https://www.canva.com/create/instagram-stories/',
  'Responsive display ads': 'https://www.canva.com/create/display-ads/',
  'YouTube bumper ads': 'https://www.canva.com/create/youtube-channel-art/',
  'LinkedIn sponsored content': 'https://www.canva.com/create/linkedin-banners/',
  'Search ads (Google)': null,
}

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
  const [activeAdTab, setActiveAdTab] = useState('copy')
  const [copied, setCopied] = useState('')
  const [expandedTracking, setExpandedTracking] = useState(0)
  const [trackingPlatform, setTrackingPlatform] = useState('google')
  const [loadingTracking, setLoadingTracking] = useState(false)
  const [savedCreativeId, setSavedCreativeId] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [progress, setProgress] = useState({})

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  // Load most recent saved creative + tracking when client changes
  useEffect(() => {
    if (!clientId) {
      setAds(null)
      setTracking(null)
      setSavedCreativeId(null)
      setSavedAt(null)
      return
    }
    loadExisting()
  }, [clientId])

  async function loadExisting() {
    setLoadingExisting(true)
    const supabase = createBrowserClient()
    const { data } = await supabase
      .from('client_creatives')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data?.[0]) {
      const row = data[0]
      if (row.creative_json) {
        setAds(row.creative_json)
        setAdType(row.ad_type || 'Search ads (Google)')
        setObjective(row.objective || 'Drive conversions')
        setProduct(row.product || '')
        setSavedCreativeId(row.id)
        setSavedAt(row.updated_at || row.created_at)
      }
      if (row.tracking_json) {
        setTracking(row.tracking_json)
      }
    }
    setLoadingExisting(false)
  }

  async function saveToSupabase({ creativeData, trackingData }) {
    const supabase = createBrowserClient()
    if (savedCreativeId) {
      // Update existing row
      const update = {}
      if (creativeData !== undefined) {
        update.creative_json = creativeData
        update.ad_type = adType
        update.objective = objective
        update.product = product
      }
      if (trackingData !== undefined) update.tracking_json = trackingData
      update.updated_at = new Date().toISOString()
      const { data } = await supabase
        .from('client_creatives')
        .update(update)
        .eq('id', savedCreativeId)
        .select()
        .single()
      if (data) setSavedAt(data.updated_at)
    } else {
      // Insert new row
      const insert = {
        client_id: clientId,
        ad_type: adType,
        objective: objective,
        product: product,
      }
      if (creativeData !== undefined) insert.creative_json = creativeData
      if (trackingData !== undefined) insert.tracking_json = trackingData
      const { data } = await supabase
        .from('client_creatives')
        .insert(insert)
        .select()
        .single()
      if (data) {
        setSavedCreativeId(data.id)
        setSavedAt(data.created_at)
      }
    }
  }

  function copy(text, id) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  async function generateTracking() {
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    setLoadingTracking(true); setTracking(null)
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'tracking', payload: { clientName: client.name, industry: client.industry, website: client.website, platform: trackingPlatform } })
      })
      const data = await res.json()
      if (data.success) {
        setTracking(data.tracking)
        await saveToSupabase({ trackingData: data.tracking })
      }
    } catch (e) { alert('Error: ' + e.message) }
    setLoadingTracking(false)
  }

  async function generate() {
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    setRunning(true); setAds(null)
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'creative', payload: { clientName: client.name, industry: client.industry, website: client.website, adType, objective, product, usp, cta, tone } })
      })
      const adsData = await res.json()
      if (adsData.success) {
        setAds(adsData.creative)
        await saveToSupabase({ creativeData: adsData.creative })
      }
    } catch (e) { alert('Error: ' + e.message) }
    setRunning(false)
  }

  const priorityColor = { First: 'badge-red', Second: 'badge-amber', Third: 'badge-green', Fourth: 'badge-gray' }

  function AdMockup({ ad, adType }) {
    const client = clients.find(c => c.id === clientId)
    const headline = ad.headlines?.[0] || ad.primary_text?.slice(0,40) || 'Your headline here'
    const headline2 = ad.headlines?.[1] || ''
    const desc = ad.descriptions?.[0] || ad.body_copy || ''
    const primaryText = ad.primary_text || ''
    const ctaText = ad.cta || cta

    if (adType.toLowerCase().includes('search')) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Layout size={10}/> Search Ad Preview</p>
          <div className="border border-gray-100 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] border border-green-700 text-green-700 px-1 rounded font-medium">Ad</span>
              <span className="text-xs text-gray-500">{client?.website?.replace(/https?:\/\//,'') || 'yourwebsite.com'}</span>
            </div>
            <div className="text-blue-700 text-base font-medium leading-tight mb-1">{ad.headlines?.slice(0,3).join(' | ') || headline}</div>
            <div className="text-sm text-gray-600 leading-relaxed">{ad.descriptions?.slice(0,2).join(' ') || desc}</div>
          </div>
        </div>
      )
    }
    if (adType.toLowerCase().includes('story')) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Layout size={10}/> Story Ad Preview</p>
          <div className="mx-auto" style={{width:180,height:320,background:'linear-gradient(135deg,#1a1a2e,#2d2d44)',borderRadius:12,position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding:16}}>
            <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,opacity:.15,background:'radial-gradient(circle at 70% 30%,#e8c97e,transparent)'}}/>
            <div className="text-white text-xs font-medium leading-snug mb-2">{primaryText.slice(0,80)}{primaryText.length>80?'...':''}</div>
            <div style={{background:'white',borderRadius:6,padding:'6px 12px',textAlign:'center',fontSize:11,fontWeight:600,color:'#1a1a2e'}}>{ctaText}</div>
          </div>
        </div>
      )
    }
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Layout size={10}/> Feed Ad Preview</p>
        <div style={{width:'100%',maxWidth:320,margin:'0 auto',border:'1px solid #e5e7eb',borderRadius:10,overflow:'hidden',fontSize:13}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px'}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'#1a1a2e',color:'#e8c97e',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{client?.name?.slice(0,2).toUpperCase()||'CL'}</div>
            <div><div style={{fontWeight:600,fontSize:12}}>{client?.name||'Client'}</div><div style={{fontSize:10,color:'#9ca3af'}}>Sponsored</div></div>
          </div>
          <div style={{padding:'0 12px 8px',fontSize:12,color:'#374151',lineHeight:1.5}}>{primaryText.slice(0,90)}{primaryText.length>90?'...':''}</div>
          <div style={{height:160,background:'linear-gradient(135deg,#e8c97e22,#1a1a2e22)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
            <div style={{textAlign:'center',padding:16}}>
              <div style={{fontSize:11,color:'#6b7280',fontStyle:'italic',marginBottom:8}}>{ad.image_direction?.slice(0,60)||'[Creative visual here]'}</div>
              <div style={{fontSize:16,fontWeight:700,color:'#1a1a2e'}}>{headline}</div>
              {headline2 && <div style={{fontSize:13,color:'#374151',marginTop:4}}>{headline2}</div>}
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderTop:'1px solid #f0f0f0'}}>
            <div><div style={{fontSize:10,color:'#9ca3af'}}>{client?.website?.replace(/https?:\/\//,'')||'website.com'}</div><div style={{fontSize:12,color:'#374151',fontWeight:500}}>{desc.slice(0,40)}</div></div>
            <div style={{background:'#1a1a2e',color:'white',padding:'6px 12px',borderRadius:6,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{ctaText}</div>
          </div>
        </div>
      </div>
    )
  }

  const client = clients.find(c => c.id === clientId)

  return (
    <div>
      <StepTracker current="creative" progress={progress} clientId={clientId}/>
      <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Ad creative & tracking</h1>
          <p className="text-sm text-gray-400 mt-0.5">Agent 4 — AI ad copy, creative briefs and full tracking setup guide</p>
        </div>
      </div>

      {/* Client selector */}
      <div className="card p-4 mb-4">
        <label className="block text-xs text-gray-500 mb-1.5">Client</label>
        <div className="flex items-center gap-3">
          <select className="select max-w-xs" value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {loadingExisting && <span className="text-xs text-gray-400">Loading saved output...</span>}
          {savedAt && !loadingExisting && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle size={11}/> Saved to report · {new Date(savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>

      {/* Top-level tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100">
        {[['ads','Ad creative'],['tracking','Tracking setup']].map(([tab,label]) => (
          <button key={tab} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab===tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`} onClick={() => setActiveTab(tab)}>
            {tab === 'tracking' && <Shield size={13}/>}
            {label}
          </button>
        ))}
      </div>

      {/* AD CREATIVE TAB */}
      {activeTab === 'ads' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
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

          {canvaTemplates[adType] && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-purple-50 rounded-lg border border-purple-100">
              <span className="text-xs text-purple-700 font-medium">Design this in Canva</span>
              <a href={canvaTemplates[adType]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-purple-600 underline hover:text-purple-800"><ExternalLink size={11}/> Open Canva templates</a>
            </div>
          )}

          <div className="flex justify-end mb-4">
            <button className="btn-primary" onClick={generate} disabled={running || !clientId}><Play size={13}/>{running ? 'Generating...' : 'Generate ads'}</button>
          </div>

          {running && <ThinkingBar message="Generating ad copy variants..."/>}

          {ads && (
            <>
              <div className="flex gap-1 mb-4 border-b border-gray-100">
                {[['copy','Ad copy (3 variants)'],['mockup','Creative mockups']].map(([tab,label]) => (
                  <button key={tab} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeAdTab===tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`} onClick={() => setActiveAdTab(tab)}>{label}</button>
                ))}
              </div>

              {activeAdTab === 'copy' && (
                <div className="space-y-4">
                  {ads.ab_test_recommendation && <div className="card p-3 bg-blue-50 border-blue-100"><p className="text-xs font-medium text-blue-700 mb-1">A/B test recommendation</p><p className="text-sm text-blue-600">{ads.ab_test_recommendation}</p></div>}
                  {(ads.ads||[]).map((ad, i) => (
                    <div key={i} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div><span className="text-sm font-medium text-gray-900">{ad.variant}</span><span className="ml-2 text-xs text-gray-400">— {ad.angle}</span></div>
                        <button className="btn-secondary text-xs py-1" onClick={() => {
                          const lines = [ad.headlines?.length?'HEADLINES:\n'+ad.headlines.join('\n'):'',ad.descriptions?.length?'\nDESCRIPTIONS:\n'+ad.descriptions.join('\n'):'',ad.primary_text?'\nPRIMARY TEXT:\n'+ad.primary_text:'',ad.body_copy?'\nBODY COPY:\n'+ad.body_copy:'',ad.image_direction?'\nCREATIVE DIRECTION:\n'+ad.image_direction:''].filter(Boolean).join('\n')
                          copy(lines, `ad-${i}`)
                        }}>{copied===`ad-${i}` ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy all</>}</button>
                      </div>
                      <div className="space-y-3">
                        {ad.headlines?.length > 0 && (
                          <div><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Headlines</p>
                            {ad.headlines.map((h,j) => <div key={j} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 mb-1"><span className="text-sm text-gray-700">{h}</span><div className="flex items-center gap-2 shrink-0 ml-2"><span className={`text-[10px] ${h.length>30?'text-red-500':'text-gray-400'}`}>{h.length}/30</span><button onClick={()=>copy(h,`h-${i}-${j}`)} className="text-gray-300 hover:text-gray-500">{copied===`h-${i}-${j}`?<Check size={11}/>:<Copy size={11}/>}</button></div></div>)}
                          </div>
                        )}
                        {ad.descriptions?.length > 0 && (
                          <div><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Descriptions</p>
                            {ad.descriptions.map((d,j) => <div key={j} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 mb-1"><span className="text-sm text-gray-700">{d}</span><div className="flex items-center gap-2 shrink-0 ml-2"><span className={`text-[10px] ${d.length>90?'text-red-500':'text-gray-400'}`}>{d.length}/90</span><button onClick={()=>copy(d,`d-${i}-${j}`)} className="text-gray-300 hover:text-gray-500">{copied===`d-${i}-${j}`?<Check size={11}/>:<Copy size={11}/>}</button></div></div>)}
                          </div>
                        )}
                        {ad.primary_text && <div><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Primary text</p><div className="flex items-start justify-between bg-gray-50 rounded px-3 py-2"><span className="text-sm text-gray-700 flex-1 mr-2">{ad.primary_text}</span><button onClick={()=>copy(ad.primary_text,`pt-${i}`)} className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5">{copied===`pt-${i}`?<Check size={11}/>:<Copy size={11}/>}</button></div></div>}
                        {ad.body_copy && <div><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Body copy</p><div className="flex items-start justify-between bg-gray-50 rounded px-3 py-2"><span className="text-sm text-gray-700 flex-1 mr-2">{ad.body_copy}</span><button onClick={()=>copy(ad.body_copy,`bc-${i}`)} className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5">{copied===`bc-${i}`?<Check size={11}/>:<Copy size={11}/>}</button></div></div>}
                        {ad.image_direction && <div><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Creative direction</p><p className="text-sm text-gray-500 italic bg-amber-50 px-3 py-2 rounded border-l-2 border-amber-200">{ad.image_direction}</p></div>}
                      </div>
                    </div>
                  ))}
                  {ads.creative_notes && <div className="card p-3 bg-gray-50"><p className="text-xs font-medium text-gray-500 mb-1">Notes for design team</p><p className="text-sm text-gray-600">{ads.creative_notes}</p></div>}
                </div>
              )}

              {activeAdTab === 'mockup' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">Visual previews of each ad variant. Use as reference when designing in Canva.</p>
                    {canvaTemplates[adType] && <a href={canvaTemplates[adType]} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs flex items-center gap-1"><ExternalLink size={11}/> Open Canva</a>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(ads.ads||[]).map((ad, i) => <div key={i}><p className="text-xs font-medium text-gray-500 mb-2">{ad.variant} — {ad.angle}</p><AdMockup ad={ad} adType={adType}/></div>)}
                  </div>
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100"><p className="text-xs text-gray-500"><strong>How to use:</strong> Copy the ad copy from the "Ad copy" tab → paste into your Canva design → use the creative direction as a guide for visuals.</p></div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* TRACKING SETUP TAB */}
      {activeTab === 'tracking' && (
        <div>
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Generate tracking setup guide</p>
                <p className="text-xs text-gray-400">Full step-by-step guide for GTM, GA4, conversion tracking and pixel setup{client ? ` for ${client.name}` : ''}.</p>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Platform focus</label>
                  <div className="flex gap-2">
                    {['google','meta','both'].map(p => <button key={p} onClick={() => setTrackingPlatform(p)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors capitalize ${trackingPlatform===p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>{p === 'both' ? 'Both' : p === 'google' ? 'Google' : 'Meta'}</button>)}
                  </div>
                </div>
                <button className="btn-primary mt-4" onClick={generateTracking} disabled={loadingTracking || !clientId}><Shield size={13}/>{loadingTracking ? 'Generating...' : 'Generate guide'}</button>
              </div>
            </div>
          </div>

          {!clientId && <div className="card p-8 text-center"><p className="text-sm text-gray-400">Select a client above to generate their tracking setup guide</p></div>}

          {loadingTracking && <ThinkingBar message="Building full tracking setup guide..."/>}

          {tracking && (
            <div className="space-y-3">
              {tracking.key_events_to_track?.length > 0 && (
                <div className="card p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Key events to track</p>
                  <div className="flex flex-wrap gap-2">{tracking.key_events_to_track.map((e,i) => <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-mono">{e}</span>)}</div>
                </div>
              )}

              {tracking.gtm_tags_needed?.length > 0 && (
                <div className="card p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">GTM tags needed</p>
                  <div className="flex flex-wrap gap-2">{tracking.gtm_tags_needed.map((t,i) => <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded">{t}</span>)}</div>
                </div>
              )}

              {(tracking.tracking_setup||[]).map((platform, i) => (
                <div key={i} className="card overflow-hidden">
                  <button className="w-full flex items-center justify-between p-4" onClick={() => setExpandedTracking(expandedTracking === i ? null : i)}>
                    <div className="flex items-center gap-3">
                      <span className={priorityColor[platform.priority]||'badge-gray'}>{platform.priority}</span>
                      <p className="text-sm font-medium text-gray-900">{platform.platform}</p>
                    </div>
                    {expandedTracking === i ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                  </button>
                  {expandedTracking === i && (
                    <div className="border-t border-gray-50 p-4 space-y-4">
                      {(platform.steps||[]).map((s,j) => (
                        <div key={j} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-900 text-white text-[11px] font-medium flex items-center justify-center shrink-0 mt-0.5">{s.step}</div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 mb-0.5">{s.action}</p>
                            <p className="text-xs text-gray-500 leading-relaxed">{s.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {tracking.verification_checklist?.length > 0 && (
                <div className="card p-4">
                  <p className="text-xs font-medium text-gray-500 mb-3">Verification checklist</p>
                  <div className="space-y-2">
                    {tracking.verification_checklist.map((item,i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-4 h-4 border border-gray-300 rounded mt-0.5 shrink-0"></div>
                        <p className="text-sm text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!running && ads && activeTab === 'ads' && (
        <NextBar current="creative" clientId={clientId} label="Ad creative complete — ready to export report"/>
      )}
      </div>
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
