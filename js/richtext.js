// Markdown + LaTeX auto-detection and rendering.
// Pipeline (when math is present):
//   1. Extract math segments and replace with placeholder tokens.
//   2. Run remaining text through marked.
//   3. Substitute placeholders with KaTeX-rendered HTML.
// Library globals are loaded via vendor/<...>.js in index.html.

const LATEX_RE = /(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\\\([\s\S]+?\\\))|(\$(?!\s)(?:[^$\\\n]|\\.)+?(?<!\s)\$)|(\\begin\{[a-zA-Z*]+\}[\s\S]+?\\end\{[a-zA-Z*]+\})/g;

const MD_HINTS = [
  /(^|\n)#{1,6} \S/,             // headings
  /(^|\n)\s*[-*+] \S/,           // bullet list
  /(^|\n)\s*\d+\.\s+\S/,         // ordered list
  /\*\*[^*\n]+\*\*/,             // bold
  /(^|[^*])\*[^*\s][^*\n]*[^*\s]\*([^*]|$)/, // italic
  /(^|[^_])_[^_\s][^_\n]*[^_\s]_([^_]|$)/,   // italic underscore
  /`[^`\n]+`/,                   // inline code
  /```[\s\S]+?```/,              // fenced code
  /\[[^\]\n]+\]\([^)\n]+\)/,     // link
  /(^|\n)> \S/,                  // blockquote
  /(^|\n)\|.+\|.*\n\|[\s\-:|]+\|/, // table
  /(^|\n)---+\s*(\n|$)/,         // hr
];

export function detect(str) {
  if (typeof str !== 'string' || str.length < 2) return { rich: false };
  const hasMath = LATEX_RE.test(str);
  LATEX_RE.lastIndex = 0;
  const hasMarkdown = MD_HINTS.some(re => re.test(str));
  return { rich: hasMath || hasMarkdown, hasMath, hasMarkdown };
}

function extractMath(text) {
  const segments = [];
  let i = 0;
  const replaced = text.replace(LATEX_RE, (m) => {
    let raw = m;
    let display = false;
    let inner;
    if (raw.startsWith('$$') && raw.endsWith('$$')) {
      display = true;
      inner = raw.slice(2, -2);
    } else if (raw.startsWith('\\[')) {
      display = true;
      inner = raw.slice(2, -2);
    } else if (raw.startsWith('\\(')) {
      inner = raw.slice(2, -2);
    } else if (raw.startsWith('\\begin')) {
      display = true;
      inner = raw;
    } else { // $...$
      inner = raw.slice(1, -1);
    }
    const token = `@@KATEX_PLACEHOLDER_${i++}@@`;
    segments.push({ token, inner, display });
    return token;
  });
  return { replaced, segments };
}

function renderMathSegments(html, segments) {
  if (!segments.length) return html;
  if (typeof katex === 'undefined') return html;
  for (const { token, inner, display } of segments) {
    let rendered;
    try {
      rendered = katex.renderToString(inner, {
        throwOnError: false,
        displayMode: display,
        output: 'html',
        strict: 'ignore',
      });
    } catch (e) {
      rendered = `<code class="katex-error" title="${escapeAttr(e.message)}">${escapeHtml(inner)}</code>`;
    }
    // Token could appear inside a <p>...</p> wrapper added by marked — that's
    // fine for inline math. For display math, marked may have wrapped it in
    // <p>; KaTeX block display still renders correctly because it uses
    // display:inline-block-ish layout.
    html = html.split(token).join(rendered);
  }
  return html;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(String(s)); }

export function renderRich(text) {
  if (typeof marked === 'undefined') {
    // marked not loaded yet — fall back to plain text.
    return escapeHtml(text);
  }
  const { replaced, segments } = extractMath(text);
  let html;
  try {
    html = marked.parse(replaced, { breaks: true, gfm: true });
  } catch (e) {
    html = `<p>${escapeHtml(replaced)}</p>`;
  }
  return renderMathSegments(html, segments);
}
