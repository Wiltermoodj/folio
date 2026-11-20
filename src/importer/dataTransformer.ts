import { cloneFolioData, DEFAULT_FOLIO_DATA } from '../data/defaultData';
import type {
  ColumnMappingConfig,
  FolioData,
  HeaderValidationResult,
  ImportTargetSection,
  MarkerShape,
  RowValidationSummary,
  ValidationResult
} from '../types/folio';
import {
  escapeCsvCell,
  parseAnyInput,
  parseNumberArray,
  parseNumeric,
  type ParsedTableResult
} from './csvParser';
import { assertRequiredHeaders, SECTION_HEADER_SPECS, validateCsvHeaders } from './headerValidator';
import {
  filterOutFailedRowsToCsv,
  SAMPLE_VALIDATION_TEST_CSV,
  validateUploadedRows
} from './rowValidator';
import { normalizePercentagesTo100, validateAndNormalizeFolioData } from './schemaValidator';

export {
  assertRequiredHeaders,
  filterOutFailedRowsToCsv,
  SAMPLE_VALIDATION_TEST_CSV,
  SECTION_HEADER_SPECS,
  validateCsvHeaders,
  validateUploadedRows
};

const SERIES_COLORS = [
  'var(--violet)',
  'var(--vermilion)',
  'var(--magenta)',
  'var(--ink)',
  'var(--neutral-data)'
];

const SERIES_TEXT_COLORS = [
  'var(--on-violet)',
  'var(--on-vermilion)',
  'var(--on-magenta)',
  'var(--paper)',
  'var(--ink)'
];

const MARKER_SHAPES: MarkerShape[] = ['circle', 'square', 'triangle', 'diamond', 'hollow'];

function findMatchingHeader(headers: string[], patterns: RegExp[]): string | undefined {
  for (const pat of patterns) {
    const found = headers.find(h => pat.test(h.trim()));
    if (found) return found;
  }
  return undefined;
}

/**
 * Automatically detects column mappings from a list of CSV/TSV/JSON headers.
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMappingConfig {
  const marketCol = findMatchingHeader(headers, [
    /^(market|country|entity|name|city|hub|account|item|title)$/i,
    /(market|country|entity|account|organization)/i
  ]);

  const regionCol = findMatchingHeader(headers, [
    /^(region|geography|geo|continent|zone|area)$/i,
    /(region|geography|zone)/i
  ]);

  const tierCol = findMatchingHeader(headers, [
    /^(tier|asset\s*size|size|scale|cluster|bracket)$/i,
    /(tier|size|scale|bracket)/i
  ]);

  const segmentCol = findMatchingHeader(headers, [
    /^(segment|role|vertical|category|sector|type|function)$/i,
    /(segment|role|sector|vertical|category)/i
  ]);

  const recordsCol = findMatchingHeader(headers, [
    /^(records|n|count|sample|units|workloads|projects|total)$/i,
    /(records|count|\bn\b|units)/i
  ]);

  const policyCol = findMatchingHeader(headers, [
    /^(policy|policy\s*\(%\)|readiness|score|compliance|verified)$/i,
    /(policy|readiness|score|compliance)/i
  ]);

  const shareCol = findMatchingHeader(headers, [
    /^(adoption|adoption\s*2026|share|share\s*\(%\)|value|rate|current|y2026)$/i,
    /(adoption|share|rate|2026|current)/i
  ]);

  const bpsCol = findMatchingHeader(headers, [
    /^(bps|efficiency|efficiency\s*gain|cost|cost\s*index|spread|margin)$/i,
    /(bps|efficiency|cost|index|spread)/i
  ]);

  const deltaCol = findMatchingHeader(headers, [
    /^(delta|delta\s*yoy|change|yoy|pp|growth|shift)$/i,
    /(delta|change|yoy|growth|\bpp\b)/i
  ]);

  const y2024Col = findMatchingHeader(headers, [
    /^(y2024|2024|baseline|prior|prev|start)$/i,
    /(2024|baseline|prior|start)/i
  ]);

  const y2026Col = findMatchingHeader(headers, [
    /^(y2026|2026|latest|target|end|current)$/i,
    /(2026|latest|target|current)/i
  ]);

  const medianVolumeCol = findMatchingHeader(headers, [
    /^(median|median\s*volume|medianbook|book|volume|budget)$/i,
    /(median|volume|book)/i
  ]);

  const trendCols = headers.filter(h => /^(201\d|202\d|q[1-4]|yr\d+|t\d+)$/i.test(h.trim()));

  return {
    marketCol,
    regionCol,
    tierCol,
    segmentCol,
    recordsCol,
    policyCol,
    shareCol,
    bpsCol,
    deltaCol,
    y2024Col,
    y2026Col,
    medianVolumeCol,
    trendCols
  };
}

/**
 * Automatically detects which Folio chart section (or master/full dataset) an input belongs to.
 */
export function autoDetectTargetSection(parsed: ParsedTableResult): ImportTargetSection {
  if (parsed.format === 'folio-json' || parsed.format === 'html-data') {
    return 'full-json';
  }

  const hLower = parsed.headers.map(h => h.toLowerCase().trim());
  const has = (re: RegExp) => hLower.some(h => re.test(h));

  // Check specific section signatures
  if (has(/^(sd|strongly\s*disagree)/) || (has(/statement|text/) && has(/agree/))) {
    return 's08b-likert';
  }
  if (has(/verified/) && has(/estimated/) && has(/none|unverified/)) {
    return 's08a-waffle';
  }
  if (has(/increasing/) && has(/unchanged/) && has(/decreasing/)) {
    return 's04-riskLimits';
  }
  if (has(/expand/) && has(/hold/) && has(/reduce/)) {
    return 's10a-outlookBars';
  }
  if (has(/pos|date/) && has(/short/) && has(/title/) && has(/summary|why/)) {
    return 's05b-regulationEvents';
  }
  if (has(/^year$/) && (has(/loans|core/) || has(/green|cloud/) || has(/scf|analytics/) || hLower.length >= 5) && !has(/market|region/)) {
    return 's06-volume';
  }
  if (has(/^year$/) && hLower.length <= 3) {
    return 's05a-regulationLine';
  }
  if ((has(/y2024|2024|baseline/) && has(/y2026|2026|latest/)) && !has(/market|region/)) {
    return 's03-priorities';
  }
  if (has(/score|readiness/) && has(/bps|cost/) && !has(/policy|delta/)) {
    return 's09-pricing';
  }
  if (has(/median/) && has(/region/) && !has(/market/)) {
    return 's02b-sampleRegion';
  }
  if (has(/sector|category/) && has(/europe|americas|global/) && !has(/market/)) {
    return 's07-exposure';
  }
  if (has(/dimension|group_type/) && has(/count/)) {
    return 's01-heroMatrix';
  }
  if (hLower.length === 2 && has(/category|name|role|function/) && has(/value|share|percent/)) {
    return 's02a-sampleFunction';
  }
  if (has(/market|country|entity/) && has(/region/) && (has(/tier|segment/) || hLower.length >= 8)) {
    return 'master-records';
  }
  if (has(/market|country|entity/)) {
    return 's10b-markets';
  }

  return 'master-records';
}

/**
 * Reusable TypeScript engine that imports raw CSV/TSV/JSON/HTML data and outputs
 * a validated FolioData object in the exact schema used by index.html.
 */
export class FolioDataImporter {
  /**
   * High-level entry point: parses raw text, detects or applies the target section,
   * merges into the active FolioData, validates, and returns the updated dataset.
   */
  public static importFromText(
    rawText: string,
    options: {
      target?: ImportTargetSection;
      mapping?: ColumnMappingConfig;
      baseData?: FolioData;
      autoFix?: boolean;
      strictHeaders?: boolean;
    } = {}
  ): {
    data: FolioData;
    detectedTarget: ImportTargetSection;
    parsed: ParsedTableResult;
    headerValidation: HeaderValidationResult;
    rowValidation: RowValidationSummary;
    validation: ValidationResult;
    summary: string;
  } {
    const base = cloneFolioData(options.baseData || DEFAULT_FOLIO_DATA);
    const parsed = parseAnyInput(rawText);
    const detectedTarget =
      !options.target || options.target === 'auto'
        ? autoDetectTargetSection(parsed)
        : options.target;

    // 1. Full JSON or HTML DATA extraction
    if (
      detectedTarget === 'full-json' ||
      parsed.format === 'folio-json' ||
      parsed.format === 'html-data'
    ) {
      const merged = { ...base, ...(parsed.rawJson as Partial<FolioData>) };
      const { data, validation } = validateAndNormalizeFolioData(merged, {
        autoFix: options.autoFix !== false,
        baseData: base
      });
      const headerValidation = validateCsvHeaders(parsed.headers, 'full-json');
      const rowValidation = validateUploadedRows(parsed, 'full-json');
      return {
        data,
        detectedTarget: 'full-json',
        parsed,
        headerValidation,
        rowValidation,
        validation,
        summary: `Imported complete Folio DATA structure (${data.heroMatrix.total} records, ${data.markets.length} markets).`
      };
    }

    const mapping = options.mapping || autoDetectColumnMapping(parsed.headers);
    const headerValidation = validateCsvHeaders(parsed.headers, detectedTarget, mapping);
    const rowValidation = validateUploadedRows(parsed, detectedTarget, mapping);
    const rows = parsed.rows;

    // 2. Pre-transformation CSV Header Validation Gate
    if (!headerValidation.valid && options.strictHeaders !== false) {
      const { data, validation } = validateAndNormalizeFolioData(base, { baseData: base });
      headerValidation.missing.forEach(miss => {
        validation.issues.unshift({
          severity: 'error',
          section: `CSV Header Validation (${detectedTarget})`,
          path: `header.${miss.key}`,
          message: `Missing required column '${miss.key}' (${miss.label}). Expected ${miss.expectedExamples
            .map(e => `"${e}"`)
            .join(' or ')}${
            miss.suggestedHeader ? ` — closest detected header: "${miss.suggestedHeader}"` : ''
          }.`,
          autoFixed: false
        });
      });
      validation.valid = false;
      return {
        data,
        detectedTarget,
        parsed,
        headerValidation,
        rowValidation,
        validation,
        summary: headerValidation.summary
      };
    }

    if (rows.length === 0) {
      const { data, validation } = validateAndNormalizeFolioData(base, { baseData: base });
      return {
        data,
        detectedTarget,
        parsed,
        headerValidation,
        rowValidation,
        validation,
        summary: 'No data rows found in input.'
      };
    }

    let working = cloneFolioData(base);
    let summary = '';

    switch (detectedTarget) {
      case 'master-records': {
        working = FolioDataImporter.transformMasterRecords(rows, parsed.headers, mapping, base);
        summary = `Synthesized all 10 Folio chart datasets from ${rows.length} master records.`;
        break;
      }

      case 's01-heroMatrix': {
        working.heroMatrix = FolioDataImporter.transformHeroMatrix(rows, parsed.headers, base.heroMatrix);
        summary = `Updated Section 01 Hero Unit Matrix (${working.heroMatrix.total} total records).`;
        break;
      }

      case 's02a-sampleFunction': {
        const nameKey = mapping.marketCol || parsed.headers[0];
        const valKey = mapping.shareCol || parsed.headers[1];
        const rawItems = rows.map(r => ({
          name: r[nameKey] || 'Category',
          value: parseNumeric(r[valKey], 10)
        }));
        const norm = normalizePercentagesTo100(rawItems.map(i => i.value));
        working.sampleFunction = rawItems.map((item, idx) => ({
          name: item.name,
          value: norm[idx],
          color: SERIES_COLORS[idx % SERIES_COLORS.length],
          text: SERIES_TEXT_COLORS[idx % SERIES_TEXT_COLORS.length]
        }));
        summary = `Updated Section 02A 100% Stacked Bar (${working.sampleFunction.length} categories).`;
        break;
      }

      case 's02b-sampleRegion': {
        const regKey = mapping.regionCol || parsed.headers[0];
        const nKey = mapping.recordsCol || parsed.headers[1];
        const shareKey = mapping.shareCol || parsed.headers[2];
        const medKey = mapping.medianVolumeCol || parsed.headers[3] || parsed.headers[2];
        const totalN = rows.reduce((a, r) => a + Math.max(1, parseNumeric(r[nKey], 10)), 0) || 1;
        working.sampleRegion = rows.map(r => {
          const n = Math.max(1, Math.round(parseNumeric(r[nKey], 20)));
          const calcShare = Number(((n / totalN) * 100).toFixed(1));
          return {
            region: r[regKey] || 'Region',
            n,
            share: shareKey && r[shareKey] ? Number(parseNumeric(r[shareKey], calcShare).toFixed(1)) : calcShare,
            medianBook: Number(parseNumeric(r[medKey], 25).toFixed(1))
          };
        });
        summary = `Updated Section 02B Regional Summary Table (${working.sampleRegion.length} regions).`;
        break;
      }

      case 's03-priorities': {
        const itemKey = mapping.marketCol || parsed.headers[0];
        const y24Key = mapping.y2024Col || parsed.headers[1];
        const y26Key = mapping.y2026Col || parsed.headers[2] || parsed.headers[1];
        working.priorities = rows.map((r, idx) => ({
          item: r[itemKey] || `Initiative ${idx + 1}`,
          y2024: Math.round(parseNumeric(r[y24Key], 25)),
          y2026: Math.round(parseNumeric(r[y26Key], 50))
        }));
        summary = `Updated Section 03 Dumbbell Rankings (${working.priorities.length} items).`;
        break;
      }

      case 's04-riskLimits': {
        const regKey = mapping.regionCol || parsed.headers[0];
        const incKey = findMatchingHeader(parsed.headers, [/inc/i]) || parsed.headers[1];
        const uncKey = findMatchingHeader(parsed.headers, [/unch|hold|steady/i]) || parsed.headers[2];
        const decKey = findMatchingHeader(parsed.headers, [/dec|red/i]) || parsed.headers[3];
        const nKey = findMatchingHeader(parsed.headers, [/^n$|records|count/i]) || parsed.headers[4];
        const regions: FolioData['riskLimits']['regions'] = {};
        let maxAll = 50;
        rows.forEach(r => {
          const name = r[regKey] || 'Global';
          const norm = normalizePercentagesTo100([
            parseNumeric(r[incKey], 20),
            parseNumeric(r[uncKey], 60),
            parseNumeric(r[decKey], 20)
          ]);
          maxAll = Math.max(maxAll, ...norm);
          regions[name] = {
            n: Math.max(1, Math.round(parseNumeric(nKey ? r[nKey] : 100, 100))),
            values: [norm[0], norm[1], norm[2]]
          };
        });
        working.riskLimits = {
          ...base.riskLimits,
          maxAll,
          regions
        };
        summary = `Updated Section 04 Filtered KPI Bars (${Object.keys(regions).length} regions).`;
        break;
      }

      case 's05a-regulationLine': {
        const yrKey = findMatchingHeader(parsed.headers, [/year|date|period/i]) || parsed.headers[0];
        const valKey = findMatchingHeader(parsed.headers, [/val|adopt|rate|share/i]) || parsed.headers[1];
        working.regulationLine = rows.map((r, idx) => ({
          year: Math.round(parseNumeric(r[yrKey], 2021 + idx)),
          value: Math.round(parseNumeric(r[valKey], 25 + idx * 6))
        }));
        summary = `Updated Section 05A Trajectory Line (${working.regulationLine.length} points).`;
        break;
      }

      case 's05b-regulationEvents': {
        working.regulationEvents = rows.map((r, idx) => ({
          id: r.id || `ev-${idx + 1}`,
          pos: parseNumeric(r.pos || r.year, 2021.8 + idx * 0.6),
          date: r.date || `202${Math.min(6, 1 + idx)}`,
          short: r.short || r.label || `Event ${idx + 1}`,
          title: r.title || r.short || `Milestone ${idx + 1}`,
          summary: r.summary || r.description || 'Milestone detail summary.',
          why: r.why || r.note || 'Milestone impact annotation.'
        }));
        summary = `Updated Section 05B Timeline Milestones (${working.regulationEvents.length} events).`;
        break;
      }

      case 's06-volume': {
        const yrKey = findMatchingHeader(parsed.headers, [/year|period/i]) || parsed.headers[0];
        const estKey = findMatchingHeader(parsed.headers, [/^est|estimate|forecast/i]);
        const valueHeaders = parsed.headers.filter(
          h => h !== yrKey && h !== estKey && !/^total$/i.test(h.trim())
        );
        const seriesKeys = ['loans', 'green', 'scf', 'trans'];
        const series = valueHeaders.slice(0, 4).map((h, idx) => ({
          key: seriesKeys[idx] || `s${idx}`,
          label: h.replace(/\s*\(\$bn\)\s*/i, '').trim(),
          color: SERIES_COLORS[idx % SERIES_COLORS.length]
        }));
        const years = rows.map((r, idx) => {
          const yStr = String(r[yrKey] || `${2019 + idx}`);
          const est = estKey
            ? /^(true|1|yes|est)/i.test(String(r[estKey]))
            : yStr.toLowerCase().endsWith('e');
          const rec: Record<string, string | number | boolean> = {
            year: yStr,
            loans: 0,
            green: 0,
            scf: 0,
            trans: 0,
            total: 0,
            est
          };
          let sum = 0;
          series.forEach((s, sIdx) => {
            const v = Math.max(0, Math.round(parseNumeric(r[valueHeaders[sIdx]], 0)));
            rec[s.key] = v;
            sum += v;
          });
          rec.total = sum;
          return rec as FolioData['volume']['years'][number];
        });
        working.volume = { series, years };
        summary = `Updated Section 06 Scrollytelling Columns (${years.length} periods, ${series.length} series).`;
        break;
      }

      case 's07-exposure': {
        const secKey = parsed.headers[0];
        const colHeaders = parsed.headers.slice(1).map(h => h.replace(/\s*\(%\)\s*/i, '').trim());
        const cols = colHeaders.length >= 2 ? colHeaders : base.exposure.cols;
        const expRows = rows.map((r, idx) => ({
          sector: r[secKey] || `Category ${idx + 1}`,
          vals: parsed.headers
            .slice(1)
            .map(h => Math.min(100, Math.max(0, Math.round(parseNumeric(r[h], 25)))))
        }));
        working.exposure = { cols, rows: expRows };
        summary = `Updated Section 07 Heatmap Matrix (${expRows.length}×${cols.length}).`;
        break;
      }

      case 's08a-waffle': {
        const segKey = parsed.headers[0];
        const verKey = findMatchingHeader(parsed.headers, [/ver/i]) || parsed.headers[1];
        const estKey = findMatchingHeader(parsed.headers, [/est|prox/i]) || parsed.headers[2];
        const nonKey = findMatchingHeader(parsed.headers, [/none|unver/i]) || parsed.headers[3];
        const waffle: FolioData['waffle'] = {};
        rows.forEach(r => {
          const name = r[segKey] || 'All';
          const norm = normalizePercentagesTo100([
            parseNumeric(r[verKey], 25),
            parseNumeric(r[estKey], 40),
            parseNumeric(r[nonKey], 35)
          ]);
          waffle[name] = { verified: norm[0], estimated: norm[1], none: norm[2] };
        });
        working.waffle = waffle;
        summary = `Updated Section 08A Proportion Waffle (${Object.keys(waffle).length} segments).`;
        break;
      }

      case 's08b-likert': {
        const txtKey = parsed.headers[0];
        const valCols = parsed.headers.slice(1, 6);
        working.likert = rows.map((r, idx) => {
          const rawV = [0, 1, 2, 3, 4].map(i => parseNumeric(r[valCols[i]], 20));
          const norm = normalizePercentagesTo100(rawV);
          return {
            id: idx + 1,
            text: r[txtKey] || `Statement ${idx + 1}`,
            vals: [norm[0], norm[1], norm[2], norm[3], norm[4]]
          };
        });
        summary = `Updated Section 08B Diverging Likert Bars (${working.likert.length} statements).`;
        break;
      }

      case 's09-pricing': {
        const secKey =
          findMatchingHeader(parsed.headers, [/sector|category|group|segment/i]) || parsed.headers[1] || parsed.headers[0];
        const scoreKey =
          findMatchingHeader(parsed.headers, [/score|readiness|x|policy/i]) || parsed.headers[2] || parsed.headers[1];
        const bpsKey =
          findMatchingHeader(parsed.headers, [/bps|cost|index|y/i]) || parsed.headers[3] || parsed.headers[2];
        const deals = rows.map((r, idx) => ({
          id: idx + 1,
          sector: r[secKey] || 'General',
          score: Math.min(100, Math.max(0, Math.round(parseNumeric(r[scoreKey], 50)))),
          bps: Math.max(1, Math.round(parseNumeric(r[bpsKey], 150)))
        }));
        const uniqueSectors = Array.from(new Set(deals.map(d => d.sector))).slice(0, 5);
        const sectors = uniqueSectors.map((name, idx) => ({
          name,
          color: idx === 4 ? 'var(--ink-3)' : SERIES_COLORS[idx % SERIES_COLORS.length],
          shape: MARKER_SHAPES[idx % MARKER_SHAPES.length]
        }));
        working.pricing = { sectors, deals };
        summary = `Updated Section 09 Scatter & Regression (${deals.length} points across ${sectors.length} categories).`;
        break;
      }

      case 's10a-outlookBars': {
        const lblKey = parsed.headers[0];
        const valKey = parsed.headers[1];
        const labels = rows.slice(0, 3).map((r, i) => r[lblKey] || base.outlookBars.labels[i]);
        while (labels.length < 3) labels.push(base.outlookBars.labels[labels.length]);
        const rawVals = rows.slice(0, 3).map(r => parseNumeric(r[valKey], 33));
        while (rawVals.length < 3) rawVals.push(33);
        const norm = normalizePercentagesTo100(rawVals);
        working.outlookBars = {
          maxAll: Math.max(50, ...norm),
          labels: [labels[0], labels[1], labels[2]],
          colors: base.outlookBars.colors,
          values: [norm[0], norm[1], norm[2]]
        };
        summary = `Updated Section 10A Scenario Outlook Bars (${norm.join('% / ')}%).`;
        break;
      }

      case 's10b-markets': {
        working.markets = FolioDataImporter.transformMarketsRows(rows, parsed.headers, mapping);
        summary = `Updated Section 10B Market Index Table (${working.markets.length} markets).`;
        break;
      }
    }

    const { data, validation } = validateAndNormalizeFolioData(working, {
      autoFix: options.autoFix !== false,
      baseData: base
    });

    return {
      data,
      detectedTarget,
      parsed,
      headerValidation,
      rowValidation,
      validation,
      summary
    };
  }

  /**
   * Transforms a master market/cohort table into a cohesive FolioData object
   * across Hero Matrix, Regional Breakdown, Risk Limits, Scatter Plot, and Markets Table.
   */
  public static transformMasterRecords(
    rows: Record<string, string>[],
    headers: string[],
    mapping: ColumnMappingConfig,
    base: FolioData
  ): FolioData {
    const out = cloneFolioData(base);
    const markets = FolioDataImporter.transformMarketsRows(rows, headers, mapping);
    if (markets.length === 0) return out;

    out.markets = markets;

    // Aggregate by region
    const regionMap = new Map<string, { n: number; shares: number[]; policies: number[]; deltas: number[] }>();
    const tierMap = new Map<string, number>();
    const segMap = new Map<string, number>();

    let totalRecords = 0;
    rows.forEach((r, idx) => {
      const m = markets[idx];
      totalRecords += m.n;
      const reg = m.region || 'Global';
      const entry = regionMap.get(reg) || { n: 0, shares: [], policies: [], deltas: [] };
      entry.n += m.n;
      entry.shares.push(m.share);
      entry.policies.push(m.policy);
      entry.deltas.push(m.delta);
      regionMap.set(reg, entry);

      if (mapping.tierCol && r[mapping.tierCol]) {
        const t = r[mapping.tierCol];
        tierMap.set(t, (tierMap.get(t) || 0) + m.n);
      }
      if (mapping.segmentCol && r[mapping.segmentCol]) {
        const s = r[mapping.segmentCol];
        segMap.set(s, (segMap.get(s) || 0) + m.n);
      }
    });

    // Update Hero Matrix
    const regionGroups = Array.from(regionMap.entries()).map(([name, obj]) => ({
      name,
      count: obj.n
    }));

    const tierGroups =
      tierMap.size > 0
        ? Array.from(tierMap.entries()).map(([name, count]) => ({ name, count }))
        : out.heroMatrix.assetSize;

    const roleGroups =
      segMap.size > 0
        ? Array.from(segMap.entries()).map(([name, count]) => ({ name, count }))
        : out.heroMatrix.role;

    out.heroMatrix = {
      total: totalRecords,
      region: regionGroups,
      assetSize: tierGroups,
      role: roleGroups
    };

    // Update Section 02A sampleFunction if segment/role groups exist
    if (segMap.size >= 2) {
      const segEntries = Array.from(segMap.entries());
      const norm = normalizePercentagesTo100(segEntries.map(([, c]) => c));
      out.sampleFunction = segEntries.slice(0, 5).map(([name], idx) => ({
        name,
        value: norm[idx],
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        text: SERIES_TEXT_COLORS[idx % SERIES_TEXT_COLORS.length]
      }));
    }

    // Update Section 02B sampleRegion
    out.sampleRegion = Array.from(regionMap.entries()).map(([region, obj]) => {
      const avgPolicy = obj.policies.reduce((a, b) => a + b, 0) / (obj.policies.length || 1);
      const avgShare = obj.shares.reduce((a, b) => a + b, 0) / (obj.shares.length || 1);
      return {
        region,
        n: obj.n,
        share: Number(((obj.n / (totalRecords || 1)) * 100).toFixed(1)),
        medianBook: Number(((avgPolicy * 0.45 + avgShare * 0.8)).toFixed(1))
      };
    });

    // Update Section 04 riskLimits by region
    const rlRegions: FolioData['riskLimits']['regions'] = {};
    let maxBar = 55;
    let globalIncSum = 0;
    let globalHoldSum = 0;
    let globalDecSum = 0;

    for (const [region, obj] of regionMap.entries()) {
      const avgShare = obj.shares.reduce((a, b) => a + b, 0) / (obj.shares.length || 1);
      const avgDelta = obj.deltas.reduce((a, b) => a + b, 0) / (obj.deltas.length || 1);
      const rawInc = Math.max(8, Math.round(avgShare * 0.7 + avgDelta * 2.2));
      const rawHold = Math.max(25, Math.round(62 - avgDelta * 1.4));
      const rawDec = Math.max(5, 100 - rawInc - rawHold);
      const norm = normalizePercentagesTo100([rawInc, rawHold, rawDec]);
      maxBar = Math.max(maxBar, ...norm);
      rlRegions[region] = {
        n: obj.n,
        values: [norm[0], norm[1], norm[2]]
      };
      globalIncSum += norm[0] * obj.n;
      globalHoldSum += norm[1] * obj.n;
      globalDecSum += norm[2] * obj.n;
    }

    const gNorm = normalizePercentagesTo100([globalIncSum, globalHoldSum, globalDecSum]);
    maxBar = Math.max(maxBar, ...gNorm);
    rlRegions.Global = {
      n: totalRecords,
      values: [gNorm[0], gNorm[1], gNorm[2]]
    };

    out.riskLimits = {
      ...out.riskLimits,
      maxAll: maxBar,
      regions: {
        Global: rlRegions.Global,
        ...Object.fromEntries(Object.entries(rlRegions).filter(([k]) => k !== 'Global'))
      }
    };

    // Update Section 05A regulationLine from average 2021..2026 trend across markets
    if (markets[0] && markets[0].trend.length === 6) {
      out.regulationLine = [2021, 2022, 2023, 2024, 2025, 2026].map((year, tIdx) => {
        const weighted =
          markets.reduce((acc, m) => acc + (m.trend[tIdx] || 0) * m.n, 0) / (totalRecords || 1);
        return {
          year,
          value: Math.min(100, Math.max(1, Math.round(weighted * 2.4)))
        };
      });
    }

    // Update Section 09 Scatter plot points from imported records
    if (markets.length >= 4) {
      const groupNames = Array.from(new Set(markets.map(m => m.region))).slice(0, 5);
      const sectors = groupNames.map((name, idx) => ({
        name,
        color: idx === 4 ? 'var(--ink-3)' : SERIES_COLORS[idx % SERIES_COLORS.length],
        shape: MARKER_SHAPES[idx % MARKER_SHAPES.length]
      }));
      const deals = markets.map((m, idx) => ({
        id: idx + 1,
        sector: m.region,
        score: m.policy,
        bps: Math.max(60, Math.round(220 - m.policy * 1.15 - m.bps * 0.8))
      }));
      out.pricing = { sectors, deals };
    }

    return out;
  }

  public static transformMarketsRows(
    rows: Record<string, string>[],
    headers: string[],
    mapping: ColumnMappingConfig
  ): FolioData['markets'] {
    const mCol = mapping.marketCol || headers[0];
    const rCol = mapping.regionCol || headers[1];
    const nCol = mapping.recordsCol || headers[2];
    const pCol = mapping.policyCol || headers[3];
    const sCol = mapping.shareCol || headers[4];
    const bCol = mapping.bpsCol || headers[5];
    const dCol = mapping.deltaCol || headers[6];
    const trendCols =
      mapping.trendCols && mapping.trendCols.length >= 2
        ? mapping.trendCols
        : headers.filter(h => /^(202\d|t\d+)$/i.test(h.trim()));
    const singleTrendCol = findMatchingHeader(headers, [/trend|sparkline|history/i]);

    return rows.map((r, idx) => {
      const share = Number(parseNumeric(sCol ? r[sCol] : 15, 15).toFixed(1));
      const delta = Number(parseNumeric(dCol ? r[dCol] : 3.2, 3.2).toFixed(1));
      let trend: number[] = [];
      if (trendCols.length >= 2) {
        trend = trendCols.slice(0, 6).map(c => Number(parseNumeric(r[c], share).toFixed(1)));
      } else if (singleTrendCol && r[singleTrendCol]) {
        trend = parseNumberArray(r[singleTrendCol], 6);
      }
      if (trend.length < 2) {
        const start = Math.max(0.5, Number((share - delta * 2.5).toFixed(1)));
        trend = [0, 1, 2, 3, 4, 5].map(step =>
          Number((start + ((share - start) * step) / 5).toFixed(1))
        );
      }
      return {
        market: r[mCol] || `Market ${idx + 1}`,
        region: (rCol && r[rCol]) || 'Global',
        n: Math.max(1, Math.round(parseNumeric(nCol ? r[nCol] : 20, 20))),
        policy: Math.min(100, Math.max(0, Math.round(parseNumeric(pCol ? r[pCol] : 72, 72)))),
        share,
        bps: Math.round(parseNumeric(bCol ? r[bCol] : 10, 10)),
        delta,
        trend
      };
    });
  }

  public static transformHeroMatrix(
    rows: Record<string, string>[],
    headers: string[],
    fallback: FolioData['heroMatrix']
  ): FolioData['heroMatrix'] {
    const dimCol = findMatchingHeader(headers, [/dimension|group|type/i]) || headers[0];
    const nameCol = findMatchingHeader(headers, [/name|category|label/i]) || headers[1] || headers[0];
    const countCol = findMatchingHeader(headers, [/count|n|records|value/i]) || headers[2] || headers[1];

    const region: { name: string; count: number }[] = [];
    const assetSize: { name: string; count: number }[] = [];
    const role: { name: string; count: number }[] = [];

    rows.forEach(r => {
      const dim = (r[dimCol] || '').toLowerCase();
      const name = r[nameCol] || 'Category';
      const count = Math.max(1, Math.round(parseNumeric(r[countCol], 25)));
      if (dim.includes('tier') || dim.includes('asset') || dim.includes('size')) {
        assetSize.push({ name, count });
      } else if (dim.includes('role') || dim.includes('segment')) {
        role.push({ name, count });
      } else {
        region.push({ name, count });
      }
    });

    const finalRegion = region.length > 0 ? region : fallback.region;
    const total = finalRegion.reduce((a, g) => a + g.count, 0);

    return {
      total,
      region: finalRegion,
      assetSize: assetSize.length > 0 ? assetSize : fallback.assetSize,
      role: role.length > 0 ? role : fallback.role
    };
  }

  /**
   * Exports any section of FolioData to a clean, round-trip CSV string.
   */
  public static exportSectionToCsv(data: FolioData, section: ImportTargetSection): string {
    const lines: string[] = [];
    const row = (cells: unknown[]) => lines.push(cells.map(escapeCsvCell).join(','));

    switch (section) {
      case 's01-heroMatrix': {
        row(['Dimension', 'Name', 'Count']);
        data.heroMatrix.region.forEach(g => row(['region', g.name, g.count]));
        data.heroMatrix.assetSize.forEach(g => row(['assetSize', g.name, g.count]));
        data.heroMatrix.role.forEach(g => row(['role', g.name, g.count]));
        break;
      }
      case 's02a-sampleFunction': {
        row(['Category', 'Share (%)']);
        data.sampleFunction.forEach(i => row([i.name, i.value]));
        break;
      }
      case 's02b-sampleRegion': {
        row(['Region', 'Records', 'Share (%)', 'Median volume ($bn)']);
        data.sampleRegion.forEach(r => row([r.region, r.n, r.share, r.medianBook]));
        break;
      }
      case 's03-priorities': {
        row(['Initiative', '2024 (%)', '2026 (%)']);
        data.priorities.forEach(p => row([p.item, p.y2024, p.y2026]));
        break;
      }
      case 's04-riskLimits': {
        row(['Region', `${data.riskLimits.labels[0]} (%)`, `${data.riskLimits.labels[1]} (%)`, `${data.riskLimits.labels[2]} (%)`, 'n']);
        for (const [reg, obj] of Object.entries(data.riskLimits.regions)) {
          row([reg, obj.values[0], obj.values[1], obj.values[2], obj.n]);
        }
        break;
      }
      case 's05a-regulationLine': {
        row(['Year', 'Adoption (%)']);
        data.regulationLine.forEach(p => row([p.year, p.value]));
        break;
      }
      case 's05b-regulationEvents': {
        row(['id', 'pos', 'date', 'short', 'title', 'summary', 'why']);
        data.regulationEvents.forEach(e =>
          row([e.id, Number(e.pos.toFixed(3)), e.date, e.short, e.title, e.summary, e.why])
        );
        break;
      }
      case 's06-volume': {
        row(['Year', ...data.volume.series.map(s => `${s.label} ($bn)`), 'est']);
        data.volume.years.forEach(yr =>
          row([yr.year, ...data.volume.series.map(s => yr[s.key]), yr.est])
        );
        break;
      }
      case 's07-exposure': {
        row(['Category', ...data.exposure.cols]);
        data.exposure.rows.forEach(r => row([r.sector, ...r.vals]));
        break;
      }
      case 's08a-waffle': {
        row(['Segment', 'Verified (%)', 'Estimated (%)', 'Unverified (%)']);
        for (const [seg, v] of Object.entries(data.waffle)) {
          row([seg, v.verified, v.estimated, v.none]);
        }
        break;
      }
      case 's08b-likert': {
        row(['Statement', 'SD (%)', 'D (%)', 'N (%)', 'A (%)', 'SA (%)']);
        data.likert.forEach(l => row([l.text, ...l.vals]));
        break;
      }
      case 's09-pricing': {
        row(['id', 'Sector', 'Readiness score', 'Cost index']);
        data.pricing.deals.forEach(d => row([d.id, d.sector, d.score, d.bps]));
        break;
      }
      case 's10a-outlookBars': {
        row(['Scenario', 'Share (%)']);
        data.outlookBars.labels.forEach((l, idx) => row([l, data.outlookBars.values[idx]]));
        break;
      }
      case 's10b-markets':
      case 'master-records':
      default: {
        row([
          'Market',
          'Region',
          'Records',
          'Policy (%)',
          'Adoption 2026 (%)',
          'Efficiency gain (bps)',
          'Delta YoY (pp)',
          '2021',
          '2022',
          '2023',
          '2024',
          '2025',
          '2026'
        ]);
        data.markets.forEach(m =>
          row([
            m.market,
            m.region,
            m.n,
            m.policy,
            m.share,
            m.bps,
            m.delta,
            ...(m.trend.length >= 6 ? m.trend.slice(0, 6) : [m.trend[0] || 5, 7, 9, 11, 13, m.share])
          ])
        );
        break;
      }
    }

    return lines.join('\n');
  }
}
