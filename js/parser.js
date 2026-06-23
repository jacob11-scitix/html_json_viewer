// JSON vs JSONL detection + parsing.
// Returns { kind: 'json' | 'jsonl', data | records } on success
// or { kind: 'error', message, line?, column? }.

export function parse(text) {
  const trimmed = text.trim();
  if (!trimmed) return { kind: 'error', message: 'Empty input.' };

  // Strategy: try as a single JSON document first.
  try {
    const data = JSON.parse(trimmed);
    // If the entire text parses cleanly as JSON but contains many newlines and
    // looks like an array — still JSON, not JSONL.
    return { kind: 'json', data };
  } catch (jsonErr) {
    // Fall through to JSONL.
  }

  // Try JSONL: each non-empty line is its own JSON value.
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
      // A single line that didn't parse as JSON above but parsed as a line —
      // can't happen logically. Treat as single JSON to be safe.
      return { kind: 'json', data: records[0] };
    }
    return { kind: 'jsonl', records };
  }

  // If most lines parsed, treat as JSONL but show a soft warning.
  if (nonEmpty > 0 && failures.length / nonEmpty < 0.1 && records.length > 1) {
    return {
      kind: 'jsonl',
      records,
      warning: `Skipped ${failures.length} unparseable line${failures.length === 1 ? '' : 's'}.`,
    };
  }

  // Neither strategy worked — surface the JSON.parse error from the single-doc
  // attempt for the most useful diagnostic.
  let message = 'Could not parse as JSON or JSONL.';
  try {
    JSON.parse(trimmed);
  } catch (e) {
    message = e.message;
  }
  return { kind: 'error', message, failures };
}
