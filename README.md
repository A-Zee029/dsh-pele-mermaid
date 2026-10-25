# dsh-pele-mermaid

A DeepSeek Harness bundle that renders Mermaid diagrams in Markdown document
previews with [Pele](https://pele.run/) — a zero-dependency, themeable
Mermaid-to-SVG renderer.

## What it does

The built-in Sidebar document preview renders Markdown files as text, so
```mermaid fenced blocks show up as source code. This bundle registers an
alternative preview implementation, `Markdown + Mermaid`, that becomes the
default for `.md`, `.markdown`, `.mmd`, and `.mermaid` files:

- ```mermaid fenced blocks render as SVG diagrams via Pele, themed from the
  DSH theme tokens (`--dsw-alias-*`), adapting to light and dark themes.
- Everything else renders through the standard `MarkdownText` primitive, so
  headings, code blocks, math, footnotes, and images behave as before.
- `.mmd` / `.mermaid` files render the whole file as one diagram.
- A diagram Pele cannot parse falls back to an error box with the parse
  message; use the viewer dropdown in the preview header to switch back to
  the built-in Markdown renderer at any time.

## Chat transcripts

The built-in chat has no fence-level rendering hook (`MarkdownText` is a
closed primitive), so instead of replacing the whole assistant node view a
hidden component rides the `conversation.chat.turnTail` list slot and watches
the transcript DOM. The transcript DOM does not carry the fence language (for
unregistered languages like mermaid the block banner shows a generic label),
so candidate blocks are identified by shape — an unhighlighted `pre`, where
registered languages render `pre.shiki` or a highlight div — and by content:
Pele's `detectType` must recognize the text as a diagram. Each accepted block
is hidden in place and followed by a sibling element holding the Pele-rendered
SVG. Only DOM the built-in renderer does not manage (inline style, the
inserted sibling) is touched, so streaming, edits, and React reconciliation
keep working. While a source does not parse (for example while it is still
streaming in), the ordinary code block stays visible; the diagram appears as
soon as the source parses.

A diagram that would stand taller than ~420 px in the column (after fitting to
the column width) gets a compact 340 px preview instead of stretching the
transcript. The preview keeps the diagram at a readable scale (100% where the
column allows), fades into an explicit expansion affordance, and never captures
ordinary wheel scrolling. Clicking it opens a frame-wide viewer through
`shell.overlay` with drag-to-pan, wheel zoom, Fit diagram, Fit width, 1:1, Reset,
and Escape/close controls. The viewer starts at Fit width (capped at 100%) so a
very tall diagram stays readable; Fit diagram remains available for an overview.
Shorter diagrams render inline as before; the document preview keeps its inline
rendering.

## Install

Requires a DSH runtime matching `engines.dsh` (0.2.1-rc.3 ≤ version < 0.3.0):

```sh
dsh plugin --profile <name> add <path-to-this-package>
```

Restart DSH (or reload the Web GUI) if HMR does not pick the change up.

## Develop

```sh
npm install          # pele + esbuild + react for building/testing
node scripts/build-client.mjs   # bundle src/client-entry.js → lib/client.js
node scripts/smoke.mjs          # run the client bundle headlessly
```

The browser half is hand-targeted at the `window.__ModuleLoader__` factory
format: React and `@deepseek-ai/dsh-client-ui-primitives` resolve against the
web shell's static module table, and Pele is inlined into the bundle.
