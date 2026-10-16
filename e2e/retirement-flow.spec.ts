import { expect, test } from '@playwright/test'

async function openGuestCheck(page: import('@playwright/test').Page) {
  await page.goto('/')
  const consent = page.getByRole('dialog', { name: '協助我們改善退休工具' })
  if (await consent.isVisible()) await consent.getByRole('button', { name: '不要追蹤' }).click()
  if ((page.viewportSize()?.width ?? 999) <= 760) {
    await page.locator('button:visible').filter({ hasText: '開始檢查我的退休現金流' }).first().click()
  } else {
    await page.getByRole('button', { name: '開始檢查我的退休現金流', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: '先填每月生活費' })).toBeVisible()
}

async function openGuestPage(page: import('@playwright/test').Page, name: RegExp) {
  if ((page.viewportSize()?.width ?? 999) <= 760) {
    await page.getByRole('button', { name: /全部/ }).last().click()
    await page.getByRole('region', { name: '全部功能' }).getByRole('button', { name }).click()
  } else {
    await page.locator('aside').getByRole('button', { name }).click()
  }
}

test('首次退休檢查保持九個欄位空白，並統一千分位與清空行為', async ({ page }) => {
  await openGuestCheck(page)
  const fields = page.locator('.jh-entry-form .jh-numeric-field input')
  await expect(fields).toHaveCount(9)
  for (let index = 0; index < 9; index += 1) await expect(fields.nth(index)).toHaveValue('')

  const expense = page.getByLabel('每月生活費（元）', { exact: true })
  await expense.fill('6000')
  await expense.blur()
  await expect(expense).toHaveValue('6,000')
  await expense.focus()
  await expect(expense).toHaveValue('6000')
  await expense.fill('')
  await expect(expense).toHaveValue('')

  const age = page.getByLabel('目前年齡', { exact: true })
  await age.fill('17')
  await age.blur()
  await expect(page.getByRole('alert')).toContainText('目前年齡不得小於 18')
})

test('重按投資導覽保留目前子頁，不會清除尚未完成內容', async ({ page }) => {
  await openGuestCheck(page)
  await openGuestPage(page, /投資對退休的影響|退休投資決策中心/)
  await page.getByRole('button', { name: '開始 3 分鐘決策試算 →' }).click()
  await expect(page.getByRole('button', { name: '← 返回五個情境' })).toBeVisible()
  await openGuestPage(page, /投資對退休的影響|退休投資決策中心/)
  await expect(page.getByRole('button', { name: '← 返回五個情境' })).toBeVisible()
})

test('資產輸入一次只顯示所選模式，類別會帶入中文名稱', async ({ page }) => {
  await openGuestCheck(page)
  await openGuestPage(page, /持有資產清單/)
  await expect(page.getByRole('heading', { name: '請先選擇輸入方式' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '自行輸入股票與 ETF' })).toBeHidden()

  await page.getByRole('button', { name: /自行輸入/ }).click()
  await expect(page.getByRole('heading', { name: '自行輸入股票與 ETF' })).toBeVisible()
  await page.getByLabel('資產類別').selectOption('fund')
  await expect(page.getByLabel('資產名稱')).toHaveValue('基金')

  await page.getByRole('button', { name: /檔案匯入/ }).click()
  await expect(page.getByRole('heading', { name: 'Excel／CSV 檔案匯入' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '自行輸入股票與 ETF' })).toBeHidden()
})

test('手機版可由底部導覽開啟全部功能並返回退休檢查', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), '手機專案專用')
  await openGuestCheck(page)
  await page.getByRole('button', { name: /全部/ }).last().click()
  await expect(page.getByRole('region', { name: '全部功能' })).toBeVisible()
  await page.getByRole('button', { name: /我的退休今天安全嗎/ }).last().click()
  await expect(page.getByText('我的每月退休現金流夠不夠？')).toBeVisible()
})

