# AGENTS.md

Conventions for AI agents (and humans) contributing to this repo.

## Hard constraints

- **No build step.** No `package.json`, no bundler, no transpiler. The repo is
  static files that load directly from `file://`.
- **No runtime network.** All dependencies are vendored under `vendor/`. Don't
  swap them for CDN URLs.
- **No framework.** Plain DOM APIs only — no React/Vue/Svelte/jQuery/etc.
- **Classic scripts, not ES modules.** `<script type="module">` does not work
  over `file://` in most browsers. Every `js/*.js` file is an IIFE that
  attaches its public API to `window.JV`.

## Project layout

```
index.html              UI shell + script tags (loads JS in dependency order)
css/styles.css          theme variables, tree styling, dark by default
js/parser.js            JSON vs JSONL detection -> JV.parser
js/richtext.js          markdown + LaTeX detection/render -> JV.richtext
js/tree.js              recursive tree builder -> JV.tree
js/search.js            live filter + highlight -> JV.search
js/pagination.js        JSONL page-size + nav -> JV.pagination
js/app.js               entry point: wires inputs, theme, status bar
vendor/                 marked, KaTeX (JS/CSS), KaTeX WOFF2 fonts
samples/                small demo files for manual verification
plans/                  design notes per change (treat as historical)
```

Dependency order (must match the `<script>` order in `index.html`):
`parser -> richtext -> tree -> search -> pagination -> app`.

## Module pattern

Every JS file looks like:

```js
(function (JV) {
  // private helpers...

  function publicFn() { /* ... */ }

  JV.<moduleName> = { publicFn };
})(window.JV = window.JV || {});
```

When adding a new module:

1. Write the IIFE attaching to `window.JV.<name>`.
2. Insert its `<script>` tag in `index.html` *after* any module it depends on
   and *before* any module that depends on it.
3. Reuse helpers from existing modules instead of duplicating logic
   (`JV.tree.renderTree`, `JV.richtext.renderRich`, …).

## Styling

- All colors and spacing live in CSS custom properties on `:root` (dark theme)
  with overrides on `:root[data-theme="light"]`. Add new colors as variables,
  not hard-coded values.
- The `hidden` HTML attribute must keep working — there is a global
  `[hidden] { display: none !important; }` rule. Don't remove it; use it
  instead of toggling `style.display` ad hoc.
- Keep dark mode the primary, well-tuned palette. Light mode is a courtesy
  toggle, but should still be readable.

## Editing rules

- Edit existing files in place. Don't create parallel "v2" copies.
- Don't add documentation files (other than this one, `README.md`, or the
  per-change notes in `plans/`) unless asked.
- Don't introduce comments that just restate the code. Comments are only for
  non-obvious WHY (a workaround, a `file://` quirk, a perf trick).
- Don't add error handling or fallbacks for impossible cases. Validate at
  boundaries only (file load, user paste, clipboard write).
- File-URL-specific quirks already handled — keep them:
  - `localStorage` is wrapped in try/catch (Safari may block on `file://`).
  - Clipboard copy falls back to `document.execCommand('copy')` when the
    async Clipboard API is unavailable.
- **Input sanitization (Python-emitted JSON).** `parser.js` retries with
  `NaN` / `Infinity` / `-Infinity` replaced by `null` when strict `JSON.parse`
  fails — Python's `json.dump` emits those by default. The replacement walks
  the text character-by-character to skip over string literals. Do not
  replace it with a naive `/NaN/g`-style regex; that would corrupt user
  prose that happens to contain the word "NaN".
- **Default fold state.** All tree nodes (including the root) start
  collapsed, so big files don't paint half a million nodes on first load.
  The toolbar's "Expand all" button is the escape hatch.

## Verification

Before declaring a change done:

1. **Syntax check**: `for f in js/*.js; do node --check "$f"; done` — all
   files must parse.
2. **Open `index.html` via `file://`** in a real browser. Confirm:
   - No console errors.
   - Drag/drop a file from `samples/` works.
   - Markdown and LaTeX render (KaTeX requires the vendored fonts to load —
     check the DevTools Network tab shows `katex-fonts/*.woff2` resolving).
   - Search, expand/collapse, copy-as-JSON, theme toggle, pagination.
3. **Don't claim "verified"** if you only ran the syntax check — say so
   explicitly when the UI wasn't exercised.

## Performance notes

The viewer is intentionally simple, but its memory profile is dominated
by **DOM node count**, not JS heap. Each JSON value becomes ~7 DOM elements
(node, row, caret, key, chip, value wrapper, copy button), and KaTeX +
marked output add many more nested elements per rich string. On a file
with hundreds of records and long rich-text strings, the live page can
easily reach tens of MB of DOM.

What this means for new code:

- Per-row event handlers close over their `value` parameter. For object /
  array rows, that pins the entire subtree from GC. Prefer a single
  delegated handler at the tree root over thousands of per-row closures
  if you add new row-level interactions.
- Rendering rich text (KaTeX/marked) is the per-string hotspot. Don't
  re-render on every keystroke / scroll. The "raw" toggle currently keeps
  both DOM trees mounted at once — be aware before adding more such
  toggles.
- Pagination caps the *rendered* records but the full parsed JSON stays
  in JS heap regardless. Don't assume pagination is a memory ceiling.

Unfinished mitigation candidates (don't implement speculatively, but keep
in mind when something becomes a real problem):

- Lazy children build: collapsed nodes today still build their child DOM
  up front. Defer to first expansion to genuinely shrink the live tree.
- `IntersectionObserver`-driven KaTeX / marked rendering for off-screen
  rich strings.
- Delegated copy-as-JSON handler at the tree root with `data-path` lookup
  back into the original parsed data, so per-row closures stop pinning
  subtrees.

## Sample data

`samples/demo.json` and `samples/demo.jsonl` exercise the main features
(plain strings, Markdown, inline + display LaTeX, nesting, arrays). Use them
as the default smoke test. Add new samples when you implement features that
existing ones don't cover; don't bloat them otherwise.

## Plans

Non-trivial changes get a short note in `plans/<slug>.md` capturing context,
decisions, and verification steps. Treat existing plans as historical record
— don't rewrite them after the fact.

## Commit messages

- Subject line short and imperative ("Add X", "Convert to Y", "Fix Z").
- For non-trivial bodies (apostrophes, multiple paragraphs), write the
  message to a tempfile and use `git commit -F <file>` rather than `-m` with
  heredocs — the shell quoting is fragile.
