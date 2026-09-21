export type ImportAssetRow = {
  assetType: string
  ticker: string
  name: string
  quantity: string
  quantityUnit: string
  unitPrice: string
  marketValue: string
  annualYield: string
  currency: string
  account: string
  dataDate: string
  notes: string
}

export const blankImportRow = (): ImportAssetRow => ({ assetType: '', ticker: '', name: '', quantity: '', quantityUnit: '', unitPrice: '', marketValue: '', annualYield: '', currency: '', account: '', dataDate: '', notes: '' })
export const importColumns: { key: keyof ImportAssetRow; label: string; aliases: string[] }[] = [
  { key: 'assetType', label: '資產類型', aliases: ['資產類型', '資產類別', '類型', 'asset_type', 'type'] },
  { key: 'ticker', label: '代號', aliases: ['代號', '股票代號', '證券代號', '標的代號', 'ticker', 'symbol', 'code'] },
  { key: 'name', label: '名稱', aliases: ['名稱', '標的', '標的名稱', '基金名稱', '證券名稱', 'name'] },
  { key: 'quantity', label: '持有數量', aliases: ['持有數量', '數量', '張數', '股數', '持有張數', 'quantity', 'shares'] },
  { key: 'quantityUnit', label: '數量單位', aliases: ['數量單位', '單位', 'unit', 'quantity_unit'] },
  { key: 'unitPrice', label: '目前價格', aliases: ['目前價格', '價格', '股價', '單價', 'price', 'unit_price'] },
  { key: 'marketValue', label: '目前市值TWD', aliases: ['目前市值TWD', '目前市值', '市值', '現值', '金額', 'market_value', 'value'] },
  { key: 'annualYield', label: '殖利率%', aliases: ['殖利率%', '殖利率', '年化配息率', '年收益率', 'annual_yield', 'yield'] },
  { key: 'currency', label: '幣別', aliases: ['幣別', '貨幣', 'currency'] },
  { key: 'account', label: '帳戶代稱', aliases: ['帳戶代稱', '帳戶', '券商', '銀行', 'account'] },
  { key: 'dataDate', label: '資料日期', aliases: ['資料日期', '估值日期', 'data_date', 'as_of'] },
  { key: 'notes', label: '備註', aliases: ['備註', 'notes'] },
]

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[\s_％%()（）]/g, '')
const numeric = (value: string) => {
  const cleaned = value.trim().replace(/[NT$元，,\s]/gi, '').replace(/%$/, '')
  if (!cleaned || cleaned.startsWith('=')) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}
export const importNumber = numeric
export const isMarketRow = (row: ImportAssetRow) => ['stock', 'etf'].includes(row.assetType)

export function rowsFromCells(cells: unknown[][]): ImportAssetRow[] {
  const headerIndex = cells.findIndex((row) => row.filter((value) => importColumns.some((column) => column.aliases.map(normalizeHeader).includes(normalizeHeader(String(value ?? ''))))).length >= 2)
  if (headerIndex < 0) throw new Error('找不到資產表格欄位；請下載範本並確認標題列。')
  const headers = cells[headerIndex].map((value) => normalizeHeader(String(value ?? '')))
  const locations = Object.fromEntries(importColumns.map((column) => [column.key, headers.findIndex((header) => column.aliases.some((alias) => normalizeHeader(alias) === header))])) as Record<keyof ImportAssetRow, number>
  const quantityHeader = headers[locations.quantity]
  const rows = cells.slice(headerIndex + 1).filter((row) => row.some((value) => String(value ?? '').trim()))
  if (!rows.length) throw new Error('檔案沒有資產資料。')
  if (rows.length > 200) throw new Error('一次最多匯入 200 筆，請分批處理。')
  return rows.map((cells) => {
    const row = blankImportRow()
    for (const column of importColumns) if (locations[column.key] >= 0) row[column.key] = String(cells[locations[column.key]] ?? '').trim()
    if (!row.quantityUnit && quantityHeader) {
      if (quantityHeader.includes('張')) row.quantityUnit = '張'
      if (quantityHeader.includes('股')) row.quantityUnit = '股'
    }
    return row
  })
}

export function parseCsv(text: string): unknown[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index++ } else quoted = !quoted }
    else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (quoted) throw new Error('CSV 引號格式不完整。')
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

export async function readImportFile(file: File): Promise<ImportAssetRow[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('檔案不可超過 5 MB。')
  if (/\.csv$/i.test(file.name)) {
    const bytes = await file.arrayBuffer()
    let text: string
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { text = new TextDecoder('big5', { fatal: true }).decode(bytes) }
    return rowsFromCells(parseCsv(text.replace(/^\uFEFF/, '')))
  }
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser')
    return rowsFromCells(await readSheet(file))
  }
  throw new Error('僅支援 CSV 與 XLSX 檔案。')
}

function normalizedType(input: string) {
  const value = input.trim().toLowerCase().replace(/\s/g, '')
  if (['股票', 'stock', 'equity', '股票/etf', '股票etf'].includes(value)) return 'stock'
  if (['etf', '指數股票型基金'].includes(value)) return 'etf'
  if (['基金', '共同基金', 'fund'].includes(value)) return 'fund'
  if (['現金', 'cash', '定存'].includes(value)) return 'cash'
  if (['債券', 'bond'].includes(value)) return 'bond'
  if (['保單', '保險', '年金', 'insurance'].includes(value)) return 'insurance'
  if (['其他', 'other'].includes(value)) return 'other'
  return ''
}

export function validateImportRow(raw: ImportAssetRow): { row: ImportAssetRow; errors: string[]; value: number | null; lots: number | null } {
  const row = { ...raw, assetType: normalizedType(raw.assetType), ticker: raw.ticker.trim().toUpperCase().replace(/\.(TW|TWO)$/, ''), currency: raw.currency.trim().toUpperCase(), name: raw.name.trim() }
  const errors: string[] = []
  const quantity = numeric(row.quantity), price = numeric(row.unitPrice), inputValue = numeric(row.marketValue), annualYield = numeric(row.annualYield)
  const unit = row.quantityUnit.trim().toLowerCase()
  const lots = isMarketRow(row) && quantity != null ? (['股', 'shares'].includes(unit) ? quantity / 1000 : quantity) : null
  const value = inputValue ?? (isMarketRow(row) && quantity != null && price != null ? quantity * price * (['張', 'lots'].includes(unit) ? 1000 : 1) : null)
  if (!row.assetType) errors.push('選擇資產類型')
  if (!row.name && !row.ticker) errors.push('填寫名稱或代號')
  if (isMarketRow(row) && !/^[0-9A-Z]{4,6}$/.test(row.ticker)) errors.push('核對台灣證券代號')
  if (isMarketRow(row) && (quantity == null || quantity <= 0)) errors.push('填寫持有數量')
  if (isMarketRow(row) && !['股', '張', 'shares', 'lots'].includes(unit)) errors.push('選擇股或張')
  if (value == null || value <= 0) errors.push('填寫新台幣市值或可計算的價格與數量')
  if (quantity != null && quantity <= 0) errors.push('持有數量須大於 0')
  if (!isMarketRow(row) && quantity != null && !unit) errors.push('選擇持有數量單位')
  if (price != null && price <= 0) errors.push('價格須大於 0')
  if (annualYield != null && (annualYield < 0 || annualYield > 30)) errors.push('殖利率須介於 0–30%')
  if (row.currency !== 'TWD') errors.push('幣別須明確填 TWD')
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(row.dataDate) ? new Date(`${row.dataDate}T00:00:00Z`) : null
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== row.dataDate || parsedDate > new Date()) errors.push('資料日期須為有效的 YYYY-MM-DD，且不可晚於今天')
  if (row.name.length > 120 || row.ticker.length > 40 || row.account.length > 80 || row.notes.length > 500) errors.push('文字欄位過長')
  return { row, errors, value, lots }
}

export function parseImageText(text: string): ImportAssetRow[] {
  const rows: ImportAssetRow[] = []
  for (const line of text.split(/\r?\n/)) {
    const ticker = line.match(/(?:^|\s)([0-9]{4,6}[A-Z]?)(?:\s|$)/i)?.[1]
    if (!ticker) continue
    const row = blankImportRow()
    row.assetType = 'etf'
    row.ticker = ticker
    row.name = line.split(ticker)[0].trim()
    const tail = line.split(ticker).slice(1).join(ticker)
    const amounts = [...tail.matchAll(/(?:NT\$|\$)?\s*([\d,]+(?:\.\d+)?)\s*(張|股|%|元)?/g)]
    const count = amounts.find((match) => ['張', '股'].includes(match[2] ?? ''))
    if (count) { row.quantity = count[1]; row.quantityUnit = count[2] }
    const percent = amounts.find((match) => match[2] === '%')
    if (percent) row.annualYield = percent[1]
    const money = amounts.filter((match) => /(?:NT\$|\$)/i.test(match[0])).map((match) => numeric(match[1])).filter((value): value is number => value != null)
    if (money.length) row.marketValue = String(Math.max(...money))
    rows.push(row)
  }
  return rows.slice(0, 200)
}

export function importCsvTemplate(today = new Date().toISOString().slice(0, 10)) {
  const headers = importColumns.map((column) => column.label)
  const sample = ['ETF', '0050', '元大台灣50', '1', '張', '100', '100000', '3', 'TWD', '證券帳戶A', today, '範例，匯入前請修改']
  return '\uFEFF' + [headers, sample].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n')
}
