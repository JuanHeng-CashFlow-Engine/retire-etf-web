import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function base64AssetPlugin(): Plugin {
  const prefix = '\0base64-asset:'
  let command: 'build' | 'serve' = 'serve'

  return {
    name: 'base64-asset',
    enforce: 'pre',
    configResolved(config: { command: 'build' | 'serve' }) {
      command = config.command
    },
    resolveId(source: string, importer?: string) {
      if (!source.endsWith('.b64?asset') || !importer) return null
      const absolutePath = path.resolve(path.dirname(importer), source.slice(0, -'?asset'.length))
      return `${prefix}${absolutePath}`
    },
    load(id: string) {
      if (!id.startsWith(prefix)) return null
      const filePath = id.slice(prefix.length)
      const bytes = Buffer.from(readFileSync(filePath, 'utf8').trim(), 'base64')
      const mime = filePath.endsWith('.png.b64') ? 'image/png' : 'image/jpeg'

      if (command === 'serve') {
        return `export default ${JSON.stringify(`data:${mime};base64,${bytes.toString('base64')}`)}`
      }

      const referenceId = this.emitFile({
        type: 'asset',
        name: path.basename(filePath, '.b64'),
        source: bytes,
      })
      return `export default import.meta.ROLLUP_FILE_URL_${referenceId}`
    },
  }
}

export default defineConfig({
  plugins: [react(), base64AssetPlugin()],
  base:
    process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY
      ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
      : '/',
  build: {
    sourcemap: true,
  },
})
