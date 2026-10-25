#!/usr/bin/env node
// Bundle src/client-entry.js into lib/client.js using the
// window.__ModuleLoader__ factory format the DSH web shell loads.

import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const result = await build({
  entryPoints: [resolve(root, 'src/client-entry.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  minify: true,
  write: false,
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  logLevel: 'info',
})

const bundle = result.outputFiles[0].text
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
mkdirSync(resolve(root, 'lib'), { recursive: true })
writeFileSync(resolve(root, 'lib/client.js'), [
  `window.__ModuleLoader__.load({`,
  `\tid: ${JSON.stringify(manifest.name)},`,
  `\tfactory: (require) => {`,
  `\t\tvar module = { exports: {} };`,
  `\t\tvar exports = module.exports;`,
  bundle,
  `\t\treturn module.exports;`,
  `\t}`,
  `});`,
  '',
].join('\n'))
console.log('wrote lib/client.js')
