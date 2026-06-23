// JSON vs JSONL detection + parsing.
// Exposes window.JV.parser.parse(text).
// Returns { kind: 'json' | 'jsonl', data | records } on success
// or { kind: 'error', message, line?, column? }.

(function (JV) {
  function parse(text) {
    const trimmed = text.trim();
    if (!trimmed) return { kind: 'error', message: 'Empty input.' };

    try {
      const data = JSON.parse(trimmed);
      return { kind: 'json', data };
    } catch (_) { /* fall through */ }

    const lines = text.split(/\r?\n/);
    const records = [];
    const failures = [];
    let nonEmpty = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      nonEmpty++;
      try {
        records.push(JSON.parse(line));
      } catch (e) {
        failures.push({ lineNumber: i + 1, snippet: line.slice(0, 80), error: e.message });
      }
    }

    if (nonEmpty > 0 && failures.length === 0) {
      if (records.length === 1) {
        return { kind: 'json', data: records[0] };
      }
      return { kind: 'jsonl', records };
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
