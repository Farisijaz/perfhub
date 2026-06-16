import { callClaude, callClaudeWithSearch, safeJSON, MODELS } from '@/lib/claude'
import { createServerClient } from '@/lib/supabase'

// Cache TTL in days — results fresher than this are served from Supabase, no API call
const CACHE_TTL_DAYS = {
  market_audit: 7,   // market benchmarks don't change daily
  competitor:   3,   // competitor intel can shift but not daily
  audit:        1,   // account audits should stay fresh
  strategy:     7,   // strategy is stable once built
}

function cacheExpired(createdAt, agent) {
  if (!createdAt) return true
  const ttl = CACHE_TTL_DAYS[agent] || 1
  const ageMs = Date.now() - new Date(createdAt).getTime()
  return ageMs > ttl * 24 * 60 * 60 * 1000
}

export async function POST(request) {
  try {
    const { agent, payload } = await request.json()

    switch (agent) {

      case 'audit': {
        const { clientName, industry, platform, dateRange, metrics, clientId } = payload

        // Cache check — if same client has a recent audit and no new CSV, return cached
        if (clientId && !metrics) {
          const supabase = createServerClient()
          const { data: cached } = await supabase
            .from('audits')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          if (cached && !cacheExpired(cached.created_at, 'audit')) {
            return Response.json({
              success: true,
              summary: cached.summary,
              recommendations: cached.recommendations_json,
              cached: true,
            })
          }
        }

        const benchmarks = {
          'F&B / Restaurant':     { roas: 3.5, cpa: 35,  cpc: 1.2, cpm: 8  },
          'E-commerce':           { roas: 4.0, cpa: 200, cpc: 1.5, cpm: 10 },
          'Real Estate':          { roas: 2.5, cpa: 800, cpc: 3.5, cpm: 15 },
          'Healthcare':           { roas: 3.0, cpa: 120, cpc: 2.8, cpm: 12 },
          'Education':            { roas: 2.8, cpa: 150, cpc: 2.2, cpm: 11 },
          'Automotive':           { roas: 3.2, cpa: 600, cpc: 2.5, cpm: 13 },
          'Finance':              { roas: 2.8, cpa: 200, cpc: 3.8, cpm: 14 },
          'Retail':               { roas: 4.0, cpa: 120, cpc: 1.4, cpm: 9  },
          'Travel & Hospitality': { roas: 3.8, cpa: 250, cpc: 1.8, cpm: 11 },
          'Technology':           { roas: 3.0, cpa: 180, cpc: 3.2, cpm: 13 },
          'Fashion':              { roas: 4.2, cpa: 180, cpc: 1.3, cpm: 9  },
          'Beauty & Wellness':    { roas: 4.0, cpa: 150, cpc: 1.4, cpm: 9  },
        }
        const b = benchmarks[industry] || { roas: 3.5, cpa: 150, cpc: 2.0, cpm: 10 }
        const metricsText = metrics
          ? `Spend: AED ${metrics.totals.spend.toFixed(2)} | Clicks: ${metrics.totals.clicks} | Impressions: ${metrics.totals.impressions.toLocaleString()} | Conversions: ${metrics.totals.conversions} | ROAS: ${metrics.roas.toFixed(2)}x | CPC: AED ${metrics.cpc.toFixed(2)} | CPM: AED ${metrics.cpm.toFixed(2)} | CPA: AED ${metrics.cpa.toFixed(2)} | CTR: ${metrics.ctr.toFixed(2)}% | Conv rate: ${metrics.convRate.toFixed(2)}%${metrics.frequency ? ` | Frequency: ${metrics.frequency.toFixed(1)}` : ''}`
          : 'No CSV uploaded — provide general best-practice audit recommendations.'

        const text = await callClaudeWithSearch({
          model: MODELS.standard,
          maxTokens: 2500,
          systemPrompt: `You are a senior performance marketing analyst at a Dubai agency. Search for current ${industry} ${platform === 'google' ? 'Google Ads' : 'Meta Ads'} benchmarks. Write in plain paragraphs only. No markdown, no headers, no bullet points.`,
          userPrompt: `Audit for ${clientName} (${industry}) — ${platform === 'google' ? 'Google Ads' : 'Meta Ads'}, ${dateRange}. Currency: AED.\n\nSearch: "${industry} ${platform === 'google' ? 'Google Ads' : 'Meta Ads'} benchmarks ${new Date().getFullYear()} CPC ROAS"\n\nMetrics: ${metricsText}\nBenchmarks: ROAS ${b.roas}x | CPA AED ${b.cpa} | CPC AED ${b.cpc} | CPM AED ${b.cpm}\n\nWrite 4 paragraphs: (1) Account health vs benchmarks. (2) Top issues with numbers. (3) Opportunities. (4) 3 priority actions with expected uplift. End with one bottom-line sentence.`,
        })

        const recommendations = buildAuditRecos(metrics, b, platform, industry)
        return Response.json({ success: true, summary: text, recommendations, benchmarks: b })
      }

      case 'competitor': {
        const { clientName, industry, competitorName, competitorUrl, clientId } = payload

        // Cache check — return recent analysis if within TTL
        if (clientId) {
          const supabase = createServerClient()
          const { data: cached } = await supabase
            .from('competitor_analyses')
            .select('*')
            .eq('client_id', clientId)
            .eq('competitor_name', competitorName)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          if (cached && !cacheExpired(cached.created_at, 'competitor')) {
            return Response.json({ success: true, analysis: cached.analysis_json, cached: true })
          }
        }

        const text = await callClaudeWithSearch({
          model: MODELS.standard,
          maxTokens: 3000,
          systemPrompt: `You are a competitive intelligence analyst at a Dubai performance marketing agency. Search the web for real current data. CRITICAL: Respond with a single valid JSON object only. No text before or after. No markdown. Start with { end with }.`,
          userPrompt: `Analyse "${competitorName}" (${competitorUrl || 'no URL'}) as a competitor to ${clientName} in ${industry || 'digital marketing'} in UAE/Middle East.\n\nSearch: "${competitorName} ads marketing ${new Date().getFullYear()}" and "${competitorName} digital advertising social media"\n\nJSON only:\n{\n  "overview": "2-3 sentence overview",\n  "organic_social": {\n    "estimated_followers": "range",\n    "posting_frequency": "X posts/week",\n    "engagement_rate": "X%",\n    "top_content_themes": ["theme1","theme2","theme3"],\n    "platforms": ["Instagram","Facebook"]\n  },\n  "paid_advertising": {\n    "is_running_ads": true,\n    "estimated_platforms": ["Google Ads","Meta Ads"],\n    "estimated_monthly_spend": "AED X,000 - AED X,000",\n    "ad_angles": ["angle1","angle2","angle3"]\n  },\n  "strengths": ["s1","s2","s3"],\n  "weaknesses": ["w1","w2","w3"],\n  "opportunities_for_client": ["o1","o2","o3"],\n  "threat_level": "High",\n  "threat_reason": "one sentence"\n}`,
        })
        const analysis = safeJSON(text)
        if (!analysis) return Response.json({ success: false, error: 'Could not parse analysis' }, { status: 500 })
        return Response.json({ success: true, analysis })
      }

      case 'strategy': {
        const { clientName, industry, goal, budget, duration, channels, currentRoas, clientId } = payload

        // Cache check
        if (clientId) {
          const supabase = createServerClient()
          const { data: cached } = await supabase
            .from('strategies')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          if (cached && !cacheExpired(cached.created_at, 'strategy')) {
            return Response.json({ success: true, strategy: cached.strategy_json, cached: true })
          }
        }

        const hasTrackingIssue = currentRoas === 0 || currentRoas === '0' || currentRoas === '0.00'
        const text = await callClaudeWithSearch({
          model: MODELS.premium,
          maxTokens: 6000,
          systemPrompt: `You are a senior performance marketing strategist at a Dubai agency. Search for current market data before building the strategy. CRITICAL: Respond with a single valid JSON object only. No text before or after. No markdown. Start with { end with }.`,
          userPrompt: `Strategy for ${clientName} (${industry}).\nSearch: "${industry} digital marketing benchmarks UAE ${new Date().getFullYear()}"\nGoal: ${goal} | Budget: AED ${budget}/month | Duration: ${duration} | Channels: ${channels.join(', ')} | Market: UAE\n${hasTrackingIssue ? 'CRITICAL: ROAS is 0 — conversion tracking is broken. Make fixing tracking the top priority action.' : ''}\n\nJSON only:\n{\n  "executive_summary": "3-4 sentence overview",\n  "market_opportunity": "2-3 sentences on UAE opportunity",\n  "tracking_alert": ${hasTrackingIssue ? '"CRITICAL: Conversion tracking broken. Fix before scaling spend."' : 'null'},\n  "target_audience": {\n    "primary": "detailed description",\n    "secondary": "description",\n    "demographics": "age, gender, income, location",\n    "interests": ["i1","i2","i3","i4","i5"]\n  },\n  "channel_strategy": [\n    {\n      "channel": "name",\n      "role": "conversion|awareness|consideration",\n      "budget_percentage": 40,\n      "monthly_budget": 4000,\n      "rationale": "why this channel",\n      "bid_strategy": "specific bid strategy",\n      "campaign_types": ["type1","type2"],\n      "budget_split": [{"campaign_type":"name","budget_aed":2000,"percentage":50,"rationale":"why"}],\n      "kpis": ["ROAS 4x","CPA AED 30"],\n      "benchmarks": {"cpc":"AED 1.50","cpm":"AED 8","ctr":"3%","cpa":"AED 30","roas":"4x"}\n    }\n  ],\n  "keyword_strategy": {\n    "branded_keywords": ["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8","kw9","kw10"],\n    "non_brand_keywords": ["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8","kw9","kw10"],\n    "account_level_negatives": ["neg1","neg2","neg3","neg4","neg5","neg6","neg7","neg8","neg9","neg10"],\n    "campaign_level_negatives": ["neg1","neg2","neg3","neg4","neg5","neg6","neg7","neg8","neg9","neg10"]\n  },\n  "media_plan": {\n    "month1": "Week 1-2: setup tasks. Week 3-4: launch tasks.",\n    "month2": "optimization focus",\n    "month3": "scaling tactics"\n  },\n  "expected_kpis": {\n    "monthly_impressions": "range",\n    "monthly_clicks": "range",\n    "monthly_conversions": "range",\n    "expected_roas": "Xx",\n    "expected_cpa": "AED X",\n    "expected_cpl": "AED X or N/A"\n  },\n  "quick_wins": [\n    {"action":"action","timeline":"Week 1","expected_impact":"result"},\n    {"action":"action","timeline":"Week 1","expected_impact":"result"},\n    {"action":"action","timeline":"Week 2","expected_impact":"result"},\n    {"action":"action","timeline":"Week 3-4","expected_impact":"result"}\n  ],\n  "risks": ["risk1 with mitigation","risk2 with mitigation"]\n}`,
        })
        const strategy = safeJSON(text)
        if (!strategy) return Response.json({ success: false, error: 'Could not parse strategy' }, { status: 500 })
        return Response.json({ success: true, strategy })
      }

      case 'creative': {
        const { clientName, industry, adType, objective, product, usp, cta, tone } = payload
        const text = await callClaude({
          model: MODELS.standard,
          maxTokens: 4000,
          systemPrompt: `You are a performance marketing copywriter for UAE markets. Always respond with valid JSON only, no markdown, no backticks, no extra text.`,
          userPrompt: `Write ${adType} for ${clientName} (${industry}).\nObjective: ${objective} | Product: ${product || 'main product/service'} | USPs: ${usp || 'quality and reliability'} | CTA: ${cta} | Tone: ${tone} | Market: UAE/Dubai\n\nSTRICT LIMITS: Headlines max 30 chars. Descriptions max 90 chars. Primary text max 125 chars.\nFor Search/RSA: 15 headlines, 5 descriptions per variant. For Meta/Display: 5 headlines, 5 descriptions + primary_text.\n\nJSON only:\n{\n  "ads": [\n    {\n      "variant": "Variant A",\n      "angle": "angle name",\n      "headlines": ["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],\n      "descriptions": ["d1","d2","d3","d4","d5"],\n      "primary_text": "under 125 chars",\n      "body_copy": "2-3 sentence body",\n      "cta": "${cta}",\n      "image_direction": "visual brief"\n    },\n    {"variant":"Variant B","angle":"different angle","headlines":["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],"descriptions":["d1","d2","d3","d4","d5"],"primary_text":"under 125","body_copy":"body","cta":"${cta}","image_direction":"brief"},\n    {"variant":"Variant C","angle":"third angle","headlines":["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],"descriptions":["d1","d2","d3","d4","d5"],"primary_text":"under 125","body_copy":"body","cta":"${cta}","image_direction":"brief"}\n  ],\n  "ab_test_recommendation": "which to test first and why",\n  "creative_notes": "notes for design team"\n}`,
        })
        const creative = safeJSON(text)
        if (!creative) return Response.json({ success: false, error: 'Could not parse creative' }, { status: 500 })
        return Response.json({ success: true, creative })
      }

      case 'tracking': {
        const { clientName, industry, platform, website } = payload
        // Tracking setup is mostly static — use fast model
        const text = await callClaude({
          model: MODELS.fast,
          maxTokens: 2500,
          systemPrompt: `You are a digital marketing tracking specialist. Provide clear step-by-step guides for GTM, GA4, Meta Pixel, and CAPI. Write for a non-technical marketing manager. Always respond with valid JSON only, no markdown, no backticks.`,
          userPrompt: `Create a complete tracking setup guide for ${clientName} (${industry}). Platform: ${platform} | Website: ${website || 'not provided'} | Market: UAE\n\nJSON only:\n{\n  "tracking_setup": [\n    {\n      "platform": "Google Tag Manager",\n      "priority": "First",\n      "steps": [{"step":1,"action":"Create GTM account","detail":"Go to tagmanager.google.com, sign in, click Create Account, enter company name and website URL"},{"step":2,"action":"Install GTM snippet","detail":"Copy the container snippet from Admin > Install GTM and paste first part in <head>, second part after opening <body> tag"}]\n    },\n    {\n      "platform": "GA4 Setup",\n      "priority": "Second",\n      "steps": [{"step":1,"action":"Create GA4 property","detail":"Go to analytics.google.com, click Admin, Create Property, select GA4, enter website details"}]\n    },\n    {\n      "platform": "Meta Pixel and CAPI",\n      "priority": "Third",\n      "steps": [{"step":1,"action":"Create Meta Pixel","detail":"Go to Meta Business Manager, Events Manager, Connect Data Sources, select Web, then Meta Pixel"}]\n    },\n    {\n      "platform": "Google Ads Conversion Tracking",\n      "priority": "Fourth",\n      "steps": [{"step":1,"action":"Create conversion action","detail":"In Google Ads, click Tools and Settings, then Conversions, click the blue plus, select Website"},{"step":2,"action":"Set conversion value","detail":"Select Use different values for each conversion, set default value to your average order value in AED. Critical for ROAS tracking."}]\n    }\n  ],\n  "key_events_to_track": ["purchase","lead","page_view","add_to_cart","begin_checkout","contact_form_submit","phone_call_click"],\n  "gtm_tags_needed": ["GA4 Configuration Tag","Meta Pixel Base Code","Google Ads Conversion Tracking","GA4 Event Tags","Purchase Event with Revenue Value"],\n  "verification_checklist": ["GTM Preview mode shows all tags firing","GA4 DebugView shows events in real time","Meta Pixel Helper shows pixel active","Google Tag Assistant confirms tag working","Test purchase shows conversion value in Google Ads within 3 hours","ROAS is no longer showing 0.00x"]\n}`,
        })
        const tracking = safeJSON(text)
        if (!tracking) return Response.json({ success: false, error: 'Could not parse tracking' }, { status: 500 })
        return Response.json({ success: true, tracking })
      }

      // ── MERGED: market_audit + strategy in ONE API call ──
      // This replaces the separate market_audit + market_strategy calls
      case 'market_audit': {
        const { clientName, industry, website, market, competitors, budget, clientId } = payload

        // Cache check — if a fresh market audit exists for same client+market, return it
        if (clientId) {
          const supabase = createServerClient()
          const { data: cached } = await supabase
            .from('market_audits')
            .select('*')
            .eq('client_id', clientId)
            .eq('market', market)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (cached && !cacheExpired(cached.created_at, 'market_audit')) {
            return Response.json({
              success: true,
              benchmarks: cached.benchmark_json,
              competitor_intel: cached.competitor_intel_json,
              opportunities: cached.opportunities_json,
              summary: cached.summary,
              strategy: cached.strategy_json,
              cached: true,
            })
          }
        }

        const competitorList = competitors.map((c, i) => `${i+1}. ${c.name}${c.website ? ' (' + c.website + ')' : ''}`).join('\n')

        // ONE call that returns both audit data AND strategy
        const text = await callClaudeWithSearch({
          model: MODELS.premium,
          maxTokens: 7000,
          systemPrompt: `You are a senior performance marketing strategist specialising in paid advertising. Search the web for real current data on this market and industry. CRITICAL: Your ENTIRE response must be a single valid JSON object only. No text before or after. No markdown. No backticks. Start with { end with }.`,
          userPrompt: `Conduct a market audit AND build a launch strategy for a new business entering paid advertising for the first time.\n\nSearch for:\n1. "${industry} Google Ads benchmarks ${market} ${new Date().getFullYear()} CPC CPM ROAS"\n2. "${industry} Meta Ads benchmarks ${market} ${new Date().getFullYear()}"\n3. "${competitors.map(c=>c.name).join(' OR ')} digital advertising ${new Date().getFullYear()}"\n\nClient: ${clientName}\nIndustry: ${industry}\nWebsite: ${website || 'not provided'}\nTarget market: ${market}\nMonthly budget: ${budget ? 'AED ' + budget : 'not set'}\nCompetitors:\n${competitorList}\n\nJSON only:\n{\n  "summary": "3-4 paragraph market overview: paid advertising landscape in ${market} for ${industry}, competitive intensity, platform preferences, what a new entrant needs to know",\n  "benchmarks": {\n    "google": {\n      "avg_cpc": "AED X.XX",\n      "avg_cpm": "AED X.XX",\n      "avg_ctr": "X.X%",\n      "avg_cpa": "AED XXX",\n      "avg_roas": "X.Xx",\n      "avg_conv_rate": "X.X%"\n    },\n    "meta": {\n      "avg_cpc": "AED X.XX",\n      "avg_cpm": "AED X.XX",\n      "avg_ctr": "X.X%",\n      "avg_cpa": "AED XXX",\n      "avg_roas": "X.Xx",\n      "avg_engagement_rate": "X.X%"\n    },\n    "platform_notes": "which platforms dominate in ${market} for this industry and why"\n  },\n  "competitor_intel": [\n    {\n      "name": "competitor name",\n      "website": "their website",\n      "ad_presence": "Strong|Moderate|Weak",\n      "estimated_spend": "AED X,000 - AED X,000/month",\n      "platforms": ["Google Ads","Meta Ads"],\n      "ad_angles": ["angle1","angle2","angle3"],\n      "likely_keywords": ["kw1","kw2","kw3","kw4","kw5"],\n      "gap": "what they are missing that ${clientName} can exploit"\n    }\n  ],\n  "opportunities": [\n    {"title":"opportunity","detail":"2-3 sentence explanation specific to ${market}","action":"first action to take"},\n    {"title":"opportunity","detail":"explanation","action":"action"},\n    {"title":"opportunity","detail":"explanation","action":"action"}\n  ],\n  "strategy": {\n    "executive_summary": "3-4 sentence launch overview tailored to ${market}",\n    "target_audience": {\n      "primary": "detailed description with age, location in ${market}, income, behaviour",\n      "secondary": "secondary audience",\n      "interests": ["i1","i2","i3","i4","i5"]\n    },\n    "channel_strategy": [\n      {\n        "channel": "channel name",\n        "role": "conversion|awareness|consideration",\n        "budget_percentage": 55,\n        "monthly_budget": 5500,\n        "rationale": "why this channel for ${market} and this industry",\n        "bid_strategy": "specific bid strategy for new account with no data",\n        "budget_split": [{"campaign_type":"name","budget_aed":2000,"percentage":50,"rationale":"why"}]\n      }\n    ],\n    "keyword_strategy": {\n      "branded_keywords": ["kw1","kw2","kw3","kw4","kw5"],\n      "non_brand_keywords": ["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8","kw9","kw10"],\n      "competitor_keywords": ["kw1","kw2","kw3"],\n      "account_level_negatives": ["neg1","neg2","neg3","neg4","neg5"]\n    },\n    "expected_kpis": {\n      "monthly_impressions": "range",\n      "monthly_clicks": "range",\n      "monthly_conversions": "range",\n      "expected_roas": "Xx",\n      "expected_cpa": "AED X",\n      "expected_cpl": "AED X or N/A"\n    },\n    "quick_wins": [\n      {"action":"action","timeline":"Week 1","expected_impact":"result"},\n      {"action":"action","timeline":"Week 2","expected_impact":"result"},\n      {"action":"action","timeline":"Week 3-4","expected_impact":"result"}\n    ],\n    "launch_checklist": ["item1","item2","item3","item4","item5"]\n  }\n}`,
        })

        const result = safeJSON(text)
        if (!result) return Response.json({ success: false, error: 'Could not parse market audit' }, { status: 500 })

        // Return in the shape the frontend expects, with strategy nested
        return Response.json({
          success: true,
          benchmarks: result.benchmarks,
          competitor_intel: result.competitor_intel,
          opportunities: result.opportunities,
          summary: result.summary,
          strategy: result.strategy,
        })
      }

      // market_strategy is now handled inside market_audit above.
      // Keep this case as a no-op fallback so old calls don't 500.
      case 'market_strategy': {
        return Response.json({ success: true, strategy: null, cached: true })
      }

      case 'insight': {
        const { clientName, industry, auditCount, latestMetrics, strategyCount, competitorNames } = payload
        const text = await callClaude({
          model: MODELS.fast,
          maxTokens: 600,
          systemPrompt: `You are a senior performance marketing analyst. Write sharp executive-level insights in plain paragraphs. No markdown, no headers, no bullet points.`,
          userPrompt: `Write a concise performance summary for ${clientName} (${industry}).\nAudits: ${auditCount} | Metrics: ${JSON.stringify(latestMetrics?.slice(0,3))} | Strategies: ${strategyCount} | Competitors: ${competitorNames}\n\n3 short paragraphs: (1) Current account health. (2) Strategic progress. (3) Top 2 focus areas this week. Be direct.`,
        })
        return Response.json({ success: true, insight: text })
      }

      default:
        return Response.json({ success: false, error: 'Unknown agent' }, { status: 400 })
    }
  } catch (err) {
    console.error('Agent error:', err)
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}

function buildAuditRecos(data, b, platform, industry) {
  if (!data) return [{ title: 'Upload a CSV for personalised recommendations', desc: 'Export from your ad platform and upload above.', impact: 'High' }]
  const r = []
  if (data.roas === 0) r.push({ title: 'Conversion value tracking is broken — fix immediately', desc: 'ROAS is showing 0.00x because Google Ads is not receiving purchase values. Go to Tools → Conversions → your purchase action → set value to your average order value in AED. Without this, Smart Bidding cannot optimise properly.', impact: 'High' })
  else if (data.roas < b.roas) r.push({ title: 'ROAS below benchmark — restructure bid strategy', desc: `ROAS of ${data.roas.toFixed(1)}x is below the ${b.roas}x benchmark. Switch to Target ROAS bidding at ${(b.roas * 0.9).toFixed(1)}x. Expected: +20-35% ROAS in 4 weeks.`, impact: 'High' })
  if (data.cpa > b.cpa) r.push({ title: 'CPA above target — align landing pages to ad copy', desc: `CPA of AED ${data.cpa.toFixed(0)} exceeds the AED ${b.cpa} target. A/B test landing page headlines. Expected: 15-25% CPA reduction.`, impact: 'High' })
  if (data.ctr < 2) r.push({ title: 'Low CTR — test new headlines and creative formats', desc: `CTR of ${data.ctr.toFixed(2)}% is below the 3.1% average. Test video formats which drive 20-30% higher CTR.`, impact: 'Medium' })
  if (platform === 'meta' && data.frequency > 3) r.push({ title: 'Ad fatigue — refresh creatives urgently', desc: `Frequency of ${data.frequency.toFixed(1)} exceeds the 3.0 optimal ceiling. Introduce 4-6 new variants immediately.`, impact: 'High' })
  if (platform === 'google' && data.cpc > b.cpc * 1.3) r.push({ title: 'CPC elevated — add negative keywords', desc: `CPC of AED ${data.cpc.toFixed(2)} is above the AED ${b.cpc} average. Run a search term report and add negatives. Expected: 10-20% CPC reduction.`, impact: 'Medium' })
  r.push({ title: 'Set automated budget protection rules', desc: `Pause ads with CPA above AED ${(b.cpa * 1.5).toFixed(0)} after 100 impressions. Scale budget +20% when ROAS exceeds ${(b.roas * 1.2).toFixed(1)}x.`, impact: 'Medium' })
  return r.slice(0, 5)
}
