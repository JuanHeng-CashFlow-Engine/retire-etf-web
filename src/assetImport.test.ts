import { describe, expect, it } from 'vitest'
import { parseCsv, rowsFromCells, validateImportRow } from './assetImport'

describe('reviewed asset imports', () => {
  it('retains quoted CSV cells and converts Taiwan shares to lots without changing their value', () => {
    const cells = parseCsv('資產類型,代號,名稱,股數,目前價格,目前市值TWD,幣別,資料日期\r\nETF,0050,"元大,台灣50",2000,100,"200,000",TWD,2026-09-18')
    const [row] = rowsFromCells(cells)
    const review = validateImportRow(row)
    expect(row.name).toBe('元大,台灣50')
    expect(row.quantityUnit).toBe('股')
    expect(review.lots).toBe(2)
    expect(review.value).toBe(200_000)
    expect(review.errors).toEqual([])
  })

  it('requires explicit currency and a real valuation date before saving', () => {
    const [row] = rowsFromCells([['資產類型', '名稱', '目前市值'], ['基金', '退休基金', 100000]])
    const review = validateImportRow({ ...row, dataDate: '2026-02-31' })
    expect(review.errors).toContain('幣別須明確填 TWD')
    expect(review.errors).toContain('資料日期須為有效的 YYYY-MM-DD，且不可晚於今天')
  })
})
