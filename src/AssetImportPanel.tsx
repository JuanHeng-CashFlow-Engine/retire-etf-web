import { useEffect, useMemo, useState } from 'react'
import { blankImportRow, importColumns, importCsvTemplate, parseImageText, readImportFile, validateImportRow, type ImportAssetRow } from './assetImport'
import { money } from './lib/format'

export function AssetImportPanel({ onCommit, existingKeys, guest }: { onCommit: (row: ImportAssetRow) => Promise<void>; existingKeys: string[]; guest: boolean }) {
  const [mode, setMode] = useState<'file' | 'image'>('file')
  const [rows, setRows] = useState<ImportAssetRow[]>([])
  const [saved, setSaved] = useState<number[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const reviews = useMemo(() => rows.map(validateImportRow), [rows])
  const duplicateKeys = reviews.map(({ row }) => row.assetType === 'stock' || row.assetType === 'etf'
    ? `market:${row.ticker}`
    : `asset:${row.assetType}:${(row.name || row.ticker).toLowerCase()}:${row.account.trim().toLowerCase()}`)
  const errors = reviews.map((review, index) => {
    const result = [...review.errors]
    if (!saved.includes(index) && existingKeys.includes(duplicateKeys[index])) result.push('這筆資產已存在，請先編輯原紀錄')
    if (duplicateKeys.indexOf(duplicateKeys[index]) !== index || duplicateKeys.lastIndexOf(duplicateKeys[index]) !== index) result.push('檔案內有重複資產')
    return result
  })
  const hasErrors = errors.some((item, index) => !saved.includes(index) && item.length > 0)

  function stage(next: ImportAssetRow[], note: string) {
    setRows(next.map((row) => validateImportRow(row).row)); setSaved([]); setMessage(note)
  }
  async function loadFile(file: File | undefined) {
    if (!file) return
    setBusy(true); setMessage('')
    try { stage(await readImportFile(file), `已讀取 ${file.name}，請先核對每筆資料；尚未儲存。`) }
    catch (error) { setMessage(error instanceof Error ? error.message : '檔案無法讀取。') }
    finally { setBusy(false) }
  }
  function chooseImage(file: File | undefined) {
    setRows([]); setSaved([]); setOcrText(''); setMessage('')
    if (!file) { setImageFile(null); setPreview(''); return }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setMessage('圖片須為 PNG、JPEG 或 WEBP，且不可超過 5 MB。'); return }
    setImageFile(file); setPreview(URL.createObjectURL(file))
  }
  async function recognizeImage() {
    if (!imageFile) return
    setBusy(true); setMessage('正在本機辨識圖片；首次使用需下載中文辨識資料。')
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker(['eng', 'chi_tra'])
      try {
        const result = await worker.recognize(imageFile)
        setOcrText(result.data.text)
        const extracted = parseImageText(result.data.text)
        stage(extracted.length ? extracted : [blankImportRow()], '已產生待核對草稿。圖片辨識可能漏字，請逐欄檢查並補上幣別與資料日期；尚未儲存。')
      } finally { await worker.terminate() }
    } catch (error) { setMessage(`圖片辨識未完成：${error instanceof Error ? error.message : '請依照預覽手動填寫草稿。'}`); setRows([blankImportRow()]) }
    finally { setBusy(false) }
  }
  function update(index: number, key: keyof ImportAssetRow, value: string) {
    setRows((previous) => previous.map((row, item) => item === index ? { ...row, [key]: value } : row))
    setSaved((previous) => previous.filter((item) => item !== index))
  }
  async function confirm(index: number) {
    if (hasErrors || saved.includes(index)) return
    setBusy(true); setMessage('')
    try { await onCommit(reviews[index].row); setSaved((previous) => [...previous, index]); setMessage(`第 ${index + 1} 筆已${guest ? '加入本次免費試算' : '存入帳戶'}。`) }
    catch (error) { setMessage(error instanceof Error ? error.message : '新增資產失敗，請核對後再試。') }
    finally { setBusy(false) }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([importCsvTemplate()], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = '涓恆退休資產匯入範本.csv'; link.click(); URL.revokeObjectURL(url)
  }

  return <section className="jh-asset-import"><h2>匯入資產</h2><p className="chart-note">上傳只建立待核對草稿，不會自動加入資產。股票與 ETF 請明確填股或張；市值以新台幣填寫。{guest ? '免費版採用核對後的匯入市值。' : 'Pro 版正式持股市值會依市場資料重新計算，可能與檔案快照不同。'}</p>
    <div className="jh-import-tabs"><button className={mode === 'file' ? 'active' : ''} onClick={() => { setMode('file'); setRows([]); setSaved([]) }}>Excel／CSV 檔案</button><button className={mode === 'image' ? 'active' : ''} onClick={() => { setMode('image'); setRows([]); setSaved([]) }}>持股圖片</button></div>
    {mode === 'file' ? <div className="jh-import-upload"><label>選擇 Excel／CSV 檔案<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void loadFile(event.target.files?.[0])} /></label><button className="ghost-button" type="button" onClick={download}>下載 CSV 範本</button><span>CSV 支援 UTF-8／Big5；XLSX 讀取第一個工作表。最多 5 MB、200 筆。</span></div>
      : <div className="jh-import-upload"><label>選擇持股圖片<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseImage(event.target.files?.[0])} /></label><p>請先遮蔽姓名、帳號等個資。圖片在瀏覽器內辨識，不會送往會員資料庫；辨識結果須逐筆核對。</p>{preview && <img className="jh-import-preview" src={preview} alt="待辨識的資產圖片預覽" />}{imageFile && <button type="button" className="primary-button" disabled={busy} onClick={() => void recognizeImage()}>辨識圖片中的資產</button>}{ocrText && <details><summary>查看或修正辨識文字</summary><textarea rows={6} value={ocrText} onChange={(event) => setOcrText(event.target.value)} /><button type="button" className="ghost-button" onClick={() => stage(parseImageText(ocrText).length ? parseImageText(ocrText) : [blankImportRow()], '已重新產生草稿，請核對。')}>依文字重新產生草稿</button></details>}</div>}
    {message && <p className="form-message" role="status">{message}</p>}
    {rows.length > 0 && <div className="jh-import-review"><h3>先核對資料，再逐筆新增</h3><div className="jh-operational-summary"><div><span>待核對筆數</span><strong>{rows.length}</strong></div><div><span>待修正筆數</span><strong>{errors.filter((item) => item.length).length}</strong></div><div><span>已新增筆數</span><strong>{saved.length}</strong></div><div><span>草稿市值合計</span><strong>{money.format(reviews.reduce((sum, item) => sum + (item.value ?? 0), 0))}</strong></div></div>{hasErrors && <p className="error-banner">請修正所有待核對欄位後，才能新增任何一筆。</p>}
      {rows.map((row, index) => <details key={index} className="jh-import-row" open={rows.length === 1 || errors[index].length > 0}><summary><strong>{index + 1}. {row.name || row.ticker || '未命名資產'}</strong><span>{row.assetType || '類型待填'} · {reviews[index].value == null ? '市值待核對' : money.format(reviews[index].value)}</span><b className={errors[index].length ? 'jh-red' : saved.includes(index) ? 'jh-green' : ''}>{errors[index].length ? errors[index].join('；') : saved.includes(index) ? '已新增' : '待確認'}</b></summary><div className="jh-import-fields">{importColumns.map((column) => <label key={column.key}>{column.label}{column.key === 'assetType' ? <select value={row.assetType} onChange={(event) => update(index, column.key, event.target.value)}><option value="">請選擇</option><option value="stock">股票</option><option value="etf">ETF</option><option value="fund">基金</option><option value="cash">現金</option><option value="bond">債券</option><option value="insurance">保險</option><option value="other">其他</option></select> : column.key === 'quantityUnit' ? <select value={row.quantityUnit} onChange={(event) => update(index, column.key, event.target.value)}><option value="">請選擇</option><option value="張">張</option><option value="股">股</option><option value="受益權單位">受益權單位</option></select> : <input value={row[column.key]} onChange={(event) => update(index, column.key, event.target.value)} placeholder={column.key === 'currency' ? 'TWD' : column.key === 'dataDate' ? 'YYYY-MM-DD' : ''} />}</label>)}</div><button className="primary-button" type="button" disabled={busy || hasErrors || saved.includes(index)} onClick={() => void confirm(index)}>確認新增這一筆</button></details>)}
    </div>}
  </section>
}
