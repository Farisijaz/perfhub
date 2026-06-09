import { callClaude, safeJSON } from '@/lib/claude'
import { createServerClient } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { agent, payload } = await request.json()

    switch (agent) {

      case 'audit': {
        const { clientName, industry, platform, dateRange, metrics } = payload
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

        const text = await callClaude({
          systemPrompt: `You are a senior performance marketing analyst at a leading digital agency in Dubai. Write direct, specific, client-ready audit reports. Write in plain flowing paragraphs only. Do not use markdown, headers, bullet points, asterisks, hashtags, or any special formatting. No bold text. Just clean professional paragraphs separated by line breaks.`,
          userPrompt: `Write a performance audit for ${clientName} (${industry}) — ${platform === 'google' ? 'Google Ads' : 'Meta Ads'}. Period: ${dateRange}. Currency is AED.

Metrics: ${metricsText}
Benchmarks: ROAS ${b.roas}x | CPA AED ${b.cpa} | CPC AED ${b.cpc} | CPM AED ${b.cpm}

Write 4 paragraphs with no headers or formatting:
Paragraph 1: Overall account health vs benchmarks.
Paragraph 2: Top issues with specific numbers.
Paragraph 3: Opportunities to scale.
Paragraph 4: 3 priority actions with expected improvement.
End with one bottom-line sentence.`
        })

        const recommendations = buildAuditRecos(metrics, b, platform, industry)
        return Response.json({ success: true, summary: text, recommendations, benchmarks: b })
      }

      case 'competitor': {
        const { clientName, industry, competitorName, competitorUrl } = payload
        const text = await callClaude({
          systemPrompt: `You are a senior competitive intelligence analyst at a performance marketing agency in Dubai. Be specific, data-driven, and actionable. Always respond with valid JSON only, no other text, no markdown.`,
          userPrompt: `Analyse "${competitorName}" (${competitorUrl || 'no URL'}) as a competitor to ${clientName} in the ${industry || 'digital marketing'} industry in UAE/Middle East.

Respond with ONLY this JSON, no markdown, no backticks:
{
  "overview": "2-3 sentence company overview",
  "organic_social": {
    "estimated_followers": "estimated follower range",
    "posting_frequency": "estimated posts per week",
    "engagement_rate": "estimated %",
    "top_content_themes": ["theme1", "theme2", "theme3"],
    "platforms": ["Instagram", "Facebook"]
  },
  "paid_advertising": {
    "is_running_ads": true,
    "estimated_platforms": ["Google Ads", "Meta Ads"],
    "ad_themes": ["theme1", "theme2"],
    "estimated_monthly_spend": "AED X,000 - AED X,000",
    "ad_angles": ["angle1", "angle2", "angle3"]
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "opportunities_for_client": ["opportunity1", "opportunity2", "opportunity3"],
  "threat_level": "High",
  "threat_reason": "one sentence"
}`
        })
        const analysis = safeJSON(text)
        if (!analysis) return Response.json({ success: false, error: 'Could not parse analysis' }, { status: 500 })
        return Response.json({ success: true, analysis })
      }

      case 'strategy': {
        const { clientName, industry, goal, budget, duration, channels, currentRoas } = payload
        const hasTrackingIssue = currentRoas === 0 || currentRoas === '0' || currentRoas === '0.00'
        const text = await callClaude({
          systemPrompt: `You are a senior performance marketing strategist at a leading digital agency in Dubai. Create comprehensive, highly actionable strategies for UAE/Middle East clients. Include specific keywords, bid strategies, budget splits, and timelines. Always respond with valid JSON only, no markdown, no backticks.`,
          userPrompt: `Create a detailed performance marketing strategy for ${clientName} (${industry}).
Goal: ${goal} | Budget: AED ${budget}/month | Duration: ${duration} | Channels: ${channels.join(', ')} | Market: UAE
${hasTrackingIssue ? 'IMPORTANT: Conversion value tracking appears broken (ROAS showing 0). Include tracking fix as the highest priority action.' : ''}

Respond with ONLY this JSON, no markdown:
{
  "executive_summary": "3-4 sentence overview including budget allocation approach and expected outcome",
  "market_opportunity": "2-3 sentences on UAE market opportunity specific to this industry",
  "tracking_alert": ${hasTrackingIssue ? '"CRITICAL: Conversion value tracking is not configured. Fix this before scaling spend or ROAS cannot be measured."' : 'null'},
  "target_audience": {
    "primary": "detailed description with age, gender, location, income level",
    "secondary": "description",
    "demographics": "age range, gender split, income level, location",
    "interests": ["interest1", "interest2", "interest3", "interest4", "interest5"]
  },
  "channel_strategy": [
    {
      "channel": "channel name",
      "role": "conversion or awareness or consideration or retention",
      "budget_percentage": 40,
      "monthly_budget": 4000,
      "rationale": "specific reason this channel fits this client and goal",
      "bid_strategy": "e.g. Target ROAS at 4x, or Maximize Conversions with Target CPA AED 30",
      "campaign_types": ["e.g. Branded Search", "Non-brand Search", "Shopping/PMax"],
      "budget_split": [
        {"campaign_type": "Branded Search", "budget_aed": 1500, "percentage": 15, "rationale": "why"},
        {"campaign_type": "Shopping/PMax", "budget_aed": 5000, "percentage": 50, "rationale": "why"},
        {"campaign_type": "Non-brand Search", "budget_aed": 3500, "percentage": 35, "rationale": "why"}
      ],
      "kpis": ["ROAS 4x", "CPA AED 30"],
      "benchmarks": { "cpc": "AED 1.50", "cpm": "AED 8", "ctr": "3%", "cpa": "AED 30", "roas": "4x" }
    }
  ],
  "keyword_strategy": {
    "branded_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8", "keyword9", "keyword10", "keyword11", "keyword12", "keyword13", "keyword14", "keyword15"],
    "non_brand_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8", "keyword9", "keyword10", "keyword11", "keyword12", "keyword13", "keyword14", "keyword15"],
    "account_level_negatives": ["negative1", "negative2", "negative3", "negative4", "negative5", "negative6", "negative7", "negative8", "negative9", "negative10", "negative11", "negative12", "negative13", "negative14", "negative15"],
    "campaign_level_negatives": ["negative1", "negative2", "negative3", "negative4", "negative5", "negative6", "negative7", "negative8", "negative9", "negative10", "negative11", "negative12", "negative13", "negative14", "negative15"]
  },
  "creative_direction": {
    "messaging_pillars": ["pillar1", "pillar2", "pillar3"],
    "tone": "brand tone description",
    "formats": ["format1", "format2", "format3"]
  },
  "media_plan": {
    "month1": "Week 1-2: specific setup tasks. Week 3-4: specific launch tasks.",
    "month2": "focus and optimization tactics",
    "month3": "scaling tactics and what to measure"
  },
  "expected_kpis": {
    "monthly_impressions": "range",
    "monthly_clicks": "range",
    "monthly_conversions": "range",
    "expected_roas": "Xx",
    "expected_cpa": "AED X",
    "expected_cpl": "AED X or N/A"
  },
  "quick_wins": [
    {"action": "action description", "timeline": "Week 1", "expected_impact": "specific expected result"},
    {"action": "action description", "timeline": "Week 1", "expected_impact": "specific expected result"},
    {"action": "action description", "timeline": "Week 2", "expected_impact": "specific expected result"},
    {"action": "action description", "timeline": "Week 2", "expected_impact": "specific expected result"},
    {"action": "action description", "timeline": "Week 3-4", "expected_impact": "specific expected result"}
  ],
  "risks": ["risk1 with mitigation", "risk2 with mitigation"]
}`
        })
        const strategy = safeJSON(text)
        if (!strategy) return Response.json({ success: false, error: 'Could not parse strategy' }, { status: 500 })
        return Response.json({ success: true, strategy })
      }

      case 'creative': {
        const { clientName, industry, adType, objective, product, usp, cta, tone } = payload
        const text = await callClaude({
          systemPrompt: `You are a world-class performance marketing copywriter. You write high-converting ads for Dubai and UAE markets. Always respond with valid JSON only, no markdown, no backticks, no extra text.`,
          userPrompt: `Write ${adType} for ${clientName} (${industry}).
Objective: ${objective} | Product: ${product || 'main product/service'} | USPs: ${usp || 'quality and reliability'} | CTA: ${cta} | Tone: ${tone} | Market: UAE/Dubai

STRICT CHARACTER LIMITS — count every character including spaces:
- Each headline: MAXIMUM 30 characters. Count carefully. If in doubt, make it shorter.
- Each description: MAXIMUM 90 characters. Count carefully. Never exceed 90.
- Primary text (Meta): MAXIMUM 125 characters.

For Search/RSA ads: provide exactly 15 headlines and exactly 5 descriptions per variant.
For Meta/Display ads: provide 5 headlines and 5 descriptions plus primary_text and body_copy.

Respond with ONLY this JSON, no markdown:
{
  "ads": [
    {
      "variant": "Variant A",
      "angle": "angle name",
      "headlines": ["h1 under 30", "h2 under 30", "h3 under 30", "h4 under 30", "h5 under 30", "h6 under 30", "h7 under 30", "h8 under 30", "h9 under 30", "h10 under 30", "h11 under 30", "h12 under 30", "h13 under 30", "h14 under 30", "h15 under 30"],
      "descriptions": ["desc1 under 90 chars total", "desc2 under 90 chars total", "desc3 under 90 chars total", "desc4 under 90 chars total", "desc5 under 90 chars total"],
      "primary_text": "under 125 chars for meta",
      "body_copy": "2-3 sentence body copy",
      "cta": "${cta}",
      "image_direction": "visual brief for designer"
    },
    {
      "variant": "Variant B",
      "angle": "different angle",
      "headlines": ["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],
      "descriptions": ["desc1","desc2","desc3","desc4","desc5"],
      "primary_text": "primary text under 125",
      "body_copy": "body copy",
      "cta": "${cta}",
      "image_direction": "visual brief"
    },
    {
      "variant": "Variant C",
      "angle": "third angle",
      "headlines": ["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],
      "descriptions": ["desc1","desc2","desc3","desc4","desc5"],
      "primary_text": "primary text under 125",
      "body_copy": "body copy",
      "cta": "${cta}",
      "image_direction": "visual brief"
    }
  ],
  "ab_test_recommendation": "which variant to test first and why",
  "creative_notes": "notes for design team"
}`
        })
        const creative = safeJSON(text)
        if (!creative) return Response.json({ success: false, error: 'Could not parse creative' }, { status: 500 })
        return Response.json({ success: true, creative })
      }

      case 'tracking': {
        const { clientName, industry, platform, website } = payload
        const text = await callClaude({
          systemPrompt: `You are a digital marketing tracking specialist. Provide clear step-by-step guides for GTM, GA4, Meta Pixel, and CAPI. Write for a non-technical marketing manager. Always respond with valid JSON only, no markdown, no backticks.`,
          userPrompt: `Create a complete tracking setup guide for ${clientName} (${industry}).
Platform focus: ${platform} | Website: ${website || 'not provided'} | Market: UAE

Respond with ONLY this JSON:
{
  "tracking_setup": [
    {
      "platform": "Google Tag Manager",
      "priority": "First",
      "steps": [
        {"step": 1, "action": "Create GTM account", "detail": "Go to tagmanager.google.com, sign in with your Google account, click Create Account, enter your company name and website URL"},
        {"step": 2, "action": "Install GTM snippet", "detail": "Copy the GTM container snippet from Admin > Install Google Tag Manager and paste the first part in your website head, second part after opening body tag"}
      ]
    },
    {
      "platform": "GA4 Setup",
      "priority": "Second",
      "steps": [
        {"step": 1, "action": "Create GA4 property", "detail": "Go to analytics.google.com, click Admin, then Create Property, select GA4, enter your website details"}
      ]
    },
    {
      "platform": "Meta Pixel and CAPI",
      "priority": "Third",
      "steps": [
        {"step": 1, "action": "Create Meta Pixel", "detail": "Go to Meta Business Manager, click Events Manager, click Connect Data Sources, select Web, then Meta Pixel"}
      ]
    },
    {
      "platform": "Google Ads Conversion Tracking",
      "priority": "Fourth",
      "steps": [
        {"step": 1, "action": "Create conversion action", "detail": "In Google Ads, click Tools and Settings, then Conversions, click the blue plus button, select Website"},
        {"step": 2, "action": "Set conversion value", "detail": "Select Use different values for each conversion, set the default value to your average order value in AED. This is critical for ROAS tracking."}
      ]
    }
  ],
  "key_events_to_track": ["purchase", "lead", "page_view", "add_to_cart", "begin_checkout", "contact_form_submit", "phone_call_click"],
  "gtm_tags_needed": ["GA4 Configuration Tag", "Meta Pixel Base Code", "Google Ads Conversion Tracking", "GA4 Event Tags", "Purchase Event with Revenue Value"],
  "verification_checklist": ["GTM Preview mode shows all tags firing on key pages", "GA4 DebugView shows events in real time", "Meta Pixel Helper Chrome extension shows pixel active", "Google Tag Assistant confirms Google Ads tag is working", "Test purchase shows conversion value in Google Ads within 3 hours", "ROAS is no longer showing 0.00x in Google Ads dashboard"]
}`
        })
        const tracking = safeJSON(text)
        if (!tracking) return Response.json({ success: false, error: 'Could not parse tracking' }, { status: 500 })
        return Response.json({ success: true, tracking })
      }

      case 'insight': {
        const { clientName, industry, auditCount, latestMetrics, strategyCount, competitorNames } = payload
        const text = await callClaude({
          systemPrompt: `You are a senior performance marketing analyst. Write sharp, executive-level insights in plain paragraphs. No markdown, no headers, no bullet points, no asterisks. Just clean professional text.`,
          userPrompt: `Write a concise performance summary for ${clientName} (${industry}).
Audits run: ${auditCount} | Latest metrics: ${JSON.stringify(latestMetrics?.slice(0,3))} | Strategies: ${strategyCount} | Competitors tracked: ${competitorNames}

Write 3 short paragraphs in plain text:
1. Current account health based on latest data.
2. Strategic progress and what has been put in place.
3. Top 2 things to focus on this week.

Be direct. Write like a trusted advisor giving a weekly briefing. No formatting, no headers.`
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
