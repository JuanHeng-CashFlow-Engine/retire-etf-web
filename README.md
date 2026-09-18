# 涓恆退休金流續航儀 React 前端

這是涓恆退休金流續航儀未來正式使用的 React 前端。它共用正式 Supabase，但瀏覽器只使用 publishable key，會員只能透過 JWT 與 RLS 存取自己的資料。

Streamlit 僅保留在私人舊版儲存庫作為遷移期間的功能與計算參考；完成各頁遷移後，新網站不再依賴 Streamlit 執行。

## 本機啟動

1. 使用 Node.js 22 以上版本。
2. 複製 `.env.example` 為 `.env.local`。
3. 填入 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`。
4. 執行 `pnpm install`、`pnpm dev`。

## 權限邊界

- `user_portfolios`、`user_assets`、`retirement_goals`：前端可依 RLS 讀寫會員本人資料。
- `etf_prices`、`stock_mapping`：前端唯讀。
- 管理員、排程、外部 API、AI/OCR：後續只經 Supabase Edge Function 或受控後端執行。
- `service_role` / secret key：永遠不得放入 Vite 環境變數、瀏覽器程式碼或 GitHub Pages。

新增股票時，只更新會員自己的 `user_portfolios`。即使市場主檔找不到標的，也不會讓一般會員修改 `etf_prices` 或 `stock_mapping`。

## 第一階段範圍

- Supabase Auth 登入／註冊與 `getClaims()` 身分確認。
- RLS 保護的退休首頁摘要。
- 安全的投資組合新增、更新與移除。
- 未來 12 個月配息、每月總額、紅黃綠燈與月份明細。
- 未完成遷移的功能會明確顯示為遷移中，並逐步由 React 頁面取代。

