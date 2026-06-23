// Pagination for JSONL records.
// Renders a toolbar (page-size, prev/next, jump-to-page) and the current page
// of records.  Each record is rendered as a card containing a tree.

import { renderTree } from './tree.js';

const PAGE_SIZES = [10, 20, 50, 100, 'All'];

export function renderRecordsView(records, opts = {}) {
  const root = document.createElement('div');
  root.className = 'records-view';

  const state = {
    pageSize: 20,
    page: 1,
  };

  const toolbar = document.createElement('div');
  toolbar.className = 'pagination';

  const sizeLabel = document.createElement('span');
  sizeLabel.className = 'muted';
  sizeLabel.textContent = 'Per page:';
  toolbar.appendChild(sizeLabel);

  const sizeSel = document.createElement('select');
  for (const s of PAGE_SIZES) {
    const o = document.createElement('option');
    o.value = String(s);
    o.textContent = String(s);
    if (s === state.pageSize) o.selected = true;
    sizeSel.appendChild(o);
  }
  toolbar.appendChild(sizeSel);

  const total = document.createElement('span');
  total.className = 'muted';
  total.textContent = `${records.length} record${records.length === 1 ? '' : 's'}`;
  toolbar.appendChild(total);

  toolbar.appendChild(spacerEl());

  const prev = btn('‹ Prev');
  const next = btn('Next ›');
  const pageInfo = document.createElement('span');
  pageInfo.className = 'muted';
  const jumpLabel = document.createElement('span');
  jumpLabel.className = 'muted';
  jumpLabel.textContent = 'Go to';
  const jump = document.createElement('input');
  jump.type = 'number';
  jump.min = '1';
  jump.step = '1';

  toolbar.appendChild(prev);
  toolbar.appendChild(pageInfo);
  toolbar.appendChild(next);
  toolbar.appendChild(jumpLabel);
  toolbar.appendChild(jump);

  const list = document.createElement('div');
  list.className = 'records';

  root.appendChild(toolbar);
  root.appendChild(list);

  function pagesTotal() {
    if (state.pageSize === 'All') return 1;
    return Math.max(1, Math.ceil(records.length / state.pageSize));
  }

  function pageSlice() {
    if (state.pageSize === 'All') return records.map((r, i) => [i, r]);
    const start = (state.page - 1) * state.pageSize;
    const end = Math.min(records.length, start + state.pageSize);
    const out = [];
    for (let i = start; i < end; i++) out.push([i, records[i]]);
    return out;
  }

  function render() {
    list.innerHTML = '';
    for (const [idx, rec] of pageSlice()) {
      const card = document.createElement('div');
      card.className = 'record-card';
      const head = document.createElement('div');
      head.className = 'record-header';
      const ix = document.createElement('span');
      ix.className = 'record-index';
      ix.textContent = `#${idx}`;
      const meta = document.createElement('span');
      meta.textContent = '';
      head.appendChild(ix);
      head.appendChild(meta);
      const body = document.createElement('div');
      body.className = 'record-body';
      body.appendChild(renderTree(rec, `[${idx}]`));
      card.appendChild(head);
      card.appendChild(body);
      list.appendChild(card);
    }
    const pTotal = pagesTotal();
    pageInfo.textContent = `Page ${state.page} / ${pTotal}`;
    prev.disabled = state.page <= 1;
    next.disabled = state.page >= pTotal;
    jump.max = String(pTotal);
    jump.value = String(state.page);
    if (typeof opts.onRender === 'function') opts.onRender(root);
  }

  sizeSel.addEventListener('change', () => {
    const v = sizeSel.value;
    state.pageSize = v === 'All' ? 'All' : parseInt(v, 10);
    state.page = 1;
    render();
  });
  prev.addEventListener('click', () => {
    if (state.page > 1) { state.page--; render(); }
  });
  next.addEventListener('click', () => {
    if (state.page < pagesTotal()) { state.page++; render(); }
  });
  jump.addEventListener('change', () => {
    let v = parseInt(jump.value, 10);
    if (!isFinite(v)) return;
    v = Math.max(1, Math.min(pagesTotal(), v));
    state.page = v;
    render();
  });

  render();

  return { element: root, refresh: render };
}

function btn(label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  b.textContent = label;
  return b;
}

function spacerEl() {
  const s = document.createElement('span');
  s.className = 'spacer';
  return s;
}
