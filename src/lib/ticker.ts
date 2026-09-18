const TAIWAN_SUFFIX = /\.(TW|TWO)$/i

export function cleanTicker(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

export function tickerCode(value: unknown): string {
  return cleanTicker(value).replace(TAIWAN_SUFFIX, '')
}

export function tickerCandidates(value: unknown): string[] {
  const raw = cleanTicker(value)
  if (!raw) return []

  const code = tickerCode(raw)
  // Taiwan listings can end in a market-class letter, for example active
  // ETFs 00981A/00982A and bond ETF 00751B.
  if (!/^\d{4,6}[A-Z]?$/.test(code)) return [raw]

  const candidates = raw === code
    ? [`${code}.TW`, `${code}.TWO`, code]
    : [raw, code, `${code}.TW`, `${code}.TWO`]

  return [...new Set(candidates)]
}

export function sameTicker(left: unknown, right: unknown): boolean {
  const leftCode = tickerCode(left)
  const rightCode = tickerCode(right)
  return Boolean(leftCode && rightCode && leftCode === rightCode)
}

