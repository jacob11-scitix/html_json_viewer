// JSON vs JSONL detection + parsing.
// Exposes window.JV.parser.parse(text).
// Returns { kind: 'json' | 'jsonl', data | records } on success
// or { kind: 'error', message, line?, column? }.

(function (JV) {
  // Python's json.dump emits NaN / Infinity / -Infinity by default. The
  // JSON spec forbids them and JSON.parse rejects them. Strip them only
  // outside string literals so we don't corrupt user text that happens to
  // contain the word "NaN".
  function stripNonStandardNumbers(text) {
    let out = '';
    let i = 0;
    const n = text.length;
    const isIdent = (c) => c && /[A-Za-z0-9_]/.test(c);
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        let j = i + 1;
        while (j < n) {
          if (text[j] === '\\') { j += 2; continue; }
          if (text[j] === '"') { j++; break; }
          j++;
        }
        out += text.slice(i, j);
        i = j;
        continue;
      }
      if (c === 'N' && text.substr(i, 3) === 'NaN' && !isIdent(text[i + 3])) {
        out += 'null'; i += 3; continue;
      }
      if (c === 'I' && text.substr(i, 8) === 'Infinity' && !isIdent(text[i + 8])) {
        out += 'null'; i += 8; continue;
      }
      if (c === '-' && text.substr(i, 9) === '-Infinity' && !isIdent(text[i + 9])) {
        out += 'null'; i += 9; continue;
      }
      out += c; i++;
    }
    return out;
  }

  function tryParse(text) {
    try { return { ok: true, data: JSON.parse(text) }; }
    catch (e) { return { ok: false, error: e }; }
  }

  function parse(text) {
    const trimmed = text.trim();
    if (!trimmed) return { kind: 'error', message: 'Empty input.' };

    let attempt = tryParse(trimmed);
    if (attempt.ok) return { kind: 'json', data: attempt.data };

    // Retry with NaN / Infinity / -Infinity replaced by null.
    const sanitized = stripNonStandardNumbers(trimmed);
    if (sanitized !== trimmed) {
      const retry = tryParse(sanitized);
      if (retry.ok) {
        return {
          kind: 'json',
          data: retry.data,
          warning: 'Non-standard tokens (NaN / Infinity) were replaced with null.',
        };
      }
    }

    const lines = text.split(/\r?\n/);
    const records = [];
    const failures = [];
    let nonEmpty = 0;

    let sanitizedLines = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      nonEmpty++;
      const r = tryParse(line);
      if (r.ok) {
        records.push(r.data);
        continue;
      }
      const cleaned = stripNonStandardNumbers(line);
      if (cleaned !== line) {
        const r2 = tryParse(cleaned);
        if (r2.ok) {
          records.push(r2.data);
          sanitizedLines++;
          continue;
        }
      }
      failures.push({ lineNumber: i + 1, snippet: line.slice(0, 80), error: r.error.message });
    }

    if (nonEmpty > 0 && failures.length === 0) {
      const warn = sanitizedLines
        ? `Non-standard tokens (NaN / Infinity) in ${sanitizedLines} line${sanitizedLines === 1 ? '' : 's'} were replaced with null.`
        : undefined;
      if (records.length === 1) {
        return warn
          ? { kind: 'json', data: records[0], warning: warn }
          : { kind: 'json', data: records[0] };
      }
      return warn
        ? { kind: 'jsonl', records, warning: warn }
        : { kind: 'jsonl', records };
    }

    if (nonEmpty > 0 && failures.length / nonEmpty < 0.1 && records.length > 1) {
      return {
        kind: 'jsonl',
        records,
        warning: `Skipped ${failures.length} unparseable line${failures.length === 1 ? '' : 's'}.`,
      };
    }

    let message = 'Could not parse as JSON or JSONL.';
    try { JSON.parse(trimmed); } catch (e) { message = e.message; }
    return { kind: 'error', message, failures };
  }

  JV.parser = { parse };
})(window.JV = window.JV || {});
