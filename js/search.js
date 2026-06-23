// Live search/filter for a tree container.
// Exposes window.JV.search.applySearch(container, query).

(function (JV) {
  const MARK_CLASS = 'match';

  function unmark(container) {
    container.querySelectorAll(`mark.${MARK_CLASS}`).forEach(m => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
    });
  }

  function clearFilter(container) {
    container.querySelectorAll('.node.search-hidden').forEach(n => n.classList.remove('search-hidden'));
    container.querySelectorAll('.node.search-hit').forEach(n => n.classList.remove('search-hit'));
    unmark(container);
  }

  function highlightTextNodes(root, query) {
    const lower = query.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.toLowerCase().includes(lower)) {
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
        const idx = lc.indexOf(lower, i);
        if (idx === -1) {
          frag.appendChild(document.createTextNode(value.slice(i)));
          break;
        }
        if (idx > i) frag.appendChild(document.createTextNode(value.slice(i, idx)));
        const mark = document.createElement('mark');
        mark.className = MARK_CLASS;
        mark.textContent = value.slice(idx, idx + lower.length);
        frag.appendChild(mark);
        i = idx + lower.length;
      }
      text.parentNode.replaceChild(frag, text);
    }
  }

  function matchesRow(row, query) {
    const q = query.toLowerCase();
    const k = row.querySelector(':scope > .k');
    if (k && k.textContent.toLowerCase().includes(q)) return true;
    const v = row.querySelector(':scope > .v');
    if (v && v.textContent.toLowerCase().includes(q)) return true;
    const sum = row.querySelector(':scope > .summary');
    if (sum && sum.textContent.toLowerCase().includes(q)) return true;
    return false;
  }

  function applySearch(container, query) {
    clearFilter(container);
    const q = query.trim();
    if (!q) return;

    const nodes = container.querySelectorAll('.node');
    const hits = new Set();
    for (const n of nodes) {
      const row = n.querySelector(':scope > .row');
      if (row && matchesRow(row, q)) hits.add(n);
    }

    if (hits.size === 0) {
      for (const n of nodes) n.classList.add('search-hidden');
      return;
    }

    const visible = new Set();
    for (const hit of hits) {
      hit.classList.add('search-hit');
      visible.add(hit);
      let p = hit.parentElement;
      while (p && p !== container) {
        if (p.classList && p.classList.contains('node')) visible.add(p);
        p = p.parentElement;
      }
      hit.querySelectorAll('.node').forEach(d => visible.add(d));
    }

    for (const n of nodes) {
      if (!visible.has(n)) {
        n.classList.add('search-hidden');
      } else {
        const caret = n.querySelector(':scope > .row > .caret');
        if (caret && !caret.classList.contains('leaf')) {
          n.classList.remove('collapsed');
          caret.classList.remove('collapsed');
        }
      }
    }

    for (const hit of hits) {
      const row = hit.querySelector(':scope > .row');
      if (row) highlightTextNodes(row, q);
    }
  }

  JV.search = { applySearch };
})(window.JV = window.JV || {});
