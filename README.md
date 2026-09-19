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

## 畫面與功能

- 首頁、五步退休健檢／功能導覽頁，以及免費版與 Pro 版入口。
- 登入後以既有 Supabase Auth 和 `getClaims()` 確認身分；免費、試用、Pro 狀態依 `subscriptions` 判斷。入口選擇不會改變訂閱。尚未提供付款結帳流程。
- 資產輸入沿用「我的錢放得安全嗎？」的投資組合與市場報價；其他資產可新增、編輯或停用，保存在會員自己的 `user_assets`。
- 固定收入可記錄勞保、勞退、年金及租金的每月金額與起迄月份，供現金流和退休模擬使用。
- 配息頁可記錄預估、公告及實際入帳；缺口頁整合逐月配息、固定收入和生活費，並顯示已保存的警訊。
- 市場大跌頁可分別調整價格與配息跌幅，顯示曝險資產、現金流、現金安全墊與集中部位。
- 成功率頁使用 3,000 次模擬，並從 V3 快照、舊版 `retirement_monthly_reports` 和 `retirement_gps` 讀取真正的歷史紀錄；試用及 Pro 會員可比較增加投入或降低支出情境。
- 月報寫入 `retirement_snapshots_v3` 的不可覆寫快照；先執行 `database/20260919_retirement_snapshots_v3.sql`。缺少現金、價格或收入證據時仍可保存，但會標記缺漏且不宣稱安全。
- 月報頁可檢視目前摘要與歷史月報。試用及 Pro 會員可保存本月快照；資料完整時才依 V3 的模擬、現金流、現金安全墊、分散度與目標進度規則計分。

## 資料庫遷移

原版資料庫還沒有獨立的固定收入表。管理員須按順序執行 `database/20260918_fixed_incomes.sql` 與 `database/20260918_report_entitlement.sql`。前者建立會員專屬固定收入及 RLS，後者讓月報的資料庫寫入權限依有效訂閱或試用判斷。未執行固定收入遷移時，畫面會提示且停用新增；未執行月報權限遷移前，前端仍會限制按鈕，但舊資料庫政策可能允許直接寫入。

站內提醒使用既有 `user_alerts`、`cashflow_alerts`。Email／推播排程仍需受控後端；本版只顯示已保存的站內警訊。市場主檔價格、殖利率及日期以資料庫內容為準，不由會員端更新。

首頁及功能導覽可在未設定 Supabase 時預覽。登入及會員資料頁需要 `.env.local` 中的公開連線資訊與具備相應 RLS 權限的帳號。

