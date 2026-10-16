const base = (process.env.DEPLOYED_URL || 'https://juanheng-cashflow-engine.github.io/retire-etf-web/').replace(/\/?$/, '/')
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function verify() {
  const htmlResponse = await fetch(`${base}?smoke=${Date.now()}`, { redirect: 'follow' })
  if (!htmlResponse.ok) throw new Error(`首頁回應 ${htmlResponse.status}`)
  const html = await htmlResponse.text()
  if (!html.includes('<div id="root"></div>')) throw new Error('首頁缺少 React root')
  const scriptMatch = html.match(/<script[^>]+src="([^"]+\.js)"/)
  if (!scriptMatch) throw new Error('首頁缺少正式 JavaScript 資產')
  const assetUrl = new URL(scriptMatch[1], base)
  const assetResponse = await fetch(assetUrl)
  if (!assetResponse.ok) throw new Error(`JavaScript 資產回應 ${assetResponse.status}`)
  const script = await assetResponse.text()
  for (const marker of ['退休投資決策中心', 'ETF 現金流規劃器', '持有資產清單']) {
    if (!script.includes(marker)) throw new Error(`正式資產缺少功能標記：${marker}`)
  }
  return assetUrl.href
}

let lastError
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    const asset = await verify()
    console.log(JSON.stringify({ ok: true, base, asset, attempt, checkedAt: new Date().toISOString() }))
    process.exit(0)
  } catch (error) {
    lastError = error
    if (attempt < 5) await delay(5_000)
  }
}
throw lastError
