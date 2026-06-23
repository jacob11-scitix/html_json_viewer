// Markdown + LaTeX auto-detection and rendering.
// Exposes window.JV.richtext.{ detect, renderRich }.

(function (JV) {
  const LATEX_RE = /(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\\\([\s\S]+?\\\))|(\$(?!\s)(?:[^$\\\n]|\\.)+?(?<!\s)\$)|(\\begin\{[a-zA-Z*]+\}[\s\S]+?\\end\{[a-zA-Z*]+\})/g;

  const MD_HINTS = [
    /(^|\n)#{1,6} \S/,
    /(^|\n)\s*[-*+] \S/,
    /(^|\n)\s*\d+\.\s+\S/,
    /\*\*[^*\n]+\*\*/,
    /(^|[^*])\*[^*\s][^*\n]*[^*\s]\*([^*]|$)/,
    /(^|[^_])_[^_\s][^_\n]*[^_\s]_([^_]|$)/,
    /`[^`\n]+`/,
    /```[\s\S]+?```/,
    /\[[^\]\n]+\]\([^)\n]+\)/,
    /(^|\n)> \S/,
    /(^|\n)\|.+\|.*\n\|[\s\-:|]+\|/,
    /(^|\n)---+\s*(\n|$)/,
  ];

  function detect(str) {
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
      } else {
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

  function renderRich(text) {
    if (typeof marked === 'undefined') return escapeHtml(text);
    const { replaced, segments } = extractMath(text);
    let html;
    try {
      html = marked.parse(replaced, { breaks: true, gfm: true });
    } catch (_) {
      html = `<p>${escapeHtml(replaced)}</p>`;
    }
    return renderMathSegments(html, segments);
  }

  JV.richtext = { detect, renderRich };
})(window.JV = window.JV || {});
