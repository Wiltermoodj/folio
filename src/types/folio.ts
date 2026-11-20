/**
 * Folio — TypeScript Schema & Interfaces
 * Defines the exact data structure consumed by index.html across all 10 interactive charts.
 */

export interface FolioSectionMeta {
  id: string;
  num: string;
  short: string;
  folioL: string;
  folioR: string;
}

export interface HeroMatrixGroup {
  name: string;
  count: number;
}

export interface HeroMatrixData {
  total: number;
  region: HeroMatrixGroup[];
  assetSize: HeroMatrixGroup[];
  role: HeroMatrixGroup[];
}

export interface SampleFunctionItem {
  name: string;
  value: number;
  color: string;
  text: string;
}

export interface SampleRegionItem {
  region: string;
  n: number;
  share: number;
  medianBook: number;
}

export interface PriorityComparisonItem {
  item: string;
  y2024: number;
  y2026: number;
}

export interface RiskLimitRegionEntry {
  n: number;
  values: [number, number, number];
}

export interface RiskLimitsData {
  maxAll: number;
  labels: [string, string, string];
  colors: [string, string, string];
  regions: Record<string, RiskLimitRegionEntry>;
}

export interface RegulationPoint {
  year: number;
  value: number;
}

export interface RegulationEvent {
  id: string;
  pos: number;
  date: string;
  short: string;
  title: string;
  summary: string;
  why: string;
}

export interface VolumeSeriesMeta {
  key: string;
  label: string;
  color: string;
}

export interface VolumeYearRecord {
  year: string;
  loans: number;
  green: number;
  scf: number;
  trans: number;
  total: number;
  est: boolean;
  [key: string]: string | number | boolean;
}

export interface VolumeData {
  series: VolumeSeriesMeta[];
  years: VolumeYearRecord[];
}

export interface ExposureRow {
  sector: string;
  vals: number[];
}

export interface ExposureData {
  cols: string[];
  rows: ExposureRow[];
}

export interface WaffleSegmentSplit {
  verified: number;
  estimated: number;
  none: number;
}

export type WaffleData = Record<string, WaffleSegmentSplit>;

export interface LikertItem {
  id: number;
  text: string;
  vals: [number, number, number, number, number];
}

export type MarkerShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hollow';

export interface PricingSectorMeta {
  name: string;
  color: string;
  shape: MarkerShape;
}

export interface PricingDealPoint {
  id: number;
  sector: string;
  score: number;
  bps: number;
}

export interface PricingData {
  sectors: PricingSectorMeta[];
  deals: PricingDealPoint[];
}

export interface OutlookBarsData {
  maxAll: number;
  labels: [string, string, string];
  colors: [string, string, string];
  values: [number, number, number];
}

export interface MarketRecord {
  market: string;
  region: string;
  n: number;
  policy: number;
  share: number;
  bps: number;
  delta: number;
  trend: number[];
}

/**
 * The complete DATA structure consumed by index.html
 */
export interface FolioData {
  sections: FolioSectionMeta[];
  palette: string[];
  heroMatrix: HeroMatrixData;
  sampleFunction: SampleFunctionItem[];
  sampleRegion: SampleRegionItem[];
  priorities: PriorityComparisonItem[];
  riskLimits: RiskLimitsData;
  regulationLine: RegulationPoint[];
  regulationEvents: RegulationEvent[];
  volume: VolumeData;
  exposure: ExposureData;
  waffle: WaffleData;
  likert: LikertItem[];
  pricing: PricingData;
  outlookBars: OutlookBarsData;
  markets: MarketRecord[];
}

/**
 * User-customizable display names for mapped columns across the import wizard,
 * interactive tables, chart axes, filter buttons, tooltips, and report narrative.
 */
export interface ColumnDisplayLabels {
  market: string;
  region: string;
  value: string;
  year: string;
  policy: string;
  bps: string;
  delta: string;
  count: string;
  tier: string;
  segment: string;
  category?: string;
  value_2024?: string;
}

export interface FolioSectionCopy {
  kicker?: string;
  headline: [string, string, string];
  paragraphs: string[];
  chartSubtitle?: string;
  secondaryChartSubtitle?: string;
  figureCaption?: string;
  secondaryFigureCaption?: string;
}

export interface FolioScrollyStepCopy {
  kicker: string;
  title: string;
  body: string;
}

export interface FolioEvidenceStatCopy {
  value: string;
  caption: string;
}

export interface FolioReportNarrative {
  kpiCaptions: [string, string, string, string];
  s01ChartSubtitle: string;
  s01FigureCaption: string;
  s02: FolioSectionCopy;
  s03: FolioSectionCopy;
  s04: FolioSectionCopy & {
    leadStatValue?: string;
    leadStatCaption?: string;
  };
  s05: FolioSectionCopy;
  s06: FolioSectionCopy & {
    scrollySteps: [FolioScrollyStepCopy, FolioScrollyStepCopy, FolioScrollyStepCopy];
  };
  s07: FolioSectionCopy;
  s08: FolioSectionCopy & {
    waffleCalloutTitle: string;
    evidenceStats: [FolioEvidenceStatCopy, FolioEvidenceStatCopy, FolioEvidenceStatCopy];
  };
  s09: FolioSectionCopy;
  s10: FolioSectionCopy & {
    tableHeading: string;
    searchPlaceholder: string;
    entitySingular?: string;
    entityPlural?: string;
  };
}

export interface FolioReportMeta {
  brand: string;
  title: string;
  year: string;
  mastheadNote: string;
  heroHeadline: [string, string, string];
  heroLede: string;
  sourceLabel: string;
  kpiVolumeTrillions: number;
  kpiAdoptionRate: number;
  kpiAdoptionDelta: number;
  contextPrompt?: string;
  columnLabels?: ColumnDisplayLabels;
  narrative?: FolioReportNarrative;
}

export type ImportTargetSection =
  | 'auto'
  | 'full-json'
  | 'master-records'
  | 's01-heroMatrix'
  | 's02a-sampleFunction'
  | 's02b-sampleRegion'
  | 's03-priorities'
  | 's04-riskLimits'
  | 's05a-regulationLine'
  | 's05b-regulationEvents'
  | 's06-volume'
  | 's07-exposure'
  | 's08a-waffle'
  | 's08b-likert'
  | 's09-pricing'
  | 's10a-outlookBars'
  | 's10b-markets';

export interface ColumnMappingConfig {
  marketCol?: string;
  regionCol?: string;
  tierCol?: string;
  segmentCol?: string;
  recordsCol?: string;
  policyCol?: string;
  shareCol?: string;
  bpsCol?: string;
  deltaCol?: string;
  y2024Col?: string;
  y2026Col?: string;
  medianVolumeCol?: string;
  trendCols?: string[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  section: string;
  path: string;
  message: string;
  autoFixed?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    totalRecords: number;
    marketCount: number;
    regionCount: number;
    sectionCount: number;
  };
}

export interface HeaderColumnRequirement {
  key: string;
  label: string;
  required: boolean;
  canonicalNames: string[];
  aliases: RegExp[];
  mappingKey?: keyof ColumnMappingConfig;
}

export interface HeaderMatchDetail {
  key: string;
  label: string;
  matchedHeader: string;
  matchType: 'exact' | 'alias' | 'mapped';
  required: boolean;
}

export interface HeaderMissingDetail {
  key: string;
  label: string;
  expectedExamples: string[];
  suggestedHeader?: string;
}

export interface HeaderValidationResult {
  valid: boolean;
  target: ImportTargetSection;
  detectedHeaders: string[];
  matched: HeaderMatchDetail[];
  missing: HeaderMissingDetail[];
  unrecognizedHeaders: string[];
  summary: string;
}

export type ExportFormatType =
  | 'index-html'
  | 'data-js'
  | 'data-json'
  | 'data-ts'
  | 'section-csv'
  | 'workbook-xlsx';

export interface ParsedXlsxSheet {
  name: string;
  csvText: string;
  headers: string[];
  rows: Record<string, string>[];
  detectedTarget: ImportTargetSection;
  headerValid: boolean;
}

export interface ParsedXlsxWorkbook {
  fileName: string;
  sheetNames: string[];
  sheets: ParsedXlsxSheet[];
  activeSheetName: string;
}

export type RowValidationStatus = 'passed' | 'warning' | 'failed';

export interface RowCellValidationMessage {
  severity: 'error' | 'warning';
  column: string;
  fieldKey: string;
  rawValue: string;
  message: string;
  expectedFormat: string;
  suggestion?: string;
}

export interface RowValidationEntry {
  rowIndex: number; // 1-based data row index
  fileLineNumber: number; // 1-based spreadsheet/CSV line number (header is line 1)
  status: RowValidationStatus;
  primaryLabel: string;
  messages: RowCellValidationMessage[];
  rawRow: Record<string, string>;
}

export interface RowValidationSummary {
  target: ImportTargetSection;
  totalRows: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  errorMessageCount: number;
  warningMessageCount: number;
  rows: RowValidationEntry[];
  summaryText: string;
}

export interface DatasetPreset {
  id: string;
  name: string;
  tagline: string;
  meta: FolioReportMeta;
  data: FolioData;
  sampleMasterCsv: string;
}
