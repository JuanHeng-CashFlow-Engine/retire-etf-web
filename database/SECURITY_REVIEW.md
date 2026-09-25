# Pro review — 2026-09-25

- Correlation now pairs returns with identical start/end trading dates, requires 30 common observations, and reports dates/sample counts. It uses raw closes (not dividend/split adjusted); timezone and corporate-action limits remain.
- Authenticated analysis v6 validates Auth user and server entitlement. Legacy endpoint v32 requires JWT and proxies to the same handler, with no service-role forwarding.
- Subscription writes and trial fields are server-owned. Existing Auth signup trigger still creates the seven-day trial. Ordinary profile updates remain permitted.
- Pro scenario/stress snapshot inserts are checked in PostgreSQL. Historical owner reads remain available. Anonymous/cross-account writes are denied.
- Fixed incomes all count; identical name/category/amount/date ranges produce warnings only. Old snapshots are not rewritten and should be recalculated.
- Runway is labelled static gap coverage, not a full retirement forecast.
- dividend_history and financial_ai_usage_daily are internal-only tables: RLS stays enabled and client privileges are revoked. No-policy INFO findings are intentional.
- RLS auth.uid expressions optimized; three foreign-key indexes added. Unused-index INFO findings are expected on new indexes.
- Entitlement RPC uses SECURITY INVOKER and owner RLS. No public/anonymous EXECUTE grant.
- Supabase leaked-password protection remains disabled: dashboard requires Supabase Pro or above; current organization is Free. No paid plan change made.
- 65 unit tests, TypeScript and production build passed. Transactional live database tests passed and rolled back all test data: eligibility, owner isolation, immutable snapshots, notification rules, deduplication and read updates.
- AI-labelled service currently uses a quantitative rule engine, not a generative model. UI discloses this. In-app alerts only; no email/LINE delivery.

Apply the workspace SQL before pro_security_hardening.sql on a new database. Deployed changes were applied using Supabase MCP migrations because no local Supabase CLI was installed.
