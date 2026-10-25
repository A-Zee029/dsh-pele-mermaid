// Browser client half, bundled by scripts/build-client.mjs into lib/client.js
// in the window.__ModuleLoader__ factory format. React and the DSH UI
// primitives stay external and resolve against the web shell module table.

import { createElement, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { detectType, render as peleRender } from 'pele'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'

const inject = ['locale', 'slots', 'documentPreviews']

const BODY_ID = 'dsh-pele-mermaid/preview'

const STYLE_ID = 'dsh-pele-mermaid-style'
let styleApplied = false
const STYLE_TEXT = [
  '.dsh-pele-mermaid{',
  '--pele-bg:var(--dsw-alias-bg-document-preview,transparent);',
  '--pele-fg:var(--dsw-alias-label-primary,#1f1f1f);',
  '--pele-muted:var(--dsw-alias-label-secondary,#6e6e6e);',
  '--pele-line:var(--dsw-alias-label-primary,#1f1f1f);',
  '--pele-surface:var(--dsw-alias-bg-layer-2,#f3f3f3);',
  '--pele-surface-alt:var(--dsw-alias-bg-layer-1,#fff);',
  '--pele-border:var(--dsw-alias-border-l2,#8a8a8a);',
  'margin:12px 0;display:flex;justify-content:center;overflow-x:auto}',
  '.dsh-pele-mermaid svg{max-width:100%}',
  '.dsh-pele-mermaid-error{color:var(--dsw-alias-label-secondary);',
  'font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px;',
  'white-space:pre-wrap;word-break:break-word;border:.5px solid var(--dsw-alias-border-l2);',
  'border-radius:var(--dsw-radius-md);padding:12px;margin:12px 0}',
  '.dsh-pele-mermaid-doc{box-sizing:border-box;min-width:100%;min-height:100%;padding:8px;white-space:normal}',
  '.dsh-pele-mermaid-doc[data-wrap=true] pre{white-space:pre-wrap}',

  // 长图消息卡片：只展示可读局部，不在内嵌区域监听滚轮。
  '.dsh-pele-mermaid-chat-card{display:block;position:relative;overflow:hidden;margin:12px 0;padding:0;',
  'border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);',
  'background:var(--dsw-alias-bg-layer-2)}',
  '.dsh-pele-mermaid-chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;',
  'padding:10px 12px;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
  '.dsh-pele-mermaid-chat-title{display:flex;align-items:baseline;gap:8px;min-width:0}',
  '.dsh-pele-mermaid-chat-title strong{font-size:13px;font-weight:600}',
  '.dsh-pele-mermaid-chat-title span,.dsh-pele-mermaid-chat-caption{font-size:11px;',
  'color:var(--dsw-alias-label-secondary)}',
  '.dsh-pele-mermaid-chat-expand{flex:none;border:.5px solid var(--dsw-alias-border-l2);',
  'border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);',
  'padding:4px 9px;font:inherit;font-size:11px;cursor:pointer}',
  '.dsh-pele-mermaid-chat-expand:hover{border-color:var(--dsw-alias-label-secondary)}',
  '.dsh-pele-mermaid-chat-preview{position:relative;height:340px;overflow:hidden;cursor:zoom-in;',
  'outline:none;background:var(--dsw-alias-bg-layer-2)}',
  '.dsh-pele-mermaid-chat-preview:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-alias-brand-primary)}',
  '.dsh-pele-mermaid-chat-crop{display:flex;justify-content:center;align-items:flex-start;padding:16px 12px 80px}',
  '.dsh-pele-mermaid-chat-crop svg{flex:none;max-width:calc(100% - 24px);height:auto}',
  '.dsh-pele-mermaid-chat-fade{position:absolute;inset:auto 0 0;height:128px;pointer-events:none;',
  'background:linear-gradient(to bottom,transparent,var(--dsw-alias-bg-layer-2) 82%)}',
  '.dsh-pele-mermaid-chat-open{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);',
  'border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:6px 13px;',
  'background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);',
  'box-shadow:0 3px 12px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);',
  'font-size:12px;white-space:nowrap;pointer-events:none}',
  '.dsh-pele-mermaid-chat-preview:hover .dsh-pele-mermaid-chat-open{border-color:var(--dsw-alias-label-secondary)}',
  '.dsh-pele-mermaid-chat-caption{display:flex;justify-content:space-between;gap:12px;padding:7px 12px;',
  'border-top:.5px solid var(--dsw-alias-border-l2)}',

  // shell.overlay 中的专注查看器；只有这里捕获滚轮与键盘缩放。
  '.dsh-pele-mermaid-viewer{position:fixed;inset:0;z-index:10;display:flex;flex-direction:column;',
  'justify-content:flex-start;margin:0;overflow:hidden;pointer-events:auto;',
  'background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}',
  '.dsh-pele-mermaid-viewer-header{display:flex;align-items:center;gap:14px;padding:10px 14px;',
  'border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}',
  '.dsh-pele-mermaid-viewer-title{display:flex;flex-direction:column;min-width:120px}',
  '.dsh-pele-mermaid-viewer-title strong{font-size:14px}',
  '.dsh-pele-mermaid-viewer-title span{color:var(--dsw-alias-label-secondary);font-size:11px}',
  '.dsh-pele-mermaid-viewer-controls{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;',
  'gap:5px;margin-left:auto}',
  '.dsh-pele-mermaid-viewer-controls button,.dsh-pele-mermaid-viewer-close{',
  'border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);',
  'color:var(--dsw-alias-label-primary);padding:5px 9px;font:inherit;font-size:12px;cursor:pointer}',
  '.dsh-pele-mermaid-viewer-controls button:hover,.dsh-pele-mermaid-viewer-close:hover{',
  'border-color:var(--dsw-alias-label-secondary)}',
  '.dsh-pele-mermaid-viewer-zoom{min-width:45px;text-align:center;color:var(--dsw-alias-label-secondary);',
  'font-size:12px;font-variant-numeric:tabular-nums}',
  '.dsh-pele-mermaid-viewer-close{flex:none}',
  '.dsh-pele-mermaid-viewer-viewport{position:relative;flex:1;overflow:hidden;cursor:grab;outline:none;',
  'touch-action:none;user-select:none;',
  'background-image:radial-gradient(color-mix(in srgb,var(--dsw-alias-border-l2) 65%,transparent) 1px,transparent 1px);',
  'background-size:20px 20px}',
  '.dsh-pele-mermaid-viewer-viewport.is-dragging{cursor:grabbing}',
  '.dsh-pele-mermaid-viewer-stage{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform}',
  '.dsh-pele-mermaid-viewer-stage svg{display:block;max-width:none}',
  '.dsh-pele-mermaid-viewer-status{padding:6px 12px;border-top:.5px solid var(--dsw-alias-border-l2);',
  'background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:11px;text-align:center}',
  '@media(max-width:760px){.dsh-pele-mermaid-viewer-header{flex-wrap:wrap;gap:8px}',
  '.dsh-pele-mermaid-viewer-title{min-width:0;margin-right:auto}',
  '.dsh-pele-mermaid-viewer-controls{order:3;width:100%;margin-left:0}',
  '.dsh-pele-mermaid-chat-caption span:last-child{display:none}}',
].join('')

function ensureStyle() {
  if (typeof document === 'undefined') return
  let element = document.getElementById(STYLE_ID)
  if (element === null) {
    element = document.createElement('style')
    element.id = STYLE_ID
    element.textContent = STYLE_TEXT
    document.head.appendChild(element)
    styleApplied = true
    return
  }
  // HMR 会保留旧 <style>；每次模块激活覆盖一次，之后不在观察器热路径重复写入。
  if (styleApplied) return
  element.textContent = STYLE_TEXT
  styleApplied = true
}

const FENCE = /^\s*(`{3,})\s*mermaid[^\n]*$/i

/** Split a Markdown document into plain-Markdown and Mermaid fence segments. */
function splitMermaid(text) {
  const segments = []
  const lines = text.split('\n')
  let plain = []
  let index = 0
  while (index < lines.length) {
    const match = FENCE.exec(lines[index])
    if (match === null) {
      plain.push(lines[index])
      index += 1
      continue
    }
    const ticks = match[1].length
    const closing = new RegExp('^\\s*`{' + ticks + ',}[ \\t]*$')
    const code = []
    let scan = index + 1
    while (scan < lines.length && !closing.test(lines[scan])) {
      code.push(lines[scan])
      scan += 1
    }
    if (plain.length > 0) {
      segments.push({ type: 'markdown', text: plain.join('\n') })
      plain = []
    }
    segments.push({ type: 'mermaid', text: code.join('\n') })
    index = scan + 1
  }
  if (plain.length > 0) segments.push({ type: 'markdown', text: plain.join('\n') })
  return segments
}

function isDiagramOnly(resourceAddress) {
  return /\.(mmd|mermaid)(?:[?#].*)?$/i.test(decodeURIComponent(resourceAddress))
}

function Diagram({ source }) {
  const result = useMemo(() => {
    try {
      return { svg: peleRender(source).svg }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [source])
  if (result.error !== undefined) {
    return createElement('pre', { className: 'dsh-pele-mermaid-error' }, result.error)
  }
  return createElement('div', {
    className: 'dsh-pele-mermaid',
    dangerouslySetInnerHTML: { __html: result.svg },
  })
}

function MermaidMarkdownBody({ content, resourceAddress, wrap, t }) {
  ensureStyle()
  const text = content.kind === 'text' ? content.text : ''
  const diagramOnly = isDiagramOnly(resourceAddress)
  const segments = useMemo(
    () => (diagramOnly ? [] : splitMermaid(text)),
    [text, diagramOnly],
  )
  const labels = useMemo(() => ({
    code: {
      copyLabel: t('code.copy'),
      copiedLabel: t('code.copied'),
      toolbarLabels: {
        codeLabel: t('codeBlock.title'),
        wrapLabel: t('codeBlock.wrap'),
        unwrapLabel: t('codeBlock.unwrap'),
      },
    },
    footnotes: t('footnotes'),
  }), [t])
  if (content.kind !== 'text') return null
  const children = diagramOnly
    ? [createElement(Diagram, { key: 'diagram', source: text })]
    : segments.map((segment, position) => segment.type === 'mermaid'
      ? createElement(Diagram, { key: position, source: segment.text })
      : createElement(primitives.MarkdownText, {
        key: position,
        text: segment.text,
        streaming: !content.eof,
        labels,
      }))
  return createElement('div', {
    className: 'dsh-pele-mermaid-doc',
    'data-document-markdown': true,
    'data-wrap': wrap ? 'true' : undefined,
  }, ...children)
}

const zh = {
  'viewer.label': 'Markdown + Mermaid',
  'code.copy': '复制',
  'code.copied': '已复制',
  'footnotes': '脚注',
  'codeBlock.title': '代码块',
  'codeBlock.wrap': '换行',
  'codeBlock.unwrap': '取消换行',
  'chat.title': 'Mermaid 图表',
  'chat.long': '长图',
  'chat.expand': '⛶ 全屏查看',
  'chat.expandFull': '⛶ 展开完整图表',
  'chat.preview': '局部预览 · 默认 100%',
  'chat.wheelPassthrough': '普通滚轮继续滚动会话',
  'chat.focused': '专注查看',
  'chat.zoomIn': '放大',
  'chat.zoomOut': '缩小',
  'chat.fit': '适配全图',
  'chat.fitWidth': '适配宽度',
  'chat.one': '1:1',
  'chat.reset': '复位',
  'chat.close': 'Esc 关闭',
  'chat.status': '滚轮缩放 · 拖拽平移 · 0 适配全图 · 1 原始大小 · Esc 关闭',
}

const en = {
  'viewer.label': 'Markdown + Mermaid',
  'code.copy': 'Copy',
  'code.copied': 'Copied',
  'footnotes': 'Footnotes',
  'codeBlock.title': 'Code block',
  'codeBlock.wrap': 'Wrap',
  'codeBlock.unwrap': 'Unwrap',
  'chat.title': 'Mermaid diagram',
  'chat.long': 'Large diagram',
  'chat.expand': '⛶ Full screen',
  'chat.expandFull': '⛶ View full diagram',
  'chat.preview': 'Partial preview · 100% by default',
  'chat.wheelPassthrough': 'Scroll continues the conversation',
  'chat.focused': 'Focused view',
  'chat.zoomIn': 'Zoom in',
  'chat.zoomOut': 'Zoom out',
  'chat.fit': 'Fit diagram',
  'chat.fitWidth': 'Fit width',
  'chat.one': '1:1',
  'chat.reset': 'Reset',
  'chat.close': 'Close (Esc)',
  'chat.status': 'Scroll to zoom · Drag to pan · 0 fit · 1 actual size · Esc close',
}

// ---- Chat transcript enhancement -------------------------------------------------
//
// The built-in chat renders assistant text through MarkdownText, which has no
// fence-level rendering hook. Instead of replacing the whole assistant-step
// node view (and losing its reasoning/image/presentation machinery), a hidden
// component rides the per-turn `conversation.chat.turnTail` list slot and
// watches the transcript DOM: every code block the built-in renderer produced
// for a ```mermaid fence is hidden in place and followed by a sibling element
// holding the Pele-rendered SVG. A diagram that fits the column height-wise
// renders inline; a taller one gets a readable cropped preview instead of
// stretching the transcript. Opening it mounts a pan/zoom viewer through the
// root shell.overlay slot. Only DOM the built-in renderer does not manage
// (inline style, inserted sibling) is touched, so streaming updates and React
// reconciliation keep working; a source that stops parsing falls back to the
// untouched code block until it parses again.

const CHAT_WATCH_FLAG = 'data-dsh-pele-mermaid-watch'

const chatDiagrams = new Set() // { block, view, source }
const chatDiagramByBlock = new Map()

// 聊天路径拿不到 ctx，apply() 里把绑定好的字典函数存进来，查看器控件用。
let chatT = null

// shell.overlay 的查看器由这个小组件外状态驱动；DOM 事件只负责发打开/关闭请求。
let chatViewer = null // { owner, svgHtml, returnFocus }
const chatViewerListeners = new Set()

// 超过该高度（按列宽等比换算后）的图使用局部预览，否则原样内联。
const CHAT_INLINE_LIMIT = 420

// The transcript DOM does not carry the fence language: for unregistered
// languages the code-block banner shows a generic label, so blocks are
// identified by shape and content instead — an unhighlighted `pre` (registered
// languages render `pre.shiki` or a highlight div) whose text pele recognizes
// as a diagram. Content that only happens to parse as a diagram inside a
// highlighted block of another language is left alone.
function mermaidPre(block) {
  const content = block.querySelector('[data-code-block-content]')
  const pre = content === null ? null : content.firstElementChild
  return pre === null || pre.tagName !== 'PRE' || pre.classList.contains('shiki') ? null : pre
}

function mermaidSource(block) {
  const pre = mermaidPre(block)
  if (pre === null) return null
  const text = pre.textContent ?? ''
  try {
    return detectType(text) === null ? null : text
  } catch {
    return null
  }
}

function chatLabel(key, fallback) {
  return chatT === null ? fallback : chatT(key)
}

function notifyChatViewer() {
  for (const listener of [...chatViewerListeners]) listener()
}

function subscribeChatViewer(listener) {
  chatViewerListeners.add(listener)
  return () => { chatViewerListeners.delete(listener) }
}

function getChatViewer() {
  return chatViewer
}

function closeChatViewer(restoreFocus = true) {
  const current = chatViewer
  if (current === null) return
  chatViewer = null
  notifyChatViewer()
  if (!restoreFocus) return
  const target = current.returnFocus
  if (target !== null && target.isConnected && typeof target.focus === 'function') target.focus()
}

function closeChatViewerFor(owner) {
  if (chatViewer !== null && chatViewer.owner === owner) closeChatViewer(false)
}

function openChatViewer(owner, svg) {
  if (chatViewer !== null) return
  chatViewer = {
    owner,
    svgHtml: svg.outerHTML,
    returnFocus: document.activeElement,
  }
  notifyChatViewer()
}

function releaseChatDiagram(entry) {
  closeChatViewerFor(entry.view)
  if (entry.resizeObserver !== undefined) entry.resizeObserver.disconnect()
  entry.view.remove()
  entry.block.style.display = ''
  chatDiagrams.delete(entry)
  chatDiagramByBlock.delete(entry.block)
}

// pele 输出的 svg 自带 width/height 属性，读属性即可拿自然尺寸，不必强制布局
function svgNaturalSize(svg) {
  const w = Number(svg.getAttribute('width'))
  const h = Number(svg.getAttribute('height'))
  if (Number.isFinite(w) && Number.isFinite(h)) return { w, h }
  const box = svg.getBoundingClientRect()
  return { w: box.width, h: box.height }
}

function chatDiagramFocusTarget(view) {
  const preview = view.querySelector('.dsh-pele-mermaid-chat-preview')
  if (preview !== null) return preview
  view.tabIndex = -1
  return view
}

/** (Re)build one chat diagram: inline when it fits, otherwise a readable
 *  cropped preview that opens the root overlay's interactive viewer. */
function mountChatDiagram(entry, svgHtml, preserveViewer = false) {
  const view = entry.view
  const refocus = !preserveViewer && chatViewer !== null && chatViewer.owner === view
  if (!preserveViewer) closeChatViewerFor(view)
  view.className = 'dsh-pele-mermaid dsh-pele-mermaid-chat'
  view.innerHTML = svgHtml
  const svg = view.firstElementChild
  if (svg === null || svg.tagName.toLowerCase() !== 'svg') return
  const { w, h } = svgNaturalSize(svg)
  const columnWidth = view.clientWidth
  const fitScale = w > 0 && columnWidth > 0 ? Math.min(1, columnWidth / w) : 1
  entry.diagramWidth = w
  entry.diagramHeight = h
  entry.columnWidth = columnWidth
  entry.compact = h * fitScale > CHAT_INLINE_LIMIT
  if (entry.compact) upgradeChatPreview(view, svg)
  if (chatViewer !== null && chatViewer.owner === view) {
    chatViewer.returnFocus = chatDiagramFocusTarget(view)
  }
  if (refocus) chatDiagramFocusTarget(view).focus()
}

function resizeChatDiagram(entry) {
  if (!entry.view.isConnected) return
  const columnWidth = entry.view.clientWidth
  if (!(columnWidth > 0) || columnWidth === entry.columnWidth) return
  entry.columnWidth = columnWidth
  const fitScale = entry.diagramWidth > 0 ? Math.min(1, columnWidth / entry.diagramWidth) : 1
  const compact = entry.diagramHeight * fitScale > CHAT_INLINE_LIMIT
  // 同一分类下由 CSS 处理尺寸变化；只有跨阈值才重建，保留已打开的查看器。
  if (compact === entry.compact) return
  const svg = entry.view.querySelector('svg')
  if (svg !== null) mountChatDiagram(entry, svg.outerHTML, true)
}

function upgradeChatPreview(view, svg) {
  const { w, h } = svgNaturalSize(svg)
  const head = document.createElement('div')
  head.className = 'dsh-pele-mermaid-chat-head'
  const title = document.createElement('div')
  title.className = 'dsh-pele-mermaid-chat-title'
  const name = document.createElement('strong')
  name.textContent = chatLabel('chat.title', 'Mermaid diagram')
  const meta = document.createElement('span')
  meta.textContent = chatLabel('chat.long', 'Large diagram') + ' · ' + Math.round(w) + ' × ' + Math.round(h)
  title.append(name, meta)
  const expand = document.createElement('button')
  expand.type = 'button'
  expand.className = 'dsh-pele-mermaid-chat-expand'
  expand.textContent = chatLabel('chat.expand', '⛶ Full screen')
  head.append(title, expand)

  const preview = document.createElement('div')
  preview.className = 'dsh-pele-mermaid-chat-preview'
  preview.tabIndex = 0
  preview.setAttribute('role', 'button')
  preview.setAttribute('aria-label', chatLabel('chat.expand', 'Full screen'))
  const crop = document.createElement('div')
  crop.className = 'dsh-pele-mermaid-chat-crop'
  svg.style.maxWidth = 'calc(100% - 24px)' // 覆盖 Pele 根 SVG 的内联 max-width:100%
  crop.appendChild(svg)
  const fade = document.createElement('div')
  fade.className = 'dsh-pele-mermaid-chat-fade'
  fade.setAttribute('aria-hidden', 'true')
  const openPill = document.createElement('div')
  openPill.className = 'dsh-pele-mermaid-chat-open'
  openPill.textContent = chatLabel('chat.expandFull', '⛶ View full diagram')
  openPill.setAttribute('aria-hidden', 'true')
  preview.append(crop, fade, openPill)

  const caption = document.createElement('div')
  caption.className = 'dsh-pele-mermaid-chat-caption'
  const previewLabel = document.createElement('span')
  previewLabel.textContent = chatLabel('chat.preview', 'Partial preview · 100% by default')
  const wheelLabel = document.createElement('span')
  wheelLabel.textContent = chatLabel('chat.wheelPassthrough', 'Scroll continues the conversation')
  caption.append(previewLabel, wheelLabel)

  view.classList.add('dsh-pele-mermaid-chat-card')
  view.replaceChildren(head, preview, caption)
  preview.addEventListener('click', open)
  preview.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    open()
  })
  expand.addEventListener('click', open)

  function open() {
    openChatViewer(view, svg)
  }
}

function MermaidChatViewer() {
  const viewer = useSyncExternalStore(subscribeChatViewer, getChatViewer, getChatViewer)
  const viewportRef = useRef(null)
  const stageRef = useRef(null)
  const zoomRef = useRef(null)
  const actionRef = useRef(null)

  useEffect(() => {
    if (viewer === null) return
    ensureStyle()
    const viewport = viewportRef.current
    const stage = stageRef.current
    const zoomLabel = zoomRef.current
    const svg = stage === null ? null : stage.querySelector('svg')
    if (viewport === null || stage === null || zoomLabel === null || svg === null) return
    const { w, h } = svgNaturalSize(svg)
    if (!(w > 0 && h > 0)) return
    // Pele 根 SVG 自带内联 max-width:100%;height:auto；查看器必须按自然尺寸变换。
    svg.style.maxWidth = 'none'
    svg.style.width = w + 'px'
    svg.style.height = h + 'px'
    stage.style.width = w + 'px'
    stage.style.height = h + 'px'

    let scale = 1
    let tx = 0
    let ty = 0
    let mode = 'width'
    let dragging = false
    let lastX = 0
    let lastY = 0
    const clampScale = (value) => Math.min(4, Math.max(0.05, value))

    function applyTransform() {
      const vw = viewport.clientWidth
      const vh = viewport.clientHeight
      const sw = w * scale
      const sh = h * scale
      const pad = 48
      tx = sw <= vw ? (vw - sw) / 2 : Math.min(pad, Math.max(vw - sw - pad, tx))
      ty = sh <= vh ? (vh - sh) / 2 : Math.min(pad, Math.max(vh - sh - pad, ty))
      stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'
      const text = Math.round(scale * 100) + '%'
      if (zoomLabel.textContent !== text) zoomLabel.textContent = text
    }

    function fitAll() {
      mode = 'fit'
      scale = clampScale(Math.min((viewport.clientWidth - 64) / w, (viewport.clientHeight - 64) / h))
      tx = (viewport.clientWidth - w * scale) / 2
      ty = (viewport.clientHeight - h * scale) / 2
      applyTransform()
    }

    function fitWidth() {
      mode = 'width'
      scale = clampScale(Math.min(1, (viewport.clientWidth - 64) / w))
      tx = (viewport.clientWidth - w * scale) / 2
      ty = 24
      applyTransform()
    }

    function actualSize() {
      mode = 'actual'
      scale = 1
      tx = (viewport.clientWidth - w) / 2
      ty = 24
      applyTransform()
    }

    function zoomAt(cx, cy, factor) {
      mode = 'custom'
      const next = clampScale(scale * factor)
      const k = next / scale
      tx = cx - (cx - tx) * k
      ty = cy - (cy - ty) * k
      scale = next
      applyTransform()
    }

    function onWheel(event) {
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1
      zoomAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        Math.exp(-event.deltaY * unit * 0.0015),
      )
    }

    function onPointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      viewport.focus()
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
      viewport.classList.add('is-dragging')
      viewport.setPointerCapture(event.pointerId)
    }

    function onPointerMove(event) {
      if (!dragging) return
      tx += event.clientX - lastX
      ty += event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
      mode = 'custom'
      applyTransform()
    }

    function endDrag() {
      dragging = false
      viewport.classList.remove('is-dragging')
    }

    function onKey(event) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      const dialog = viewport.closest('.dsh-pele-mermaid-viewer')
      if (dialog === null) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeChatViewer()
        return
      }
      if (event.key === 'Tab') {
        const items = [...dialog.querySelectorAll('button, [tabindex="0"]')]
          .filter((element) => !element.disabled && element.getClientRects().length > 0)
        if (items.length > 0) {
          const current = items.indexOf(document.activeElement)
          const next = current < 0
            ? (event.shiftKey ? items.length - 1 : 0)
            : (current + (event.shiftKey ? -1 : 1) + items.length) % items.length
          items[next].focus()
        }
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (!dialog.contains(event.target)) return
      let handled = true
      if (event.key === '0') fitAll()
      else if (event.key === '1') actualSize()
      else if (event.key === '+' || event.key === '=') zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.2)
      else if (event.key === '-') zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.2)
      else handled = false
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    actionRef.current = (act) => {
      if (act === 'in' || act === 'out') {
        zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, act === 'in' ? 1.2 : 1 / 1.2)
      } else if (act === 'fit') {
        fitAll()
      } else if (act === 'width' || act === 'reset') {
        fitWidth()
      } else if (act === 'one') {
        actualSize()
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (mode === 'fit') fitAll()
      else if (mode === 'width') fitWidth()
      else applyTransform()
    })
    resizeObserver.observe(viewport)
    viewport.addEventListener('wheel', onWheel, { passive: false })
    viewport.addEventListener('pointerdown', onPointerDown)
    viewport.addEventListener('pointermove', onPointerMove)
    viewport.addEventListener('pointerup', endDrag)
    viewport.addEventListener('pointercancel', endDrag)
    document.addEventListener('keydown', onKey, true)
    viewport.focus()
    const frame = requestAnimationFrame(fitWidth)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      viewport.removeEventListener('wheel', onWheel)
      viewport.removeEventListener('pointerdown', onPointerDown)
      viewport.removeEventListener('pointermove', onPointerMove)
      viewport.removeEventListener('pointerup', endDrag)
      viewport.removeEventListener('pointercancel', endDrag)
      document.removeEventListener('keydown', onKey, true)
      actionRef.current = null
    }
  }, [viewer])

  if (viewer === null) return null
  const act = (name) => () => {
    if (actionRef.current !== null) actionRef.current(name)
  }
  const button = (name, text, title) => createElement('button', {
    type: 'button',
    title,
    onClick: act(name),
  }, text)

  return createElement('div', {
    className: 'dsh-pele-mermaid dsh-pele-mermaid-viewer',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': chatLabel('chat.title', 'Mermaid diagram'),
  },
  createElement('header', { className: 'dsh-pele-mermaid-viewer-header' },
    createElement('div', { className: 'dsh-pele-mermaid-viewer-title' },
      createElement('strong', null, chatLabel('chat.title', 'Mermaid diagram')),
      createElement('span', null, chatLabel('chat.focused', 'Focused view')),
    ),
    createElement('div', { className: 'dsh-pele-mermaid-viewer-controls' },
      button('out', '−', chatLabel('chat.zoomOut', 'Zoom out')),
      createElement('span', { className: 'dsh-pele-mermaid-viewer-zoom', ref: zoomRef }, '100%'),
      button('in', '＋', chatLabel('chat.zoomIn', 'Zoom in')),
      button('fit', chatLabel('chat.fit', 'Fit diagram'), chatLabel('chat.fit', 'Fit diagram')),
      button('width', chatLabel('chat.fitWidth', 'Fit width'), chatLabel('chat.fitWidth', 'Fit width')),
      button('one', chatLabel('chat.one', '1:1'), chatLabel('chat.one', '1:1')),
      button('reset', chatLabel('chat.reset', 'Reset'), chatLabel('chat.reset', 'Reset')),
    ),
    createElement('button', {
      type: 'button',
      className: 'dsh-pele-mermaid-viewer-close',
      title: chatLabel('chat.close', 'Close (Esc)'),
      onClick: closeChatViewer,
    }, chatLabel('chat.close', 'Close (Esc)')),
  ),
  createElement('div', {
    className: 'dsh-pele-mermaid-viewer-viewport',
    ref: viewportRef,
    tabIndex: 0,
  }, createElement('div', {
    className: 'dsh-pele-mermaid-viewer-stage',
    ref: stageRef,
    dangerouslySetInnerHTML: { __html: viewer.svgHtml },
  })),
  createElement('footer', { className: 'dsh-pele-mermaid-viewer-status' },
    chatLabel('chat.status', 'Scroll to zoom · Drag to pan · 0 fit · 1 actual size · Esc close'),
  ))
}

function enhanceChatTranscript(root) {
  ensureStyle()
  for (const entry of [...chatDiagrams]) {
    if (entry.view.isConnected && entry.view.previousElementSibling === entry.block) continue
    releaseChatDiagram(entry) // the backing block left the DOM
  }
  for (const block of root.querySelectorAll('div.md-code-block')) {
    const existing = chatDiagramByBlock.get(block)
    if (existing !== undefined) {
      const pre = mermaidPre(block)
      if (pre !== null && (pre.textContent ?? '') === existing.source) continue
    }
    const source = mermaidSource(block)
    if (source === null) {
      if (existing !== undefined) releaseChatDiagram(existing)
      continue
    }
    if (existing !== undefined && existing.source === source) continue
    let svg
    try {
      svg = peleRender(source).svg
    } catch {
      svg = undefined
    }
    if (svg === undefined) {
      if (existing !== undefined) releaseChatDiagram(existing)
      continue
    }
    if (existing !== undefined) {
      existing.source = source
      mountChatDiagram(existing, svg)
      continue
    }
    ensureStyle()
    const view = document.createElement('div')
    view.className = 'dsh-pele-mermaid dsh-pele-mermaid-chat'
    block.after(view)
    block.style.display = 'none'
    const entry = { block, view, source }
    chatDiagrams.add(entry)
    chatDiagramByBlock.set(block, entry)
    mountChatDiagram(entry, svg)
    entry.resizeObserver = new ResizeObserver(() => resizeChatDiagram(entry))
    entry.resizeObserver.observe(view)
  }
}

let chatWatchCount = 0
let chatObserver = null
let chatTimer = 0

function isPeleMutation(record) {
  const element = record.target.nodeType === 1 ? record.target : record.target.parentElement
  return element !== null && element.closest('.dsh-pele-mermaid') !== null
}

function runChatWatch() {
  chatTimer = 0
  if (document.body !== null) enhanceChatTranscript(document.body)
}

function scheduleChatWatch() {
  if (chatTimer === 0) chatTimer = setTimeout(runChatWatch, 150)
}

function acquireChatWatch() {
  if (typeof document === 'undefined' || document.body === null) return () => {}
  chatWatchCount += 1
  if (chatWatchCount === 1) {
    chatObserver = new MutationObserver((records) => {
      if (records.every(isPeleMutation)) return
      scheduleChatWatch()
    })
    chatObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
    runChatWatch()
  } else {
    scheduleChatWatch()
  }

  return () => {
    chatWatchCount = Math.max(0, chatWatchCount - 1)
    if (chatWatchCount > 0) return
    if (chatObserver !== null) chatObserver.disconnect()
    chatObserver = null
    if (chatTimer !== 0) {
      clearTimeout(chatTimer)
      chatTimer = 0
    }
    for (const entry of [...chatDiagrams]) releaseChatDiagram(entry)
  }
}

function MermaidChatWatch() {
  useEffect(() => acquireChatWatch(), [])
  return createElement('span', { hidden: true, [CHAT_WATCH_FLAG]: true })
}

function apply(ctx) {
  const t = ctx.locale.bind('peleMermaid')
  chatT = t
  ctx.effect(() => ctx.locale.register('peleMermaid', { zh, en }), 'pele-mermaid: dictionaries')
  ctx.effect(() => ctx.documentPreviews.register({
    id: BODY_ID,
    extensions: ['md', 'markdown', 'mmd', 'mermaid'],
    title: () => t('viewer.label'),
    loading: 'text-pages',
    wrap: false,
  }), 'pele-mermaid: metadata')
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
    name: 'sidebar.right.tab.document',
    key: BODY_ID,
    locale: 'peleMermaid',
  }, MermaidMarkdownBody)), 'pele-mermaid: body')
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'pele-mermaid-viewer',
    order: 100,
    locale: 'peleMermaid',
  }, MermaidChatViewer)), 'pele-mermaid: chat viewer')
  ctx.effect(() => ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail',
    id: 'pele-mermaid',
    order: 100,
    locale: 'peleMermaid',
  }, MermaidChatWatch)), 'pele-mermaid: chat watch')
}

export { apply, inject }
