/**
 * Folio — CSV / TSV / JSON / HTML-DATA Parser
 * Handles RFC 4180 quoted CSVs, tab-separated spreadsheet pastes, JSON arrays/objects,
 * and even extracting `const DATA = { ... };` directly from an existing index.html file.
 */

export interface ParsedTableResult {
  format: 'csv' | 'tsv' | 'json-array' | 'folio-json' | 'html-data';
  delimiter: string;
  headers: string[];
  rows: Record<string, string>[];
  rawJson?: unknown;
}

export function detectDelimiter(text: string): string {
  const firstLines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))
    .slice(0, 5);

  if (firstLines.length === 0) return ',';
  const sample = firstLines[0];

  const counts: Record<string, number> = {
    '\t': (sample.match(/\t/g) || []).length,
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '|': (sample.match(/\|/g) || []).length
  };

  if (counts['\t'] > 0 && counts['\t'] >= counts[',']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  if (counts['|'] > counts[',']) return '|';
  return ',';
}

export function parseDelimitedText(text: string, customDelimiter?: string): {
  delimiter: string;
  headers: string[];
  rows: Record<string, string>[];
  rawGrid: string[][];
} {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  const delimiter = customDelimiter || detectDelimiter(cleaned);

  const rawGrid: string[][] = [];
  let curRow: string[] = [];
  let curVal = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        curVal += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        curVal += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        curRow.push(curVal.trim());
        curVal = '';
      } else if (ch === '\r' && next === '\n') {
        curRow.push(curVal.trim());
        if (curRow.some(cell => cell !== '')) rawGrid.push(curRow);
        curRow = [];
        curVal = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        curRow.push(curVal.trim());
        if (curRow.some(cell => cell !== '')) rawGrid.push(curRow);
        curRow = [];
        curVal = '';
      } else {
        curVal += ch;
      }
    }
  }

  curRow.push(curVal.trim());
  if (curRow.some(cell => cell !== '')) {
    rawGrid.push(curRow);
  }

  if (rawGrid.length === 0) {
    return { delimiter, headers: [], rows: [], rawGrid: [] };
  }

  const headers = rawGrid[0].map((h, idx) => h || `Column_${idx + 1}`);
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < rawGrid.length; r++) {
    const line = rawGrid[r];
    if (line.length === 1 && line[0] === '') continue;
    const record: Record<string, string> = {};
    headers.forEach((h, cIdx) => {
      record[h] = line[cIdx] !== undefined ? line[cIdx] : '';
    });
    rows.push(record);
  }

  return { delimiter, headers, rows, rawGrid };
}

/**
 * Extracts a JavaScript object literal assigned to `const DATA = { ... };`
 * or parses loosely formatted JS object literals into a valid JS object.
 */
export function extractFolioDataFromText(raw: string): unknown | null {
  const trimmed = raw.trim();

  // 1. Direct JSON object or array
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to JS literal evaluator for unquoted keys / single quotes
    }
  }

  // 2. Check if this is an HTML file or JS snippet containing `const DATA = {`
  const dataMatch = /(?:const|let|var)\s+DATA(?:\s*:\s*[A-Za-z0-9_<>]+)?\s*=\s*(\{[\s\S]*?\})\s*;/.exec(
    trimmed
  );
  const candidateJs = dataMatch ? dataMatch[1] : trimmed.startsWith('{') ? trimmed : null;

  if (candidateJs) {
    try {
      // Safe evaluation of pure data object literal (supports arithmetic like 2021 + 10 / 12 and single quotes)
      const fn = new Function(`"use strict"; return (${candidateJs});`);
      const evaluated = fn();
      if (evaluated && typeof evaluated === 'object') {
        return evaluated;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function parseAnyInput(input: string): ParsedTableResult {
  const trimmed = input.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { format: 'csv', delimiter: ',', headers: [], rows: [] };
  }

  // Check if input is JSON, JS `const DATA = ...`, or full HTML document
  if (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    trimmed.includes('const DATA') ||
    trimmed.toLowerCase().includes('<!doctype html')
  ) {
    const extracted = extractFolioDataFromText(trimmed);
    if (extracted && typeof extracted === 'object') {
      if (Array.isArray(extracted)) {
        if (extracted.length > 0 && typeof extracted[0] === 'object' && extracted[0] !== null) {
          const headerSet = new Set<string>();
          extracted.forEach(item => {
            Object.keys(item as Record<string, unknown>).forEach(k => headerSet.add(k));
          });
          const headers = Array.from(headerSet);
          const rows = extracted.map(item => {
            const rec = item as Record<string, unknown>;
            const out: Record<string, string> = {};
            headers.forEach(h => {
              const v = rec[h];
              out[h] =
                v === null || v === undefined
                  ? ''
                  : Array.isArray(v)
                    ? v.join(';')
                    : String(v);
            });
            return out;
          });
          return {
            format: 'json-array',
            delimiter: ',',
            headers,
            rows,
            rawJson: extracted
          };
        }
      } else {
        const isHtmlSource =
          trimmed.toLowerCase().includes('<!doctype html') || trimmed.includes('const DATA');
        return {
          format: isHtmlSource ? 'html-data' : 'folio-json',
          delimiter: ',',
          headers: Object.keys(extracted as Record<string, unknown>),
          rows: [],
          rawJson: extracted
        };
      }
    }
  }

  // Otherwise parse as CSV / TSV
  const parsed = parseDelimitedText(trimmed);
  return {
    format: parsed.delimiter === '\t' ? 'tsv' : 'csv',
    delimiter: parsed.delimiter,
    headers: parsed.headers,
    rows: parsed.rows
  };
}

export function parseNumeric(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (typeof val !== 'string') return fallback;
  const cleaned = val
    .replace(/[$€£¥,%]/g, '')
    .replace(/\b(bn|tn|pp|bps|est\.?|estimate)\b/gi, '')
    .replace(/−/g, '-')
    .trim();
  if (!cleaned) return fallback;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

export function parseNumberArray(val: unknown, expectedLen = 6): number[] {
  if (Array.isArray(val)) {
    return val.map(v => parseNumeric(v, 0));
  }
  if (typeof val === 'string') {
    const parts = val
      .split(/[;|,\s]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => parseNumeric(s, NaN))
      .filter(n => !Number.isNaN(n));
    if (parts.length > 0) return parts;
  }
  return Array.from({ length: expectedLen }, (_, i) => Number((5 + i * 2.5).toFixed(1)));
}

export function escapeCsvCell(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
