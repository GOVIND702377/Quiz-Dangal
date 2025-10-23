#!/usr/bin/env node
import https from 'node:https'

const TARGETS = [
  'https://quizdangal.com/',
  'https://quizdangal.com/leaderboards',
  'https://quizdangal.com/category/opinion',
  'https://quizdangal.com/category/gk',
  'https://quizdangal.com/category/sports',
  'https://quizdangal.com/category/movies',
  'https://quizdangal.com/robots.txt',
  'https://quizdangal.com/sitemap.xml'
]

const UAS = [
  { name: 'Default', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  { name: 'Googlebot', value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
]

function fetchOnce(url, ua) {
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'GET',
      headers: { 'User-Agent': ua.value, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { if (data.length < 200000) data += c })
      res.on('end', () => {
        const headers = Object.fromEntries(Object.entries(res.headers).map(([k,v]) => [k.toLowerCase(), v]))
        resolve({ status: res.statusCode, headers, body: data })
      })
    })
    req.on('error', (e) => resolve({ status: 0, headers: {}, error: e.message }))
    req.end()
  })
}

function sanitizeRedirect(currentUrl, locationHeader) {
  if (!locationHeader || typeof locationHeader !== 'string') return null
  try {
    const resolved = new URL(locationHeader, currentUrl)
    const protocol = resolved.protocol.toLowerCase()
    if (protocol !== 'https:' && protocol !== 'http:') {
      return { error: `Blocked redirect with unsupported protocol: ${protocol}` }
    }
    const originHost = new URL(currentUrl).host
    const resolvedHost = resolved.host
    if (resolvedHost !== originHost) {
      return { error: `Blocked cross-origin redirect to ${resolvedHost}` }
    }
    return { url: resolved.toString() }
  } catch (err) {
    return { error: `Invalid redirect target: ${err.message}` }
  }
}

async function fetchFollow(url, ua, maxRedirects = 5) {
  const chain = []
  let current = url
  for (let i = 0; i <= maxRedirects; i++) {
    const resp = await fetchOnce(current, ua)
    const locationHeader = resp.headers?.location || null
    let sanitized = null
    if (locationHeader) {
      sanitized = sanitizeRedirect(current, locationHeader)
    }
    chain.push({
      url: current,
      status: resp.status,
      location: sanitized?.url || null,
      blocked: sanitized?.error || null,
    })
    if (resp.status >= 300 && resp.status < 400 && locationHeader) {
      if (sanitized?.error) {
        return { final: current, response: { status: 0, headers: {}, body: '', error: sanitized.error }, chain }
      }
      if (!sanitized?.url) {
        return { final: current, response: { status: 0, headers: {}, body: '', error: 'redirect target rejected' }, chain }
      }
      current = sanitized.url
      continue
    }
    return { final: current, response: resp, chain }
  }
  return { final: current, response: { status: 0, headers: {}, body: '', error: 'Too many redirects' }, chain }
}

function parseMetaRobots(html) {
  const m = html.match(/<meta\s+name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i)
  return m ? m[1].toLowerCase() : null
}

function parseCanonical(html) {
  const m = html.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)
  return m ? m[1] : null
}

function verdict(url, resp, uaName) {
  const issues = []
  if (!resp || resp.status === 0) {
    issues.push(`❌ ${uaName}: request failed (${resp?.error||'unknown'})`)
    return issues
  }
  if (resp.status >= 400) issues.push(`❌ ${uaName}: HTTP ${resp.status}`)
  const xrt = String(resp.headers['x-robots-tag'] || '').toLowerCase()
  if (xrt.includes('noindex')) issues.push(`❌ ${uaName}: X-Robots-Tag contains noindex -> ${xrt}`)
  if (url.endsWith('.txt') || url.endsWith('.xml')) return issues
  const meta = parseMetaRobots(resp.body || '')
  if (meta && meta.includes('noindex')) issues.push(`❌ ${uaName}: <meta name="robots" content="${meta}">`)
  const canon = parseCanonical(resp.body || '')
  if (canon && !canon.startsWith('https://quizdangal.com')) issues.push(`⚠️ ${uaName}: canonical points off-domain -> ${canon}`)
  return issues
}

async function main() {
  console.log('🔎 Verifying live SEO (headers + meta)...\n')
  let hasIssues = false
  for (const url of TARGETS) {
    console.log(`URL: ${url}`)
    for (const ua of UAS) {
      const { final, response, chain } = await fetchFollow(url, ua)
      const issues = verdict(final, response, ua.name)
      const chainStr = chain.map(c => {
        const arrow = c.location ? `→${c.location}` : ''
        const blocked = c.blocked ? ` (blocked: ${c.blocked})` : ''
        return `${c.status}${arrow}${blocked}`
      }).join('  ')
      if (issues.length === 0) {
        console.log(`  ✅ ${ua.name}: chain[ ${chainStr} ] | final=${final} | X-Robots-Tag=${response.headers['x-robots-tag']||'-'} | meta-robots=${parseMetaRobots(response.body)||'-'}`)
      } else {
        hasIssues = true
        console.log(`  ↪️  ${ua.name}: chain[ ${chainStr} ] | final=${final}`)
        issues.forEach((i) => console.log('  ' + i))
      }
    }
    console.log('')
  }
  if (hasIssues) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Some URLs show SEO blockers. See above for details.')
    process.exitCode = 1
  } else {
    console.log('✅ No live SEO blockers detected.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
