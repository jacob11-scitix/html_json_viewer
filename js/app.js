// Application entry point.

(function (JV) {
  const { parse } = JV.parser;
  const { renderTree, setAllExpanded } = JV.tree;
  const { renderRecordsView } = JV.pagination;

  const els = {
    viewer:        document.getElementById('viewer'),
    empty:         document.getElementById('empty-state'),
    fileInput:     document.getElementById('file-input'),
    pasteToggle:   document.getElementById('paste-toggle'),
    pastePanel:    document.getElementById('paste-panel'),
    pasteArea:     document.getElementById('paste-area'),
    pasteRender:   document.getElementById('paste-render'),
    pasteClear:    document.getElementById('paste-clear'),
    search:        document.getElementById('search'),
    searchCount:   document.getElementById('search-count'),
    searchPrev:    document.getElementById('search-prev'),
    searchNext:    document.getElementById('search-next'),
    expandAll:     document.getElementById('expand-all'),
    collapseAll:   document.getElementById('collapse-all'),
    reload:        document.getElementById('reload'),
    themeToggle:   document.getElementById('theme-toggle'),
    dropOverlay:   document.getElementById('drop-overlay'),
    statusPath:    document.getElementById('status-path'),
    statusInfo:    document.getElementById('status-info'),
  };

  let currentSearch = null;
  // Last loaded source — used by the reload button. For files we keep the
  // File handle; FileReader re-reads the current bytes from disk on each
  // call, so a reload picks up edits made outside the page.
  let lastLoaded = null;  // { kind: 'file', file } | { kind: 'paste' }

  // ---- Theme ----
  const THEME_KEY = 'json-viewer-theme';
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }
  let savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (_) { /* file:// blocks storage in some browsers */ }
  applyTheme(savedTheme === 'light' ? 'light' : 'dark');
  els.themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  });

  // ---- Paste panel ----
  els.pasteToggle.addEventListener('click', () => {
    els.pastePanel.hidden = !els.pastePanel.hidden;
    if (!els.pastePanel.hidden) els.pasteArea.focus();
  });
  els.pasteRender.addEventListener('click', () => {
    const text = els.pasteArea.value;
    if (text.trim()) {
      lastLoaded = { kind: 'paste' };
      updateReloadButton();
      loadText(text, 'pasted');
    }
  });
  els.pasteClear.addEventListener('click', () => {
    els.pasteArea.value = '';
    els.pasteArea.focus();
  });

  // ---- File input ----
  els.fileInput.addEventListener('change', () => {
    const f = els.fileInput.files && els.fileInput.files[0];
    if (f) readFile(f);
    els.fileInput.value = '';
  });

  // ---- Drag & drop ----
  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounter++;
    els.dropOverlay.hidden = false;
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) els.dropOverlay.hidden = true;
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounter = 0;
    els.dropOverlay.hidden = true;
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f);
  });
  function hasFiles(e) {
    return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      lastLoaded = { kind: 'file', file };
      updateReloadButton();
      loadText(String(reader.result), file.name);
    };
    reader.onerror = () => showError(`Could not read file: ${reader.error && reader.error.message || 'unknown error'}`);
    reader.readAsText(file);
  }

  function updateReloadButton() {
    els.reload.disabled = !lastLoaded;
  }

  els.reload.addEventListener('click', () => {
    if (!lastLoaded) return;
    // Reset to the default initial view: clear the search and let
    // renderResult rebuild with all nodes collapsed and pagination on
    // page 1. Read the file fresh so on-disk edits show up.
    els.search.value = '';
    if (lastLoaded.kind === 'file') {
      readFile(lastLoaded.file);
    } else if (lastLoaded.kind === 'paste') {
      const text = els.pasteArea.value;
      if (text.trim()) loadText(text, 'pasted');
    }
  });

  // ---- Search / expand / collapse ----
  let searchTimer = null;
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (currentSearch) currentSearch.setQuery(els.search.value);
    }, 120);
  });
  els.search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!currentSearch) return;
      // Flush any pending debounced query so Enter feels immediate.
      clearTimeout(searchTimer);
      if (currentSearch.state().query !== els.search.value.trim()) {
        currentSearch.setQuery(els.search.value);
      }
      if (e.shiftKey) currentSearch.prev();
      else currentSearch.next();
    } else if (e.key === 'Escape' && els.search.value) {
      els.search.value = '';
      if (currentSearch) currentSearch.setQuery('');
    }
  });
  els.searchPrev.addEventListener('click', () => { if (currentSearch) currentSearch.prev(); });
  els.searchNext.addEventListener('click', () => { if (currentSearch) currentSearch.next(); });

  function updateSearchUI(state) {
    const has = state.query.length > 0;
    els.searchCount.hidden = !has;
    els.searchPrev.hidden = !has;
    els.searchNext.hidden = !has;
    if (!has) return;
    if (state.total === 0) {
      els.searchCount.textContent = '0/0';
      els.searchCount.classList.add('no-matches');
    } else {
      const cur = state.cursor >= 0 ? state.cursor + 1 : 0;
      els.searchCount.textContent = `${cur}/${state.total}`;
      els.searchCount.classList.remove('no-matches');
    }
    els.searchPrev.disabled = state.total === 0;
    els.searchNext.disabled = state.total === 0;
  }

  els.expandAll.addEventListener('click', () => {
    const root = currentTreeRoot();
    if (root) setAllExpanded(root, true);
  });
  els.collapseAll.addEventListener('click', () => {
    const root = currentTreeRoot();
    if (root) setAllExpanded(root, false);
  });

  function currentTreeRoot() {
    return els.viewer.querySelector('.tree, .records-view');
  }

  // ---- Status bar ----
  els.viewer.addEventListener('mouseover', (e) => {
    const node = e.target.closest('.node');
    if (node && node.dataset.path) els.statusPath.textContent = node.dataset.path;
  });
  els.viewer.addEventListener('focusin', (e) => {
    const node = e.target.closest('.node');
    if (node && node.dataset.path) els.statusPath.textContent = node.dataset.path;
  });

  // ---- Main load pipeline ----
  function loadText(text, source) {
    const result = parse(text);
    if (result.kind === 'error') {
      showError(`Parse error in ${source}: ${result.message}`);
      return;
    }
    renderResult(result, source);
  }

  function renderResult(result, source) {
    els.empty.hidden = true;
    els.viewer.innerHTML = '';
    currentSearch = null;

    if (result.kind === 'json') {
      const tree = renderTree(result.data, 'root');
      els.viewer.appendChild(tree);
      const warn = result.warning ? ` · ${result.warning}` : '';
      els.statusInfo.textContent = `${source} · JSON${warn}`;
      currentSearch = JV.search.create({
        container: tree,
        singleData: result.data,
        rootPath: 'root',
        onUpdate: updateSearchUI,
      });
    } else {
      const view = renderRecordsView(result.records, {
        onRender: () => { if (currentSearch) currentSearch.onPageRendered(); },
      });
      els.viewer.appendChild(view.element);
      const warn = result.warning ? ` · ${result.warning}` : '';
      els.statusInfo.textContent = `${source} · JSONL · ${result.records.length} records${warn}`;
      currentSearch = JV.search.create({
        container: view.element,
        records: result.records,
        pagination: view,
        onUpdate: updateSearchUI,
      });
    }

    if (els.search.value.trim()) {
      currentSearch.setQuery(els.search.value);
    } else {
      updateSearchUI(currentSearch.state());
    }
  }

  function showError(message) {
    els.empty.hidden = true;
    els.viewer.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'parse-error';
    box.textContent = message;
    els.viewer.appendChild(box);
    els.statusInfo.textContent = 'parse error';
  }
})(window.JV = window.JV || {});
