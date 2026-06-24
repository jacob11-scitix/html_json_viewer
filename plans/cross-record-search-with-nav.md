# Cross-record search with Next/Prev navigation

Background: previous search ran against the rendered DOM only, so on JSONL
input it silently ignored every record outside the current page. It also
force-expanded every ancestor and descendant of every hit, and clearing
the query left those nodes expanded — there was no record of what was
collapsed before the search started.

## What changed

- **Data-driven matching.** `js/search.js` is rewritten as a controller
  (`JV.search.create`) that walks the parsed JS values, not the DOM. Match
  rows are produced as path strings (same format as `data-path` on
  rendered nodes), so we can find them in the DOM whether they're on the
  current page or after a page switch. JSONL searches now span every
  record.
- **Collapse snapshot.** First non-empty keystroke captures every
  `.node`'s `collapsed` state into a `Map<data-path, bool>`. Clearing the
  query restores it. Records that paged in mid-search default to
  collapsed on restore so the post-clear view is tidy.
- **On-demand expansion.** The keystroke flow no longer expands anything
  — it only refreshes the match list and counter. Pressing Next/Prev (or
  Enter/Shift+Enter in the search box) collapses everything back to
  snapshot, then expands the ancestors of the *current* match, scrolls it
  into view, and highlights the matched text. Stepping again
  re-collapses the previous match's ancestors before expanding the new
  one.
- **Cross-page jump.** When the next match's `recordIndex` isn't on the
  current page, the controller calls
  `pagination.jumpToRecord(idx)`, which the pagination view (`js/pagination.js`)
  now exposes alongside `getPageRange()`. The pagination
  `onRender` hook re-runs `reveal` once the target record's DOM exists.

## Files

- `js/tree.js` — export `childPath` so `search.js` can produce paths
  identical to those baked into rendered `data-path` attributes.
- `js/pagination.js` — new return values `getPageRange`, `jumpToRecord`;
  `onRender(root)` is now used (it was already being called).
- `js/search.js` — full rewrite (`JV.search.create`).
- `js/app.js` — owns the controller lifecycle, wires Enter/Shift+Enter,
  Escape, click handlers on Next/Prev buttons, and an `onUpdate` callback
  that drives the toolbar counter.
- `index.html` — adds `#search-count`, `#search-prev`, `#search-next`.
- `css/styles.css` — counter overlay inside the search box; nav button
  states.

## Verification

- `node --check js/*.js` passes.
- Manual UI verification still TODO — load `samples/demo.jsonl`, type a
  term that appears on multiple records, confirm the counter increments
  across page boundaries, Next/Prev jump pages, and clearing the query
  collapses everything back to default.
