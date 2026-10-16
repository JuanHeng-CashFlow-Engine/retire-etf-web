# Supabase security review — 2026-10-16

## Scope

This review covers repository migrations, browser Supabase access, Edge Functions, subscription/member authorization, and production CI checks. It is a code-and-policy review; applying migrations and inspecting the live Supabase dashboard remain deployment operations.

## Findings and remediation

- **RLS:** Internal market sync tables already enable RLS and use restrictive client-deny policies. The new `client_error_logs` table enables RLS, permits insert-only access, binds authenticated inserts to `auth.uid()`, and exposes no client read/update/delete grants.
- **Browser credentials:** Browser source contains only the Supabase publishable key. The automated audit fails if a service-role reference is added under `src/`.
- **Edge Functions:** Account deletion, trial activation, checkout, billing portal, and billing status now reject unapproved browser origins. Privileged functions require a bearer token and resolve the user server-side; billing portal is restricted to `POST`.
- **Error leakage:** Privileged endpoints no longer return raw Supabase or Stripe error text to the browser. Server logs retain categorical diagnostics.
- **Membership:** Trial, checkout, portal, account deletion and existing Pro analysis paths identify the member from the verified access token rather than a user id supplied by the request body.
- **Regression gate:** `pnpm audit:security` checks wildcard CORS, service-role authentication patterns, service-role leakage to the browser bundle, and the error-log RLS contract on every pull request.

## Deployment verification

Before release, apply pending migrations and deploy the changed Edge Functions. After deployment, verify:

1. anonymous and authenticated users can insert a privacy-minimized error event but cannot select it;
2. user A cannot read or mutate user B's retirement or membership records;
3. an unapproved `Origin` receives `403` from the hardened functions;
4. unauthenticated calls to privileged functions receive `401`;
5. the service-role key exists only in Edge Function secrets.

The scheduled production smoke workflow checks that the published HTML and JavaScript bundle are reachable and contain the critical retirement-investment features. Operational alert delivery should be configured in GitHub Actions/Supabase for failed workflow runs and error-log review.
