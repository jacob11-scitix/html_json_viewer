// Cross-record search with Next/Prev navigation.
// Searches the parsed data (not just the rendered DOM) so JSONL searches
// span every record, not just the current page. Match navigation expands
// only the current hit's ancestors on demand; clearing the query restores
// the collapse state the user had before they began typing.
//
// Exposes window.JV.search.create(opts) -> SearchController.

(function (JV) {
  const { typeOf, childPath } = JV.tree;
  const MARK_CLASS = 'match';

  function summaryText(value, type) {
    if (type === 'array') return `Array(${value.length})`;
    if (type === 'object') {
      const keys = Object.keys(value);
      const preview = keys.slice(0, 3).join(', ');
      return keys.length > 3
        ? `{ ${preview}, +${keys.length - 3} more }`
        : (keys.length ? `{ ${preview} }` : '{ }');
    }
    return '';
  }

  function rowMatches(value, type, keyLabel, qLower) {
    if (keyLabel != null && String(keyLabel).toLowerCase().includes(qLower)) return true;
    if (type === 'string') return value.toLowerCase().includes(qLower);
    if (type === 'number') return String(value).toLowerCase().includes(qLower);
    if (type === 'boolean') return String(value).includes(qLower);
    if (type === 'null') return 'null'.includes(qLower);
    if (type === 'object' || type === 'array') {
      return summaryText(value, type).toLowerCase().includes(qLower);
    }
    return false;
  }

  function walkValue(value, rootPath, keyLabel, qLower, out) {
    const type = typeOf(value);
    if (rowMatches(value, type, keyLabel, qLower)) out.push(rootPath);
    if (type === 'object') {
      for (const k of Object.keys(value)) {
        walkValue(value[k], childPath(rootPath, k, 'object'), k, qLower, out);
      }
    } else if (type === 'array') {
      for (let i = 0; i < value.length; i++) {
        walkValue(value[i], childPath(rootPath, i, 'array'), `[${i}]`, qLower, out);
      }
    }
  }

  function unmark(root) {
    root.querySelectorAll(`mark.${MARK_CLASS}`).forEach(m => {
      const p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
    });
  }

  function highlightTextNodes(root, qLower) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.toLowerCase().includes(qLower)) {
          return NodeFilter.FILTER_REJECT;
        }
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('.row-actions, .caret, .chip, .rich-toggle')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);
    for (const text of targets) {
      const value = text.nodeValue;
      const lc = value.toLowerCase();
      const frag = document.createDocumentFragment();
      let i = 0;
      while (i < value.length) {
        const idx = lc.indexOf(qLower, i);
        if (idx === -1) {
          frag.appendChild(document.createTextNode(value.slice(i)));
          break;
        }
        if (idx > i) frag.appendChild(document.createTextNode(value.slice(i, idx)));
        const mark = document.createElement('mark');
        mark.className = MARK_CLASS;
        mark.textContent = value.slice(idx, idx + qLower.length);
        frag.appendChild(mark);
        i = idx + qLower.length;
      }
      text.parentNode.replaceChild(frag, text);
    }
  }

  function cssAttrEscape(s) {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function setCollapsed(node, collapsed) {
    const caret = node.querySelector(':scope > .row > .caret');
    if (!caret || caret.classList.contains('leaf')) return;
    if (collapsed) {
      node.classList.add('collapsed');
      caret.classList.add('collapsed');
    } else {
      node.classList.remove('collapsed');
      caret.classList.remove('collapsed');
    }
  }

  function create(opts) {
    const container = opts.container;          // root DOM element (.tree or .records-view)
    const records = opts.records || null;      // array of records, or null for single JSON
    const singleData = opts.singleData;        // parsed JSON for single-tree mode
    const rootPath = opts.rootPath || 'root';  // tree-mode root path
    const pagination = opts.pagination || null;

    let snapshot = null;     // Map<data-path, wasCollapsed>
    let matches = [];        // [{ recordIndex, path }]
    let cursor = -1;
    let queryStr = '';
    let listeners = { onUpdate: opts.onUpdate || (() => {}) };

    function takeSnapshot() {
      if (snapshot) return;
      snapshot = new Map();
      container.querySelectorAll('.node').forEach(n => {
        if (n.dataset.path) snapshot.set(n.dataset.path, n.classList.contains('collapsed'));
      });
    }

    function applySnapshotToVisible() {
      container.querySelectorAll('.node').forEach(n => {
        const want = snapshot ? snapshot.get(n.dataset.path) : true;
        setCollapsed(n, want === undefined ? true : want);
      });
    }

    function restoreSnapshot() {
      if (!snapshot) return;
      container.querySelectorAll('.node').forEach(n => {
        const want = snapshot.get(n.dataset.path);
        // Records that paged in mid-search aren't in the snapshot — collapse
        // them by default so clearing the query leaves a tidy starting state.
        setCollapsed(n, want === undefined ? true : want);
      });
      snapshot = null;
    }

    function clearHighlights() {
      unmark(container);
      container.querySelectorAll('.node.search-hit').forEach(n => n.classList.remove('search-hit'));
    }

    function computeMatches(query) {
      const qLower = query.toLowerCase();
      matches = [];
      if (records) {
        for (let i = 0; i < records.length; i++) {
          const paths = [];
          walkValue(records[i], `[${i}]`, null, qLower, paths);
          for (const p of paths) matches.push({ recordIndex: i, path: p });
        }
      } else {
        const paths = [];
        walkValue(singleData, rootPath, null, qLower, paths);
        for (const p of paths) matches.push({ recordIndex: null, path: p });
      }
    }

    function findNodeByPath(pathStr) {
      const sel = `.node[data-path="${cssAttrEscape(pathStr)}"]`;
      return container.querySelector(sel);
    }

    function reveal(match) {
      clearHighlights();
      applySnapshotToVisible();

      if (records && pagination) {
        const range = pagination.getPageRange();
        if (match.recordIndex < range.start || match.recordIndex >= range.end) {
          pagination.jumpToRecord(match.recordIndex);
          // pagination.render() fires onRender -> onPageRendered, which calls
          // reveal() again now that the target record is in the DOM.
          return;
        }
      }

      const node = findNodeByPath(match.path);
      if (!node) return;

      let p = node.parentElement;
      while (p && p !== container) {
        if (p.classList && p.classList.contains('node')) setCollapsed(p, false);
        p = p.parentElement;
      }
      node.classList.add('search-hit');
      const row = node.querySelector(':scope > .row');
      if (row) highlightTextNodes(row, queryStr.toLowerCase());

      // scrollIntoView with smooth can fight with the user typing; use auto.
      try { node.scrollIntoView({ block: 'center' }); } catch (_) {}
    }

    function goTo(idx) {
      if (matches.length === 0) {
        cursor = -1;
        clearHighlights();
        applySnapshotToVisible();
        listeners.onUpdate(state());
        return;
      }
      const n = matches.length;
      cursor = ((idx % n) + n) % n;
      reveal(matches[cursor]);
      listeners.onUpdate(state());
    }

    function setQuery(query) {
      const trimmed = query.trim();
      queryStr = trimmed;
      if (!trimmed) {
        clearHighlights();
        restoreSnapshot();
        matches = [];
        cursor = -1;
        listeners.onUpdate(state());
        return;
      }
      takeSnapshot();
      computeMatches(trimmed);
      cursor = -1;
      clearHighlights();
      applySnapshotToVisible();
      listeners.onUpdate(state());
    }

    function next() { if (matches.length) goTo(cursor + 1); }
    function prev() { if (matches.length) goTo(cursor - 1); }

    function onPageRendered() {
      if (!queryStr) return;
      if (cursor < 0) return;
      const m = matches[cursor];
      if (!m) return;
      reveal(m);
    }

    function state() {
      return {
        query: queryStr,
        total: matches.length,
        cursor,
        hasMatches: matches.length > 0,
      };
    }

    return { setQuery, next, prev, onPageRendered, state };
  }

  JV.search = { create };
})(window.JV = window.JV || {});
