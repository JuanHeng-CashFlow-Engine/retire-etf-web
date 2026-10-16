import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1')
const failures = []
const functionRoot = join(root, 'supabase', 'functions')
const functionNames = (await readdir(functionRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory() && entry.name !== '_shared').map((entry) => entry.name)

for (const name of functionNames) {
  const source = await readFile(join(functionRoot, name, 'index.ts'), 'utf8')
  if (/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/.test(source)) failures.push(`${name}: wildcard CORS`)
  if (source.includes('SUPABASE_SERVICE_ROLE_KEY') && !['subscription-webhook', 'market-dividend-sync'].includes(name) && !source.includes('auth.getUser')) failures.push(`${name}: service role without user authentication`)
}

const clientFiles = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await walk(path)
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) clientFiles.push(path)
  }
}
await walk(join(root, 'src'))
for (const file of clientFiles) {
  const source = await readFile(file, 'utf8')
  if (/service[_-]?role/i.test(source)) failures.push(`${file}: service-role reference in browser source`)
}

const sqlFiles = []
for (const directory of [join(root, 'database'), join(root, 'supabase', 'migrations')]) {
  for (const entry of await readdir(directory, { withFileTypes: true })) if (entry.isFile() && entry.name.endsWith('.sql')) sqlFiles.push(join(directory, entry.name))
}
const sql = (await Promise.all(sqlFiles.map((file) => readFile(file, 'utf8')))).join('\n').toLowerCase()
const createdTables = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/g)].map((match) => match[1])
for (const table of [...new Set(createdTables)]) {
  if (!sql.includes(`alter table public.${table} enable row level security`)) failures.push(`${table}: repository-created table without RLS enablement`)
}

const monitoringMigration = await readFile(join(root, 'supabase', 'migrations', '20261016090000_client_error_monitoring.sql'), 'utf8')
for (const requirement of ['enable row level security', 'grant insert', 'to anon', 'to authenticated', 'user_id = (select auth.uid())']) {
  if (!monitoringMigration.toLowerCase().includes(requirement)) failures.push(`client_error_logs migration missing: ${requirement}`)
}

const functionConfig = await readFile(join(root, 'supabase', 'config.toml'), 'utf8')
const jwtSetting = (name) => functionConfig.match(new RegExp(`\\[functions\\.${name.replaceAll('-', '\\-')}\\]\\s+verify_jwt\\s*=\\s*(true|false)`, 'm'))?.[1]
for (const name of ['billing-status', 'market-dividend-sync', 'subscription-webhook']) {
  if (jwtSetting(name) !== 'false') failures.push(`${name}: machine endpoint must disable gateway JWT verification explicitly`)
}
for (const name of ['account-delete', 'financial-analysis', 'financial-analysis-auth', 'subscription-checkout', 'subscription-portal', 'subscription-trial']) {
  if (jwtSetting(name) !== 'true') failures.push(`${name}: user endpoint must require gateway JWT verification explicitly`)
}

if (failures.length) {
  console.error(`Security audit failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`Security audit passed: ${functionNames.length} Edge Functions, ${clientFiles.length} browser source files and ${new Set(createdTables).size} repository-created tables checked.`)
