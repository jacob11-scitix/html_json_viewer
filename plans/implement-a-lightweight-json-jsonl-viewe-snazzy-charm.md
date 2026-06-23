# Lightweight JSON / JSONL Viewer with Markdown + LaTeX

## Context

The repo currently contains only a `LICENSE` and a one-line `README.md`. The goal
is to build, from scratch, a small client-side viewer that:

- Loads JSON and JSONL (newline-delimited JSON) files.
- Renders an interactive collapsible tree.
- Auto-detects Markdown and LaTeX inside string values and renders them in place.
- Works fully offline — no server, no build step, no network at runtime.
- Looks pleasant ("snazzy / charm" — modern dark UI with light-mode toggle).

The intended user opens `index.html` in a browser, drops a JSON/JSONL file in,
and gets a readable, navigable view with math and prose rendered properly.

## Resolved decisions (from clarifying questions)

| Topic | Choice |
|---|---|
| Packaging | Small static project: `index.html` + a few JS/CSS files, no build step |
| Library hosting | Vendored locally in `vendor/` — fully offline |
| Rich-text detection | Auto-detect on every string value |
| LaTeX renderer | KaTeX |
| Input methods | File picker, drag-and-drop, paste-text panel |
| JSONL layout | Pagination with page-size dropdown, default 20/page (supersedes virtualization — see note below) |
| Tree features | Collapse/expand, search by key/value, copy-node-as-JSON, JSON path on hover |

> **Note on JSONL layout:** the answer set selected both "virtualized list" and
> "split into pages with a page-size dropdown (default 20)". These are
> alternative strategies — this plan adopts the pagination scheme (since
> concrete parameters were given) and drops virtualization. If virtualization
> is also wanted on top of pagination, flag before implementation.

## File layout

```
html_json_viewer/
├── index.html              # shell: toolbar, drop zone, paste panel, viewer pane, status bar
├── css/
│   └── styles.css          # dark/light theme, tree styling, card layout, transitions
├── js/
│   ├── app.js              # entry point: wires inputs, orchestrates parser → renderer
│   ├── parser.js           # JSON vs JSONL detection + parsing with error reporting
│   ├── tree.js             # recursive tree renderer, expand/collapse, copy, path tracking
│   ├── search.js           # live filter across keys/values with match highlighting
│   ├── pagination.js       # page-size dropdown (10/20/50/100/All), prev/next, page jump
│   └── richtext.js         # markdown+latex auto-detect, render via marked + KaTeX
└── vendor/
    ├── marked.min.js       # Markdown (~50 KB)
    ├── katex.min.js        # LaTeX math (~280 KB)
    ├── katex.min.css
    └── katex-fonts/        # WOFF2 only to keep size down (~250 KB)
```

No `package.json`, no bundler. Plain ES modules loaded via `<script type="module">`.

## Key designs

### 1. Input handling (`app.js`)

- `<input type="file" accept=".json,.jsonl,.ndjson,.txt">` button.
- Document-level `dragover`/`drop` listeners showing a full-page overlay; on drop,
  read first file via `FileReader.readAsText`.
- A collapsible "Paste JSON/JSONL" panel with a `<textarea>` and a Render button.
- After loading, hand raw text to `parser.parse(text)`.

### 2. Parser (`parser.js`)

- Try `JSON.parse(text)` first → single document.
- On failure, split by `\n`, trim, drop empties, try parsing each line. If ≥90%
  succeed, treat as JSONL and return `{ kind: 'jsonl', records: [...] }`.
- Otherwise return parse error with the offending line/column.

### 3. Tree renderer (`tree.js`)

- Recursively builds DOM nodes: `<div class="node" data-path="...">` containing
  key, type chip, collapse caret, and value (or summary for objects/arrays).
- Object/array nodes are collapsible; primitive nodes render their value.
- Strings go through `richtext.detect()` — if Markdown/LaTeX detected, render rich;
  otherwise render as a styled plain string with quote marks.
- Every rich-rendered cell has a tiny "raw" toggle to revert to source text
  (escape hatch for false positives).
- Each node exposes a "copy as JSON" button (clipboard API on subtree).
- Hovering a node sets a status-bar string like `root.items[3].body`.

### 4. Rich-text detection (`richtext.js`)

Heuristics applied per string:

- **LaTeX**: presence of `\\(...\\)`, `\\[...\\]`, `$$...$$`, inline `$...$`
  (with non-whitespace inside), or `\\begin{...}`.
- **Markdown**: code fence ``` ``` ```, heading `^#{1,6} `, bullet/numbered list,
  bold `**...**` / italic `*...*` / `_..._`, link `[text](url)`, table pipe rows,
  or blockquote `^> `.
- If neither: render as plain string (preserving newlines via `white-space:
  pre-wrap`).
- If detected: extract math segments first (placeholder tokens), feed remaining
  text to `marked.parse(...)`, then walk the rendered HTML and replace
  placeholders with `katex.renderToString(...)`. This avoids marked mangling
  TeX backslashes.

### 5. Search (`search.js`)

- Debounced input in toolbar (case-insensitive substring on keys and stringified
  values).
- Walks the tree data once on each query; hides non-matching subtrees but keeps
  ancestor chains visible and auto-expanded; wraps matched substrings in
  `<mark>` for highlighting.
- Clears highlights/filter when query is empty.

### 6. Pagination (`pagination.js`, JSONL only)

- Toolbar shows: page-size `<select>` (10 / 20 / 50 / 100 / All), prev/next
  buttons, "Page X of Y", and a jump-to-page input.
- Default page size = 20.
- Each record on the current page renders as its own collapsible card via
  `tree.renderRecord(record, index)`.
- Page-size change preserves the first record currently visible when possible.

### 7. Styling (`css/styles.css`)

- CSS custom properties for theming; `:root` defines dark palette,
  `:root[data-theme="light"]` overrides.
- Theme toggle in toolbar, persisted in `localStorage`.
- Type chips colored by JSON type (string / number / boolean / null / object /
  array).
- Subtle card shadows, smooth caret rotation, rounded corners, monospace for
  raw values, system UI font for rendered Markdown.
- KaTeX CSS imported; ensure font URLs in `katex.min.css` resolve to
  `vendor/katex-fonts/`.

## Vendoring steps

1. Download `marked.min.js` (latest stable) into `vendor/`.
2. Download KaTeX release: take `katex.min.js`, `katex.min.css`, and the
   WOFF2 font files from `fonts/`. Edit `katex.min.css` paths if needed so
   they point at `katex-fonts/`.
3. Confirm everything loads with `file://` (no module CORS issues — use
   `<script>` non-module for vendor files, ES modules for app code).

## Verification

Manual end-to-end checks (no automated tests for a UI-only static project):

1. **Open** `index.html` directly via `file://` in a browser. Toolbar, drop
   zone, and paste panel render. No console errors.
2. **JSON file**: drop a nested object (e.g., `package.json`-style). Tree
   expands/collapses; copy-as-JSON puts the right subtree on clipboard; path
   shows on hover.
3. **JSONL file**: drop a file with ~100 records. Default page shows 20.
   Page-size dropdown changes count; prev/next navigates; jump-to-page works.
4. **Markdown rendering**: include a string like
   `"## Heading\n\n**bold** and *italic*, and `inline code`"` — renders as
   formatted HTML, raw toggle reverts.
5. **LaTeX rendering**: include strings with `$E=mc^2$` and `$$\\int_0^1 x\\,dx$$`
   — renders via KaTeX, no network requests in DevTools.
6. **Offline test**: disable the network (DevTools "Offline" or pull Wi-Fi),
   reload — everything still works.
7. **Search**: type a substring; non-matching nodes hide, matches highlight.
8. **Paste path**: paste raw JSONL into the textarea, click Render, confirm
   same behavior as drop.
9. **Bad input**: paste malformed JSON; user sees an inline error with the
   line/column of failure.
10. **Theme toggle**: switch light/dark; preference survives reload.
