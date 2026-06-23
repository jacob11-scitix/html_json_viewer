// Recursive tree renderer for arbitrary JSON values.
// Exposes:
//   renderTree(value, path)  -> HTMLElement
//   typeOf(value)            -> 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'
//   stringify(value)         -> JSON string with 2-space indent

import { detect, renderRich } from './richtext.js';

export function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

export function stringify(v) {
  return JSON.stringify(v, null, 2);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function summary(value, type) {
  if (type === 'array') {
    const n = value.length;
    return `Array(${n})`;
  }
  if (type === 'object') {
    const keys = Object.keys(value);
    const preview = keys.slice(0, 3).join(', ');
    return keys.length > 3
      ? `{ ${preview}, +${keys.length - 3} more }`
      : (keys.length ? `{ ${preview} }` : '{ }');
  }
  return '';
}

function makeChip(type) {
  const chip = document.createElement('span');
  chip.className = `chip chip-${type}`;
  chip.textContent = type;
  return chip;
}

function renderPrimitive(value, type) {
  const span = document.createElement('span');
  span.className = `v ${type}`;
  if (type === 'string') {
    // Default raw rendering; rich-text is applied separately by buildStringNode.
    span.textContent = `"${value}"`;
  } else if (type === 'null') {
    span.textContent = 'null';
  } else {
    span.textContent = String(value);
  }
  return span;
}

function buildStringNode(value) {
  const info = detect(value);
  const wrap = document.createElement('span');
  wrap.className = 'v string rich-wrap';

  if (!info.rich) {
    // Plain string — show quoted, preserve newlines via pre-wrap.
    const inner = document.createElement('span');
    inner.className = 'raw-text';
    inner.append(quoteText(value));
    wrap.appendChild(inner);
    return wrap;
  }

  // Render rich + raw toggle.
  const rich = document.createElement('div');
  rich.className = 'rich';
  rich.innerHTML = renderRich(value);

  const raw = document.createElement('span');
  raw.className = 'raw-text';
  raw.hidden = true;
  raw.append(quoteText(value));

  const toggle = document.createElement('button');
  toggle.className = 'rich-toggle';
  toggle.type = 'button';
  toggle.textContent = 'raw';
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const showingRich = !raw.hidden ? false : true; // current = rich (raw hidden)
    if (showingRich) {
      rich.hidden = true;
      raw.hidden = false;
      toggle.textContent = 'rich';
    } else {
      rich.hidden = false;
      raw.hidden = true;
      toggle.textContent = 'raw';
    }
  });

  wrap.appendChild(rich);
  wrap.appendChild(raw);
  wrap.appendChild(toggle);
  return wrap;
}

function quoteText(value) {
  // Returns DocumentFragment with grey quotes around the string body.
  const frag = document.createDocumentFragment();
  const lq = document.createElement('span'); lq.className = 'quote'; lq.textContent = '"';
  const body = document.createElement('span'); body.textContent = value;
  const rq = document.createElement('span'); rq.className = 'quote'; rq.textContent = '"';
  frag.appendChild(lq); frag.appendChild(body); frag.appendChild(rq);
  return frag;
}

function makeCopyButton(value) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'copy';
  btn.title = 'Copy as JSON';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(stringify(value));
      const orig = btn.textContent;
      btn.textContent = 'copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1200);
    } catch {
      btn.textContent = 'failed';
      setTimeout(() => { btn.textContent = 'copy'; }, 1200);
    }
  });
  return btn;
}

function childPath(parentPath, key, parentType) {
  if (parentType === 'array') return `${parentPath}[${key}]`;
  // Key as bracket if it's not a valid identifier
  if (/^[A-Za-z_$][\w$]*$/.test(key)) return parentPath ? `${parentPath}.${key}` : key;
  return `${parentPath}[${JSON.stringify(key)}]`;
}

/**
 * Build a node element.
 * @param {*} value     The JSON value at this node.
 * @param {string|null} keyLabel  The key/index label to display, or null for the root.
 * @param {string} path Full path string (data-path on the element).
 */
function buildNode(value, keyLabel, path) {
  const type = typeOf(value);
  const node = document.createElement('div');
  node.className = 'node';
  node.dataset.path = path;
  node.dataset.type = type;

  const row = document.createElement('div');
  row.className = 'row';
  row.tabIndex = 0;

  const caret = document.createElement('span');
  caret.className = 'caret';
  const hasChildren = (type === 'object' && Object.keys(value).length > 0)
                  || (type === 'array' && value.length > 0);
  if (hasChildren) {
    caret.textContent = '▾';
    caret.addEventListener('click', (e) => {
      e.stopPropagation();
      node.classList.toggle('collapsed');
      caret.classList.toggle('collapsed');
    });
  } else {
    caret.classList.add('leaf');
    caret.textContent = '·';
  }
  row.appendChild(caret);

  if (keyLabel !== null) {
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = keyLabel;
    row.appendChild(k);
  }

  row.appendChild(makeChip(type));

  if (type === 'object' || type === 'array') {
    const sum = document.createElement('span');
    sum.className = 'summary';
    sum.textContent = summary(value, type);
    row.appendChild(sum);
  } else if (type === 'string') {
    row.appendChild(buildStringNode(value));
  } else {
    row.appendChild(renderPrimitive(value, type));
  }

  // Row actions
  const actions = document.createElement('span');
  actions.className = 'row-actions';
  actions.appendChild(makeCopyButton(value));
  row.appendChild(actions);

  node.appendChild(row);

  if (hasChildren) {
    const children = document.createElement('div');
    children.className = 'children';
    if (type === 'array') {
      value.forEach((item, i) => {
        children.appendChild(buildNode(item, `[${i}]`, childPath(path, i, 'array')));
      });
    } else {
      for (const k of Object.keys(value)) {
        children.appendChild(buildNode(value[k], k, childPath(path, k, 'object')));
      }
    }
    node.appendChild(children);
  }

  return node;
}

export function renderTree(value, rootPath = 'root') {
  const wrap = document.createElement('div');
  wrap.className = 'tree';
  wrap.appendChild(buildNode(value, null, rootPath));
  return wrap;
}

/** Expand or collapse every node inside a container. */
export function setAllExpanded(container, expanded) {
  container.querySelectorAll('.node').forEach(n => {
    const caret = n.querySelector(':scope > .row > .caret');
    if (!caret || caret.classList.contains('leaf')) return;
    if (expanded) {
      n.classList.remove('collapsed');
      caret.classList.remove('collapsed');
    } else {
      n.classList.add('collapsed');
      caret.classList.add('collapsed');
    }
  });
}
