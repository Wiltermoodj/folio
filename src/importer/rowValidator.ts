/**
 * Folio — Row-Level & Cell-Level Data Format Validator
 * Inspects every row in an uploaded or pasted CSV / TSV / XLSX / JSON dataset,
 * classifying rows as Passed, Warning, or Failed with specific format diagnostics.
 */

import type {
  ColumnMappingConfig,
  ImportTargetSection,
  RowCellValidationMessage,
  RowValidationEntry,
  RowValidationStatus,
  RowValidationSummary
} from '../types/folio';
import { escapeCsvCell, type ParsedTableResult } from './csvParser';
import { autoDetectColumnMapping, autoDetectTargetSection } from './dataTransformer';
import { validateCsvHeaders } from './headerValidator';

const EXCEL_ERROR_RE = /^(#VALUE!|#REF!|#DIV\/0!|#NAME\?|#N\/A|#NUM!|#NULL!|Err:\d+)$/i;
const PLACEHOLDER_NA_RE = /^(n\/a|na|tbd|null|undefined|none|--|-|\?+)$/i;

interface NumericRule {
  column: string;
  fieldKey: string;
  label: string;
  required: boolean;
  expectedFormat: string;
  min?: number;
  max?: number;
  minIsStrictError?: boolean;
  maxIsStrictError?: boolean;
  integerOnly?: boolean;
  positiveOnly?: boolean;
}

/**
 * Checks whether a raw string can be parsed as a valid number (allowing currency/unit suffixes like $, %, bn, bps, pp).
 */
function inspectNumericCell(
  raw: string,
  rule: NumericRule
): { value: number | null; issue: RowCellValidationMessage | null } {
  const trimmed = (raw ?? '').trim();

  if (!trimmed) {
    if (rule.required) {
      return {
        value: null,
        issue: {
          severity: 'error',
          column: rule.column,
          fieldKey: rule.fieldKey,
          rawValue: '(empty)',
          message: `Missing required numeric value in "${rule.column}".`,
          expectedFormat: rule.expectedFormat,
          suggestion: `Provide a valid ${rule.label.toLowerCase()} (${rule.expectedFormat}).`
        }
      };
    }
    return {
      value: null,
      issue: {
        severity: 'warning',
        column: rule.column,
        fieldKey: rule.fieldKey,
        rawValue: '(empty)',
        message: `Optional numeric field "${rule.column}" is empty; default fallback will be used.`,
        expectedFormat: rule.expectedFormat
      }
    };
  }

  if (EXCEL_ERROR_RE.test(trimmed)) {
    return {
      value: null,
      issue: {
        severity: 'error',
        column: rule.column,
        fieldKey: rule.fieldKey,
        rawValue: trimmed,
        message: `Spreadsheet formula error "${trimmed}" detected in "${rule.column}".`,
        expectedFormat: rule.expectedFormat,
        suggestion: 'Replace the broken Excel formula with a numeric value.'
      }
    };
  }

  if (PLACEHOLDER_NA_RE.test(trimmed)) {
    return {
      value: null,
      issue: {
        severity: rule.required ? 'error' : 'warning',
        column: rule.column,
        fieldKey: rule.fieldKey,
        rawValue: trimmed,
        message: rule.required
          ? `Placeholder text "${trimmed}" in required numeric column "${rule.column}".`
          : `Placeholder "${trimmed}" in optional column "${rule.column}"; fallback value will be used.`,
        expectedFormat: rule.expectedFormat,
        suggestion: `Replace "${trimmed}" with a valid number (${rule.expectedFormat}).`
      }
    };
  }

  // Strip allowed unit decorations ($, €, £, ¥, %, commas, bn, tn, pp, bps, unary +)
  const cleaned = trimmed
    .replace(/[$€£¥,%]/g, '')
    .replace(/\b(bn|tn|pp|bps|est\.?|estimate)\b/gi, '')
    .replace(/−/g, '-')
    .replace(/^\+/, '')
    .trim();

  if (!cleaned || !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cleaned)) {
    return {
      value: null,
      issue: {
        severity: 'error',
        column: rule.column,
        fieldKey: rule.fieldKey,
        rawValue: trimmed,
        message: `Invalid numeric format "${trimmed}" in "${rule.column}".`,
        expectedFormat: rule.expectedFormat,
        suggestion: `Expected ${rule.expectedFormat}.`
      }
    };
  }

  const num = Number(cleaned);
  if (!Number.isFinite(num)) {
    return {
      value: null,
      issue: {
        severity: 'error',
        column: rule.column,
        fieldKey: rule.fieldKey,
        rawValue: trimmed,
        message: `Non-finite number "${trimmed}" in "${rule.column}".`,
        expectedFormat: rule.expectedFormat
      }
    };
  }

  if (rule.positiveOnly && num <= 0) {
    return {
      value: num,
      issue: {
        severity: 'error',
        column: rule.column,
        fieldKey: rule.fieldKey,
        rawValue: trimmed,
        message: `Value "${trimmed}" in "${rule.column}" must be greater than 0.`,
        expectedFormat: rule.expectedFormat,
        suggestion: 'Enter a positive number (>= 1).'
      }
    };
  }

  if (rule.min !== undefined && num < rule.min) {
    const isErr = rule.minIsStrictError !== false;
    return {
      value: num,
      issue: {
        severity: isErr ? 'error' : 'warning',
        column: rule.column,
        fieldKey: rule.fieldKey,
        rawValue: trimmed,
        message: isErr
          ? `Value "${trimmed}" in "${rule.column}" is below minimum allowed (${rule.min}).`
          : `Value "${trimmed}" in "${rule.column}" is below ${rule.min}; will be clamped to ${rule.min}.`,
        expectedFormat: rule.expectedFormat
      }
    };
  }

  if (rule.max !== undefined && num > rule.max) {
    const isErr = rule.maxIsStrictError === true;
    return {
      value: num,
      issue: {
        severity: isErr ? 'error' : 'warning',
        column: rule.column,
        fieldKey: rule.fieldKey,
        rawValue: trimmed,
        message: isErr
          ? `Value "${trimmed}" in "${rule.column}" exceeds maximum allowed (${rule.max}).`
          : `Value "${trimmed}" in "${rule.column}" exceeds ${rule.max}; will be clamped or normalized.`,
        expectedFormat: rule.expectedFormat
      }
    };
  }

  if (rule.integerOnly && !Number.isInteger(num)) {
    return {
      value: num,
      issue: {
        severity: 'warning',
        column: rule.column,
        fieldKey: rule.fieldKey,
        rawValue: trimmed,
        message: `Decimal value "${trimmed}" in integer column "${rule.column}"; will be rounded to ${Math.round(num)}.`,
        expectedFormat: rule.expectedFormat
      }
    };
  }

  return { value: num, issue: null };
}

function inspectTextCell(
  raw: string,
  column: string,
  fieldKey: string,
  label: string,
  required = true
): RowCellValidationMessage | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    if (!required) return null;
    return {
      severity: 'error',
      column,
      fieldKey,
      rawValue: '(empty)',
      message: `Missing required ${label} in column "${column}".`,
      expectedFormat: 'Non-empty text label'
    };
  }
  if (EXCEL_ERROR_RE.test(trimmed)) {
    return {
      severity: 'error',
      column,
      fieldKey,
      rawValue: trimmed,
      message: `Spreadsheet formula error "${trimmed}" in text column "${column}".`,
      expectedFormat: 'Text label'
    };
  }
  return null;
}

/**
 * Helper to resolve which header name corresponds to a spec key or mapping key.
 */
function resolveColumnName(
  headers: string[],
  specKey: string,
  matchedMap: Map<string, string>,
  fallbackIdx?: number
): string | undefined {
  if (matchedMap.has(specKey)) return matchedMap.get(specKey);
  if (fallbackIdx !== undefined && headers[fallbackIdx]) return headers[fallbackIdx];
  return undefined;
}

/**
 * Performs row-by-row validation on parsed tabular input for the active or auto-detected Folio section.
 */
export function validateUploadedRows(
  parsed: ParsedTableResult,
  targetSection: ImportTargetSection = 'auto',
  customMapping?: ColumnMappingConfig
): RowValidationSummary {
  const detectedTarget =
    targetSection === 'auto' ? autoDetectTargetSection(parsed) : targetSection;

  if (
    detectedTarget === 'full-json' ||
    parsed.format === 'folio-json' ||
    parsed.format === 'html-data'
  ) {
    return {
      target: 'full-json',
      totalRows: 0,
      passedCount: 0,
      warningCount: 0,
      failedCount: 0,
      errorMessageCount: 0,
      warningMessageCount: 0,
      rows: [],
      summaryText: 'Structured Folio DATA JSON object detected (object-level schema validation active).'
    };
  }

  const headers = parsed.headers;
  const mapping = customMapping || autoDetectColumnMapping(headers);
  const headerVal = validateCsvHeaders(headers, detectedTarget, mapping);
  const matchedMap = new Map<string, string>();
  headerVal.matched.forEach(m => matchedMap.set(m.key, m.matchedHeader));

  const rowEntries: RowValidationEntry[] = [];
  const seenPrimaryKeys = new Map<string, number>();

  parsed.rows.forEach((rawRow, idx) => {
    const rowIndex = idx + 1;
    const fileLineNumber = idx + 2; // Line 1 is header
    const messages: RowCellValidationMessage[] = [];
    let primaryLabel = `Row ${rowIndex}`;

    const checkText = (col: string | undefined, key: string, label: string, req = true) => {
      if (!col) return '';
      const val = rawRow[col] ?? '';
      const iss = inspectTextCell(val, col, key, label, req);
      if (iss) messages.push(iss);
      return val.trim();
    };

    const checkNum = (col: string | undefined, rule: Omit<NumericRule, 'column'>): number | null => {
      if (!col) return null;
      const res = inspectNumericCell(rawRow[col] ?? '', { ...rule, column: col });
      if (res.issue) messages.push(res.issue);
      return res.value;
    };

    switch (detectedTarget) {
      case 'master-records':
      case 's10b-markets': {
        const mCol = mapping.marketCol || resolveColumnName(headers, 'market', matchedMap, 0);
        const rCol = mapping.regionCol || resolveColumnName(headers, 'region', matchedMap, 1);
        const sCol = mapping.shareCol || resolveColumnName(headers, 'value', matchedMap, 4);
        const nCol = mapping.recordsCol || resolveColumnName(headers, 'records', matchedMap);
        const pCol = mapping.policyCol || resolveColumnName(headers, 'policy', matchedMap);
        const bCol = mapping.bpsCol || resolveColumnName(headers, 'bps', matchedMap);
        const dCol = mapping.deltaCol || resolveColumnName(headers, 'delta', matchedMap);

        const mVal = checkText(mCol, 'market', 'Market / Entity name', true);
        const rVal = checkText(rCol, 'region', 'Region / Geography', true);
        primaryLabel = mVal ? (rVal ? `${mVal} (${rVal})` : mVal) : `Row ${rowIndex}`;

        if (mVal) {
          const normKey = mVal.toLowerCase();
          const prevRow = seenPrimaryKeys.get(normKey);
          if (prevRow !== undefined && mCol) {
            messages.push({
              severity: 'warning',
              column: mCol,
              fieldKey: 'market',
              rawValue: mVal,
              message: `Duplicate market "${mVal}" (already appeared in Row ${prevRow}).`,
              expectedFormat: 'Unique market identifier'
            });
          } else {
            seenPrimaryKeys.set(normKey, rowIndex);
          }
        }

        checkNum(sCol, {
          fieldKey: 'value',
          label: 'Adoption / Share (%)',
          required: true,
          expectedFormat: 'Percentage 0–100 (e.g. 24.5 or 24.5%)',
          min: 0,
          max: 100,
          minIsStrictError: true,
          maxIsStrictError: false
        });

        if (nCol) {
          checkNum(nCol, {
            fieldKey: 'records',
            label: 'Records Count (n)',
            required: false,
            expectedFormat: 'Positive integer >= 1 (e.g. 42)',
            positiveOnly: true,
            integerOnly: true
          });
        }

        if (pCol) {
          checkNum(pCol, {
            fieldKey: 'policy',
            label: 'Policy / Readiness (%)',
            required: false,
            expectedFormat: 'Percentage 0–100 (e.g. 78)',
            min: 0,
            max: 100,
            minIsStrictError: true,
            maxIsStrictError: false
          });
        }

        if (bCol) {
          checkNum(bCol, {
            fieldKey: 'bps',
            label: 'Efficiency / Cost Index (bps)',
            required: false,
            expectedFormat: 'Numeric basis points (e.g. -14 or 165)'
          });
        }

        if (dCol) {
          checkNum(dCol, {
            fieldKey: 'delta',
            label: 'YoY Delta (pp)',
            required: false,
            expectedFormat: 'Numeric percentage-point change (e.g. +4.2 or -1.5)'
          });
        }

        const trendCols =
          mapping.trendCols && mapping.trendCols.length > 0
            ? mapping.trendCols
            : headers.filter(h => /^(201\d|202\d|t\d+)$/i.test(h.trim()));
        trendCols.forEach(tc => {
          if ((rawRow[tc] ?? '').trim() !== '') {
            checkNum(tc, {
              fieldKey: `trend.${tc}`,
              label: `Trend ${tc}`,
              required: false,
              expectedFormat: 'Numeric percentage (e.g. 16.4)',
              min: 0,
              max: 100,
              minIsStrictError: true,
              maxIsStrictError: false
            });
          }
        });
        break;
      }

      case 's01-heroMatrix': {
        const dimCol = resolveColumnName(headers, 'dimension', matchedMap, 0);
        const nameCol = mapping.marketCol || resolveColumnName(headers, 'name', matchedMap, 1);
        const cntCol = mapping.recordsCol || resolveColumnName(headers, 'count', matchedMap, 2);

        const dimVal = checkText(dimCol, 'dimension', 'Matrix Dimension', true);
        const nameVal = checkText(nameCol, 'name', 'Group Name', true);
        primaryLabel = nameVal ? `${dimVal || 'group'}: ${nameVal}` : `Row ${rowIndex}`;

        if (
          dimVal &&
          dimCol &&
          !/^(region|assetsize|asset\s*size|tier|size|role|segment)$/i.test(dimVal)
        ) {
          messages.push({
            severity: 'warning',
            column: dimCol,
            fieldKey: 'dimension',
            rawValue: dimVal,
            message: `Unrecognized matrix dimension "${dimVal}"; will default to "region".`,
            expectedFormat: '"region", "assetSize", or "role"'
          });
        }

        checkNum(cntCol, {
          fieldKey: 'count',
          label: 'Record Count',
          required: true,
          expectedFormat: 'Positive integer >= 1 (e.g. 85)',
          positiveOnly: true,
          integerOnly: true
        });
        break;
      }

      case 's02a-sampleFunction': {
        const catCol = mapping.marketCol || resolveColumnName(headers, 'category', matchedMap, 0);
        const valCol = mapping.shareCol || resolveColumnName(headers, 'value', matchedMap, 1);
        const catVal = checkText(catCol, 'category', 'Category Name', true);
        primaryLabel = catVal || `Row ${rowIndex}`;

        checkNum(valCol, {
          fieldKey: 'value',
          label: 'Share (%)',
          required: true,
          expectedFormat: 'Percentage > 0 (e.g. 28)',
          min: 0,
          max: 100,
          minIsStrictError: true
        });
        break;
      }

      case 's02b-sampleRegion': {
        const regCol = mapping.regionCol || resolveColumnName(headers, 'region', matchedMap, 0);
        const nCol = mapping.recordsCol || resolveColumnName(headers, 'records', matchedMap, 1);
        const medCol =
          mapping.medianVolumeCol || resolveColumnName(headers, 'value', matchedMap, 2);

        const regVal = checkText(regCol, 'region', 'Region Name', true);
        primaryLabel = regVal || `Row ${rowIndex}`;

        checkNum(nCol, {
          fieldKey: 'records',
          label: 'Records (n)',
          required: true,
          expectedFormat: 'Positive integer >= 1 (e.g. 148)',
          positiveOnly: true,
          integerOnly: true
        });

        checkNum(medCol, {
          fieldKey: 'value',
          label: 'Median Volume ($bn)',
          required: true,
          expectedFormat: 'Positive number (e.g. 38.5)',
          min: 0,
          minIsStrictError: true
        });
        break;
      }

      case 's03-priorities': {
        const itemCol = mapping.marketCol || resolveColumnName(headers, 'item', matchedMap, 0);
        const y24Col = mapping.y2024Col || resolveColumnName(headers, 'y2024', matchedMap, 1);
        const y26Col = mapping.y2026Col || resolveColumnName(headers, 'y2026', matchedMap, 2);

        const itemVal = checkText(itemCol, 'item', 'Initiative / Category', true);
        primaryLabel = itemVal || `Row ${rowIndex}`;

        checkNum(y24Col, {
          fieldKey: 'y2024',
          label: 'Baseline 2024 (%)',
          required: true,
          expectedFormat: 'Percentage 0–100 (e.g. 41)',
          min: 0,
          max: 100,
          minIsStrictError: true
        });

        checkNum(y26Col, {
          fieldKey: 'y2026',
          label: 'Latest 2026 (%)',
          required: true,
          expectedFormat: 'Percentage 0–100 (e.g. 68)',
          min: 0,
          max: 100,
          minIsStrictError: true
        });
        break;
      }

      case 's04-riskLimits': {
        const regCol = mapping.regionCol || resolveColumnName(headers, 'region', matchedMap, 0);
        const incCol = resolveColumnName(headers, 'increasing', matchedMap, 1);
        const uncCol = resolveColumnName(headers, 'unchanged', matchedMap, 2);
        const decCol = resolveColumnName(headers, 'decreasing', matchedMap, 3);
        const nCol = headers[4];

        const regVal = checkText(regCol, 'region', 'Region Name', true);
        primaryLabel = regVal || `Row ${rowIndex}`;

        const v1 = checkNum(incCol, {
          fieldKey: 'increasing',
          label: 'Increasing (%)',
          required: true,
          expectedFormat: 'Percentage 0–100',
          min: 0,
          max: 100
        });
        const v2 = checkNum(uncCol, {
          fieldKey: 'unchanged',
          label: 'Unchanged (%)',
          required: true,
          expectedFormat: 'Percentage 0–100',
          min: 0,
          max: 100
        });
        const v3 = checkNum(decCol, {
          fieldKey: 'decreasing',
          label: 'Decreasing (%)',
          required: true,
          expectedFormat: 'Percentage 0–100',
          min: 0,
          max: 100
        });

        if (v1 !== null && v2 !== null && v3 !== null) {
          const sum = v1 + v2 + v3;
          if (sum <= 0) {
            messages.push({
              severity: 'error',
              column: `${incCol} + ${uncCol} + ${decCol}`,
              fieldKey: 'rowSum',
              rawValue: `${sum}%`,
              message: 'Row percentages sum to 0%. At least one share must be positive.',
              expectedFormat: 'Row percentages summing to 100%'
            });
          } else if (Math.abs(sum - 100) > 0.5) {
            messages.push({
              severity: 'warning',
              column: `${incCol} + ${uncCol} + ${decCol}`,
              fieldKey: 'rowSum',
              rawValue: `${Number(sum.toFixed(1))}%`,
              message: `Row percentages sum to ${Number(sum.toFixed(1))}% instead of 100%; will be auto-normalized to 100%.`,
              expectedFormat: 'Row sum = 100%'
            });
          }
        }

        if (nCol && (rawRow[nCol] ?? '').trim() !== '') {
          checkNum(nCol, {
            fieldKey: 'n',
            label: 'Sample size (n)',
            required: false,
            expectedFormat: 'Positive integer >= 1',
            positiveOnly: true,
            integerOnly: true
          });
        }
        break;
      }

      case 's05a-regulationLine': {
        const yrCol = resolveColumnName(headers, 'year', matchedMap, 0);
        const valCol = mapping.shareCol || resolveColumnName(headers, 'value', matchedMap, 1);

        const yr = checkNum(yrCol, {
          fieldKey: 'year',
          label: 'Year',
          required: true,
          expectedFormat: '4-digit year (e.g. 2025)',
          min: 1900,
          max: 2100,
          minIsStrictError: true,
          maxIsStrictError: true,
          integerOnly: true
        });
        primaryLabel = yr !== null ? `Year ${yr}` : (yrCol && rawRow[yrCol]) || `Row ${rowIndex}`;

        checkNum(valCol, {
          fieldKey: 'value',
          label: 'Adoption (%)',
          required: true,
          expectedFormat: 'Percentage 0–100 (e.g. 64)',
          min: 0,
          max: 100,
          minIsStrictError: true
        });
        break;
      }

      case 's05b-regulationEvents': {
        const dateCol = resolveColumnName(headers, 'date', matchedMap, 2);
        const shortCol = resolveColumnName(headers, 'short', matchedMap, 3);
        const titleCol = resolveColumnName(headers, 'title', matchedMap, 4);
        const posCol = headers.find(h => /^pos$/i.test(h.trim()));

        const dVal = checkText(dateCol, 'date', 'Display Date', true);
        const sVal = checkText(shortCol, 'short', 'Short Label', true);
        checkText(titleCol, 'title', 'Milestone Title', true);
        primaryLabel = sVal ? `${dVal || ''} ${sVal}`.trim() : `Row ${rowIndex}`;

        if (posCol && (rawRow[posCol] ?? '').trim() !== '') {
          checkNum(posCol, {
            fieldKey: 'pos',
            label: 'Timeline Decimal Year (pos)',
            required: false,
            expectedFormat: 'Decimal year between 1900 and 2100 (e.g. 2024.25)',
            min: 1900,
            max: 2100,
            minIsStrictError: true,
            maxIsStrictError: true
          });
        }
        break;
      }

      case 's06-volume': {
        const yrCol = resolveColumnName(headers, 'year', matchedMap, 0);
        const estCol = headers.find(h => /^(est|estimate|forecast)$/i.test(h.trim()));
        const seriesCols = headers.filter(
          h => h !== yrCol && h !== estCol && !/^total$/i.test(h.trim())
        );

        const yrVal = checkText(yrCol, 'year', 'Year / Period', true);
        primaryLabel = yrVal || `Row ${rowIndex}`;

        seriesCols.forEach(sc => {
          checkNum(sc, {
            fieldKey: sc,
            label: sc,
            required: true,
            expectedFormat: 'Non-negative volume number (e.g. 420)',
            min: 0,
            minIsStrictError: true
          });
        });

        if (estCol && (rawRow[estCol] ?? '').trim() !== '') {
          const estVal = rawRow[estCol].trim();
          if (!/^(true|false|1|0|yes|no|est|e)$/i.test(estVal)) {
            messages.push({
              severity: 'warning',
              column: estCol,
              fieldKey: 'est',
              rawValue: estVal,
              message: `Unrecognized boolean estimate flag "${estVal}" in "${estCol}".`,
              expectedFormat: 'true / false, yes / no, or 1 / 0'
            });
          }
        }
        break;
      }

      case 's07-exposure': {
        const catCol = resolveColumnName(headers, 'category', matchedMap, 0);
        const catVal = checkText(catCol, 'category', 'Category / Sector', true);
        primaryLabel = catVal || `Row ${rowIndex}`;

        headers.slice(1).forEach(col => {
          checkNum(col, {
            fieldKey: col,
            label: `${col} Intensity (%)`,
            required: true,
            expectedFormat: 'Percentage 0–100 (e.g. 58)',
            min: 0,
            max: 100,
            minIsStrictError: true,
            maxIsStrictError: false
          });
        });
        break;
      }

      case 's08a-waffle': {
        const segCol = resolveColumnName(headers, 'segment', matchedMap, 0);
        const verCol = resolveColumnName(headers, 'verified', matchedMap, 1);
        const estCol = resolveColumnName(headers, 'estimated', matchedMap, 2);
        const nonCol = resolveColumnName(headers, 'none', matchedMap, 3);

        const segVal = checkText(segCol, 'segment', 'Segment Name', true);
        primaryLabel = segVal || `Row ${rowIndex}`;

        const v1 = checkNum(verCol, {
          fieldKey: 'verified',
          label: 'Verified (%)',
          required: true,
          expectedFormat: 'Percentage 0–100',
          min: 0,
          max: 100
        });
        const v2 = checkNum(estCol, {
          fieldKey: 'estimated',
          label: 'Estimated (%)',
          required: true,
          expectedFormat: 'Percentage 0–100',
          min: 0,
          max: 100
        });
        const v3 = checkNum(nonCol, {
          fieldKey: 'none',
          label: 'Unverified (%)',
          required: true,
          expectedFormat: 'Percentage 0–100',
          min: 0,
          max: 100
        });

        if (v1 !== null && v2 !== null && v3 !== null) {
          const sum = v1 + v2 + v3;
          if (sum <= 0) {
            messages.push({
              severity: 'error',
              column: `${verCol} + ${estCol} + ${nonCol}`,
              fieldKey: 'rowSum',
              rawValue: `${sum}%`,
              message: 'Waffle segment percentages sum to 0%.',
              expectedFormat: 'Row sum = 100%'
            });
          } else if (Math.abs(sum - 100) > 0.5) {
            messages.push({
              severity: 'warning',
              column: `${verCol} + ${estCol} + ${nonCol}`,
              fieldKey: 'rowSum',
              rawValue: `${Number(sum.toFixed(1))}%`,
              message: `Waffle percentages sum to ${Number(sum.toFixed(1))}% instead of 100%; will be auto-normalized.`,
              expectedFormat: 'Row sum = 100%'
            });
          }
        }
        break;
      }

      case 's08b-likert': {
        const stCol = resolveColumnName(headers, 'statement', matchedMap, 0);
        const stVal = checkText(stCol, 'statement', 'Survey Statement', true);
        primaryLabel = stVal ? (stVal.length > 44 ? `${stVal.slice(0, 41)}...` : stVal) : `Row ${rowIndex}`;

        const likertCols = headers.slice(1, 6);
        const vals: number[] = [];
        likertCols.forEach(col => {
          const v = checkNum(col, {
            fieldKey: col,
            label: `${col} Response (%)`,
            required: true,
            expectedFormat: 'Percentage 0–100',
            min: 0,
            max: 100
          });
          if (v !== null) vals.push(v);
        });

        if (vals.length === 5) {
          const sum = vals.reduce((a, b) => a + b, 0);
          if (sum <= 0) {
            messages.push({
              severity: 'error',
              column: 'SD..SA',
              fieldKey: 'rowSum',
              rawValue: `${sum}%`,
              message: 'Likert response percentages sum to 0%.',
              expectedFormat: '5-point responses summing to 100%'
            });
          } else if (Math.abs(sum - 100) > 0.5) {
            messages.push({
              severity: 'warning',
              column: 'SD..SA',
              fieldKey: 'rowSum',
              rawValue: `${Number(sum.toFixed(1))}%`,
              message: `Likert responses sum to ${Number(sum.toFixed(1))}% instead of 100%; will be auto-normalized.`,
              expectedFormat: 'Row sum = 100%'
            });
          }
        }
        break;
      }

      case 's09-pricing': {
        const secCol = mapping.segmentCol || resolveColumnName(headers, 'sector', matchedMap, 1);
        const scoreCol = mapping.policyCol || resolveColumnName(headers, 'score', matchedMap, 2);
        const bpsCol = mapping.bpsCol || resolveColumnName(headers, 'bps', matchedMap, 3);

        const secVal = checkText(secCol, 'sector', 'Sector / Category', true);
        primaryLabel = secVal ? `${secVal} (#${rowIndex})` : `Point #${rowIndex}`;

        checkNum(scoreCol, {
          fieldKey: 'score',
          label: 'Readiness Score (x)',
          required: true,
          expectedFormat: 'Score 0–100 (e.g. 68)',
          min: 0,
          max: 100,
          minIsStrictError: true,
          maxIsStrictError: false
        });

        checkNum(bpsCol, {
          fieldKey: 'bps',
          label: 'Cost Index (y: bps)',
          required: true,
          expectedFormat: 'Positive number (e.g. 142)',
          positiveOnly: true
        });
        break;
      }

      case 's10a-outlookBars': {
        const scCol = resolveColumnName(headers, 'scenario', matchedMap, 0);
        const valCol = mapping.shareCol || resolveColumnName(headers, 'value', matchedMap, 1);

        const scVal = checkText(scCol, 'scenario', 'Scenario Label', true);
        primaryLabel = scVal || `Row ${rowIndex}`;

        checkNum(valCol, {
          fieldKey: 'value',
          label: 'Share (%)',
          required: true,
          expectedFormat: 'Percentage 0–100 (e.g. 41)',
          min: 0,
          max: 100,
          minIsStrictError: true
        });
        break;
      }
    }

    const hasError = messages.some(m => m.severity === 'error');
    const hasWarning = messages.some(m => m.severity === 'warning');
    const status: RowValidationStatus = hasError
      ? 'failed'
      : hasWarning
        ? 'warning'
        : 'passed';

    rowEntries.push({
      rowIndex,
      fileLineNumber,
      status,
      primaryLabel,
      messages,
      rawRow
    });
  });

  const passedCount = rowEntries.filter(r => r.status === 'passed').length;
  const warningCount = rowEntries.filter(r => r.status === 'warning').length;
  const failedCount = rowEntries.filter(r => r.status === 'failed').length;
  const errorMessageCount = rowEntries.reduce(
    (acc, r) => acc + r.messages.filter(m => m.severity === 'error').length,
    0
  );
  const warningMessageCount = rowEntries.reduce(
    (acc, r) => acc + r.messages.filter(m => m.severity === 'warning').length,
    0
  );

  let summaryText = '';
  if (rowEntries.length === 0) {
    summaryText = 'No data rows detected in the current input.';
  } else if (failedCount === 0 && warningCount === 0) {
    summaryText = `All ${rowEntries.length} rows passed format validation with zero errors or warnings.`;
  } else if (failedCount === 0) {
    summaryText = `${passedCount} of ${rowEntries.length} rows passed cleanly; ${warningCount} row${
      warningCount > 1 ? 's' : ''
    } contain minor warnings that will be auto-normalized.`;
  } else {
    summaryText = `${failedCount} of ${rowEntries.length} row${
      failedCount > 1 ? 's' : ''
    } failed validation (${errorMessageCount} format error${
      errorMessageCount > 1 ? 's' : ''
    }); ${passedCount} passed, ${warningCount} with warnings.`;
  }

  return {
    target: detectedTarget,
    totalRows: rowEntries.length,
    passedCount,
    warningCount,
    failedCount,
    errorMessageCount,
    warningMessageCount,
    rows: rowEntries,
    summaryText
  };
}

/**
 * Filters out rows with 'failed' status and returns a clean RFC 4180 CSV string
 * containing only passed and warning (auto-fixable) rows.
 */
export function filterOutFailedRowsToCsv(
  headers: string[],
  summary: RowValidationSummary
): string {
  const validRows = summary.rows.filter(r => r.status !== 'failed');
  const lines: string[] = [headers.map(escapeCsvCell).join(',')];
  validRows.forEach(entry => {
    lines.push(headers.map(h => escapeCsvCell(entry.rawRow[h] ?? '')).join(','));
  });
  return lines.join('\n');
}

/**
 * Sample CSV dataset containing intentional format errors and warnings
 * so users can test and inspect the Visual Row Validation Summary Panel.
 */
export const SAMPLE_VALIDATION_TEST_CSV = `Market,Region,Records,Policy (%),Adoption 2026 (%),Efficiency gain (bps),Delta YoY (pp),2021,2022,2023,2024,2025,2026
United Kingdom,Europe,64,91,34.2,-18,5.8,14.2,17.8,21.5,25.0,28.4,34.2
Germany,Europe,52,88,29.6,-15,4.9,11.0,14.2,17.9,21.4,24.7,29.6
Singapore,Asia-Pacific,38.5,112,26.8,-14,5.4,9.5,12.1,15.4,18.2,21.4,26.8
United States,Americas,74,64,TBD,-9,3.1,8.4,10.2,12.5,14.9,17.2,20.3
,Europe,29,85,24.1,-12,4.1,9.8,12.4,15.0,17.8,20.0,24.1
Japan,Asia-Pacific,-12,79,21.5,#VALUE!,3.8,7.2,9.4,12.1,14.8,17.7,21.5
United Kingdom,Europe,41,,22.0,-11,3.5,8.0,10.5,13.2,15.8,18.5,22.0
Canada,Americas,31,74,19.4,-10,2.9,7.5,9.6,11.8,14.2,16.5,19.4`;
