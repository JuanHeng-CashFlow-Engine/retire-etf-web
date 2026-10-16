export type AssetEntryMode = 'manual' | 'file' | 'image'

const choices: Array<{ id: AssetEntryMode; icon: string; title: string; description: string }> = [
  { id: 'manual', icon: '✎', title: '自行輸入', description: '新增股票、ETF、現金、基金、債券、保單或其他資產。' },
  { id: 'file', icon: '▤', title: '檔案匯入', description: '使用 Excel 或 CSV，一次整理多筆持有資產。' },
  { id: 'image', icon: '▧', title: '圖片匯入', description: '從持股截圖辨識資料，再逐筆核對後加入。' },
]

export function AssetEntryModeSelector({ value, onChange }: { value: AssetEntryMode | null; onChange: (mode: AssetEntryMode) => void }) {
  return <section className="jh-entry-mode" aria-labelledby="asset-entry-mode-title">
    <div><p className="eyebrow">新增資產</p><h2 id="asset-entry-mode-title">請先選擇輸入方式</h2><p>一次只顯示一種操作畫面；需要改用其他方式時，可隨時切換。</p></div>
    <div className="jh-entry-mode-grid">{choices.map((choice) => <button type="button" key={choice.id} className={value === choice.id ? 'active' : ''} aria-pressed={value === choice.id} onClick={() => onChange(choice.id)}><span>{choice.icon}</span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}</div>
  </section>
}
