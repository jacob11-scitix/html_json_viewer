# html_json_viewer

A lightweight, single-page JSON / JSONL viewer that renders Markdown and LaTeX
locally. No build step, no network at runtime — drop a file, get a navigable
tree with rich-text and math rendered in place.

## Features

- **JSON and JSONL** — pasted text or files (drag-and-drop / file picker / paste panel).
- **Collapsible tree** with type chips, JSON path on hover, per-node "copy as JSON".
- **Markdown + LaTeX auto-detection** on every string value, with a per-cell raw/rich toggle.
- **Search** across keys and values, with match highlighting.
- **Pagination** for JSONL (page size 10 / 20 / 50 / 100 / All, default 20).
- **Dark theme by default**, light theme toggle, preference persisted.
- **Fully offline** — `marked` and `KaTeX` are vendored in `vendor/`.

## Running it

ES modules require an HTTP origin in most browsers, so serve the directory:

```bash
python3 -m http.server 8765
# then open http://127.0.0.1:8765/
```

Any static server works — `npx serve`, `caddy file-server`, etc.

## Repo layout

```
index.html
css/styles.css
js/  app.js  parser.js  tree.js  search.js  pagination.js  richtext.js
vendor/  marked.min.js  katex.min.js  katex.min.css  katex-fonts/*.woff2
samples/  demo.json  demo.jsonl
```

## License

MIT — see `LICENSE`.
