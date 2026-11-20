/**
 * Folio — Excel (.XLSX / .XLS) Workbook Importer & Exporter
 * Parses single-sheet and multi-sheet Excel workbooks into Folio's tabular pipeline,
 * auto-detects target chart sections per worksheet, supports batch multi-sheet import,
 * and generates round-trip multi-sheet .xlsx template workbooks.
 */

import * as XLSX from 'xlsx';
import { cloneFolioData, DEFAULT_FOLIO_DATA } from '../data/defaultData';
import type {
  FolioData,
  ImportTargetSection,
  ParsedXlsxSheet,
  ParsedXlsxWorkbook,
  ValidationResult
} from '../types/folio';
import { escapeCsvCell, parseAnyInput } from './csvParser';
import {
  autoDetectColumnMapping,
  autoDetectTargetSection,
  FolioDataImporter,
  validateCsvHeaders
} from './dataTransformer';
import { validateAndNormalizeFolioData } from './schemaValidator';

const SHEET_NAME_SECTION_HINTS: { pattern: RegExp; target: ImportTargetSection }[] = [
  { pattern: /(^00|master|all[\s_-]*charts|cohort)/i, target: 'master-records' },
  { pattern: /(^01|hero[\s_-]*matrix|unit[\s_-]*matrix)/i, target: 's01-heroMatrix' },
  { pattern: /(^02a|sample[\s_-]*func|stacked[\s_-]*bar|composition)/i, target: 's02a-sampleFunction' },
  { pattern: /(^02b|sample[\s_-]*reg|regional[\s_-]*table|region[\s_-]*break)/i, target: 's02b-sampleRegion' },
  { pattern: /(^03|priorit|dumbbell)/i, target: 's03-priorities' },
  { pattern: /(^04|risk[\s_-]*limit|kpi[\s_-]*bar)/i, target: 's04-riskLimits' },
  { pattern: /(^05a|reg[\s_-]*line|trajectory)/i, target: 's05a-regulationLine' },
  { pattern: /(^05b|reg[\s_-]*event|milestone|timeline)/i, target: 's05b-regulationEvents' },
  { pattern: /(^06|volume|scrolly)/i, target: 's06-volume' },
  { pattern: /(^07|exposure|heatmap)/i, target: 's07-exposure' },
  { pattern: /(^08a|waffle)/i, target: 's08a-waffle' },
  { pattern: /(^08b|likert|sentiment)/i, target: 's08b-likert' },
  { pattern: /(^09|pricing|scatter|regression)/i, target: 's09-pricing' },
  { pattern: /(^10a|outlook)/i, target: 's10a-outlookBars' },
  { pattern: /(^10b|market[\s_-]*index|^markets$)/i, target: 's10b-markets' }
];

export const XLSX_WORKBOOK_SHEETS: {
  sheetName: string;
  section: Exclude<ImportTargetSection, 'auto' | 'full-json'>;
}[] = [
  { sheetName: '00_Master_Records', section: 'master-records' },
  { sheetName: '01_Hero_Matrix', section: 's01-heroMatrix' },
  { sheetName: '02A_Composition', section: 's02a-sampleFunction' },
  { sheetName: '02B_Regions', section: 's02b-sampleRegion' },
  { sheetName: '03_Dumbbell', section: 's03-priorities' },
  { sheetName: '04_Risk_Limits', section: 's04-riskLimits' },
  { sheetName: '05A_Trajectory', section: 's05a-regulationLine' },
  { sheetName: '05B_Milestones', section: 's05b-regulationEvents' },
  { sheetName: '06_Volume', section: 's06-volume' },
  { sheetName: '07_Heatmap', section: 's07-exposure' },
  { sheetName: '08A_Waffle', section: 's08a-waffle' },
  { sheetName: '08B_Likert', section: 's08b-likert' },
  { sheetName: '09_Scatter_OLS', section: 's09-pricing' },
  { sheetName: '10A_Outlook', section: 's10a-outlookBars' },
  { sheetName: '10B_Markets', section: 's10b-markets' }
];

/**
 * Infers the target Folio chart section using both worksheet headers and worksheet tab name.
 */
function detectSheetTargetSection(
  sheetName: string,
  headers: string[],
  csvText: string
): ImportTargetSection {
  const parsed = parseAnyInput(csvText);
  const byHeader = autoDetectTargetSection(parsed);

  // Check if the sheet tab name explicitly matches a section
  for (const hint of SHEET_NAME_SECTION_HINTS) {
    if (hint.pattern.test(sheetName.trim())) {
      const mapping = autoDetectColumnMapping(headers);
      const check = validateCsvHeaders(headers, hint.target, mapping);
      if (check.valid) {
        return hint.target;
      }
    }
  }

  return byHeader;
}

/**
 * Converts a 2D array of raw Excel cells into normalized headers, record objects, and RFC 4180 CSV text.
 */
function normalizeSheetGrid(rawGrid: unknown[][]): {
  headers: string[];
  rows: Record<string, string>[];
  csvText: string;
} {
  // Filter out completely empty rows
  const nonEmptyRows = rawGrid
    .map(row =>
      (Array.isArray(row) ? row : []).map(cell =>
        cell === null || cell === undefined ? '' : String(cell).trim()
      )
    )
    .filter(row => row.some(cell => cell !== ''));

  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [], csvText: '' };
  }

  // Locate the header row (skip leading single-cell title banner rows if followed by multi-column table)
  let headerRowIdx = 0;
  if (
    nonEmptyRows.length >= 2 &&
    nonEmptyRows[0].filter(Boolean).length === 1 &&
    nonEmptyRows[1].filter(Boolean).length >= 2
  ) {
    headerRowIdx = 1;
  }

  const rawHeaders = nonEmptyRows[headerRowIdx];
  const maxCols = nonEmptyRows
    .slice(headerRowIdx)
    .reduce((max, r) => Math.max(max, r.length), rawHeaders.length);

  const headers: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const h = rawHeaders[c] ? rawHeaders[c].trim() : '';
    headers.push(h || `Column_${c + 1}`);
  }

  const rows: Record<string, string>[] = [];
  const csvLines: string[] = [headers.map(escapeCsvCell).join(',')];

  for (let r = headerRowIdx + 1; r < nonEmptyRows.length; r++) {
    const line = nonEmptyRows[r];
    if (!line.some(cell => cell !== '')) continue;
    const record: Record<string, string> = {};
    const rowCells: string[] = [];
    headers.forEach((h, cIdx) => {
      const val = line[cIdx] !== undefined ? line[cIdx] : '';
      record[h] = val;
      rowCells.push(escapeCsvCell(val));
    });
    rows.push(record);
    csvLines.push(rowCells.join(','));
  }

  return {
    headers,
    rows,
    csvText: csvLines.join('\n')
  };
}

/**
 * Checks whether a filename or File object is an Excel workbook (.xlsx, .xls, .xlsm, .ods).
 */
export function isExcelFileName(fileName: string): boolean {
  return /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(fileName.trim());
}

/**
 * Parses an Excel (.xlsx / .xls) ArrayBuffer into structured sheets with auto-detected Folio chart targets.
 */
export function parseXlsxBuffer(
  buffer: ArrayBuffer,
  fileName = 'workbook.xlsx'
): ParsedXlsxWorkbook {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false
  });

  const sheets: ParsedXlsxSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawGrid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false
    });

    const { headers, rows, csvText } = normalizeSheetGrid(rawGrid);
    if (headers.length === 0) continue;

    const detectedTarget = detectSheetTargetSection(sheetName, headers, csvText);
    const mapping = autoDetectColumnMapping(headers);
    const headerValidation = validateCsvHeaders(headers, detectedTarget, mapping);

    sheets.push({
      name: sheetName,
      csvText,
      headers,
      rows,
      detectedTarget,
      headerValid: headerValidation.valid && rows.length > 0
    });
  }

  const firstValid = sheets.find(s => s.headerValid) || sheets[0];

  return {
    fileName,
    sheetNames: sheets.map(s => s.name),
    sheets,
    activeSheetName: firstValid ? firstValid.name : ''
  };
}

/**
 * Imports all valid worksheets from a parsed .xlsx workbook into a single FolioData object.
 * Sheets mapped to specific sections override or enrich the base dataset in sequence.
 */
export function importAllXlsxSheets(
  workbook: ParsedXlsxWorkbook,
  baseData?: FolioData
): {
  data: FolioData;
  importedSheets: { sheetName: string; target: ImportTargetSection; rows: number }[];
  skippedSheets: string[];
  validation: ValidationResult;
  summary: string;
} {
  let working = cloneFolioData(baseData || DEFAULT_FOLIO_DATA);
  const importedSheets: { sheetName: string; target: ImportTargetSection; rows: number }[] = [];
  const skippedSheets: string[] = [];

  // Process 'master-records' sheet first if present, then specific chart section sheets
  const orderedSheets = [...workbook.sheets].sort((a, b) => {
    if (a.detectedTarget === 'master-records' && b.detectedTarget !== 'master-records') return -1;
    if (b.detectedTarget === 'master-records' && a.detectedTarget !== 'master-records') return 1;
    return 0;
  });

  for (const sheet of orderedSheets) {
    if (!sheet.csvText || sheet.rows.length === 0) {
      skippedSheets.push(sheet.name);
      continue;
    }

    const mapping = autoDetectColumnMapping(sheet.headers);
    const result = FolioDataImporter.importFromText(sheet.csvText, {
      target: sheet.detectedTarget,
      mapping,
      baseData: working,
      autoFix: true,
      strictHeaders: true
    });

    if (result.headerValidation.valid) {
      working = result.data;
      importedSheets.push({
        sheetName: sheet.name,
        target: result.detectedTarget,
        rows: sheet.rows.length
      });
    } else {
      skippedSheets.push(sheet.name);
    }
  }

  const { data, validation } = validateAndNormalizeFolioData(working, {
    autoFix: true,
    baseData: baseData || DEFAULT_FOLIO_DATA
  });

  const summary =
    importedSheets.length > 0
      ? `Imported ${importedSheets.length} Excel worksheet${
          importedSheets.length > 1 ? 's' : ''
        } from "${workbook.fileName}" (${importedSheets
          .map(s => `${s.sheetName} → ${s.target}`)
          .join(', ')}).`
      : `No worksheets with valid Folio headers found in "${workbook.fileName}".`;

  return {
    data,
    importedSheets,
    skippedSheets,
    validation,
    summary
  };
}

/**
 * Generates an Excel (.xlsx) binary ArrayBuffer for either a single section or a complete 15-sheet Folio workbook.
 */
export function exportFolioToXlsxBuffer(
  data: FolioData,
  section: ImportTargetSection | 'all-sheets' = 'all-sheets'
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const appendCsvAsSheet = (csvText: string, sheetTitle: string) => {
    const parsed = parseAnyInput(csvText);
    const aoa: (string | number)[][] = [parsed.headers];

    parsed.rows.forEach(r => {
      aoa.push(
        parsed.headers.map(h => {
          const raw = r[h] !== undefined ? r[h] : '';
          if (raw !== '' && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
            return Number(raw);
          }
          return raw;
        })
      );
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = parsed.headers.map(h => ({
      wch: Math.min(38, Math.max(14, h.length + 4))
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle.slice(0, 31));
  };

  if (section === 'all-sheets' || section === 'auto' || section === 'full-json') {
    for (const item of XLSX_WORKBOOK_SHEETS) {
      const csv = FolioDataImporter.exportSectionToCsv(data, item.section);
      appendCsvAsSheet(csv, item.sheetName);
    }
  } else {
    const matched = XLSX_WORKBOOK_SHEETS.find(s => s.section === section);
    const sheetTitle = matched ? matched.sheetName : String(section).slice(0, 31);
    const csv = FolioDataImporter.exportSectionToCsv(data, section);
    appendCsvAsSheet(csv, sheetTitle);
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return out as ArrayBuffer;
}
