// Smoke test: execute lib/client.js in the module-loader factory format with
// stubbed externals, then render the preview body through react-dom/server.

import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import React from 'react'
import { renderToString } from 'react-dom/server'

const stubs = {
  react: React,
  '@deepseek-ai/dsh-client-ui-primitives': {
    MarkdownText: ({ text }) => React.createElement('div', null, text),
  },
}

let registered = null
const staleStyle = { textContent: 'old-style' }
const sandbox = {
  window: {
    __ModuleLoader__: {
      load: (definition) => { registered = definition },
    },
  },
  document: {
    getElementById: (id) => id === 'dsh-pele-mermaid-style' ? staleStyle : null,
    createElement: () => ({ style: {} }),
    head: { appendChild: () => {} },
  },
}
vm.createContext(sandbox)
vm.runInContext(readFileSync('lib/client.js', 'utf8'), sandbox)

if (registered === null || registered.id !== 'dsh-pele-mermaid') throw new Error('not registered')
const exports = registered.factory((request) => {
  if (!(request in stubs)) throw new Error(`unexpected require: ${request}`)
  return stubs[request]
})
if (typeof exports.apply !== 'function' || !Array.isArray(exports.inject)) {
  throw new Error(`bad exports: ${Object.keys(exports)}`)
}
console.log('inject:', exports.inject.join(', '))

const registrations = []
const slotEntries = []
const ctx = {
  locale: {
    bind: (ns) => (key) => `[${ns}:${key}]`,
    register: (ns) => () => {},
  },
  documentPreviews: { register: (def) => { registrations.push(def); return () => {} } },
  slots: {
    register: (options, component) => { slotEntries.push({ ...options, component }); return () => {} },
    inject: (name, create) => { create(); return () => {} },
  },
  effect: (fn) => fn(),
}
exports.apply(ctx)

const metadata = registrations[0]
console.log('metadata:', JSON.stringify({ id: metadata.id, extensions: metadata.extensions, loading: metadata.loading }))
console.log('title():', metadata.title())
const entry = slotEntries.find((candidate) => candidate.name === 'sidebar.right.tab.document')
console.log('slot entry:', entry.name, entry.key, entry.locale)
const watch = slotEntries.find((candidate) => candidate.name === 'conversation.chat.turnTail')
console.log('chat watch entry:', watch.name, watch.id, watch.order, watch.locale)
const overlay = slotEntries.find((candidate) => candidate.name === 'shell.overlay')
if (overlay === undefined || overlay.id !== 'pele-mermaid-viewer') {
  throw new Error('chat viewer overlay not registered')
}
console.log('chat viewer overlay:', overlay.name, overlay.id, overlay.order, overlay.locale)
const closedOverlay = renderToString(React.createElement(overlay.component))
if (closedOverlay !== '') throw new Error('chat viewer should be closed initially')

const t = (key) => key
const cases = [
  ['# Heading\n\ntext\n\n```mermaid\nflowchart TD\n  A --> B\n```\n\nmore text', false,
    { svg: true, markdown: true, error: false }],
  ['flowchart LR\n  X --> Y', true,
    { svg: true, markdown: false, error: false }],
  ['```mermaid\nthis is ((not a diagram\n```\n', false,
    { svg: false, markdown: false, error: true }],
]
for (const [text, diagramOnly, expected] of cases) {
  const out = renderToString(React.createElement(entry.component, {
    content: { kind: 'text', text, eof: true },
    resourceAddress: diagramOnly
      ? 'dsh-resource://file/session/s1/diagram.mmd'
      : 'dsh-resource://file/session/s1/doc.md',
    wrap: true,
    t,
  }))
  const hasSvg = out.includes('class="pele pele-')
  const hasHeading = out.includes('Heading')
  const hasError = out.includes('dsh-pele-mermaid-error')
  console.log(`case diagramOnly=${diagramOnly}: svg=${hasSvg} markdown=${hasHeading} error=${hasError}`)
  if (hasSvg !== expected.svg || hasHeading !== expected.markdown || hasError !== expected.error) {
    throw new Error(`unexpected render: ${JSON.stringify({ hasSvg, hasHeading, hasError, expected })}`)
  }
}
if (!staleStyle.textContent.includes('.dsh-pele-mermaid-chat-preview')) {
  throw new Error('stale HMR style was not refreshed')
}
console.log('stale HMR style refreshed:', staleStyle.textContent.includes('.dsh-pele-mermaid-viewer-viewport'))
console.log('SMOKE OK')
