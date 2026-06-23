// Application entry point.  Wires input sources (file picker, drag-and-drop,
// paste panel) to the parser, then renders into the viewer pane.  Hosts theme
// toggle, search, expand/collapse and status-bar updates.

import { parse } from './parser.js';
import { renderTree, setAllExpanded } from './tree.js';
import { renderRecordsView } from './pagination.js';
import { applySearch } from './search.js';

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
  expandAll:     document.getElementById('expand-all'),
  collapseAll:   document.getElementById('collapse-all'),
  themeToggle:   document.getElementById('theme-toggle'),
  dropOverlay:   document.getElementById('drop-overlay'),
  statusPath:    document.getElementById('status-path'),
  statusInfo:    document.getElementById('status-info'),
};

// ---- Theme ----
const THEME_KEY = 'json-viewer-theme';
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
}
const savedTheme = localStorage.getItem(THEME_KEY);
applyTheme(savedTheme === 'light' ? 'light' : 'dark');
els.themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = cur === 'light' ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

// ---- Paste panel ----
els.pasteToggle.addEventListener('click', () => {
  els.pastePanel.hidden = !els.pastePanel.hidden;
  if (!els.pastePanel.hidden) els.pasteArea.focus();
});
els.pasteRender.addEventListener('click', () => {
  const text = els.pasteArea.value;
  if (text.trim()) loadText(text, 'pasted');
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
  reader.onload = () => loadText(String(reader.result), file.name);
  reader.onerror = () => showError(`Could not read file: ${reader.error?.message || 'unknown error'}`);
  reader.readAsText(file);
}

// ---- Search / expand / collapse ----
let searchTimer = null;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const root = currentTreeRoot();
    if (root) applySearch(root, els.search.value);
  }, 120);
});

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

// ---- Status bar (path on hover) ----
els.viewer.addEventListener('mouseover', (e) => {
  const node = e.target.closest('.node');
  if (node && node.dataset.path) {
    els.statusPath.textContent = node.dataset.path;
  }
});
els.viewer.addEventListener('focusin', (e) => {
  const node = e.target.closest('.node');
  if (node && node.dataset.path) {
    els.statusPath.textContent = node.dataset.path;
  }
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

  if (result.kind === 'json') {
    const tree = renderTree(result.data, 'root');
    els.viewer.appendChild(tree);
    els.statusInfo.textContent = `${source} · JSON`;
  } else {
    const view = renderRecordsView(result.records);
    els.viewer.appendChild(view.element);
    const warn = result.warning ? ` · ${result.warning}` : '';
    els.statusInfo.textContent = `${source} · JSONL · ${result.records.length} records${warn}`;
  }

  // Re-apply current search query, if any.
  if (els.search.value.trim()) {
    const root = currentTreeRoot();
    if (root) applySearch(root, els.search.value);
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
