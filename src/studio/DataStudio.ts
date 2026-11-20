import {
  cloneFolioData,
  cloneReportMeta,
  DATASET_PRESETS,
  DEFAULT_FOLIO_DATA,
  DEFAULT_REPORT_META
} from '../data/defaultData';
import {
  formatFolioDataAsJsBlock,
  formatFolioDataAsJson,
  formatFolioDataAsTypeScript,
  generateStandaloneIndexHtml
} from '../exporter/folioExporter';
import { parseAnyInput } from '../importer/csvParser';
import {
  autoDetectColumnMapping,
  autoDetectTargetSection,
  filterOutFailedRowsToCsv,
  FolioDataImporter,
  SAMPLE_VALIDATION_TEST_CSV,
  validateCsvHeaders,
  validateUploadedRows
} from '../importer/dataTransformer';
import {
  adoptCsvHeadersAsDisplayLabels,
  cloneColumnLabels,
  DEFAULT_COLUMN_DISPLAY_LABELS,
  requestAiReportSynthesis,
  synthesizeThematicReportMeta
} from '../importer/reportSynthesizer';
import { validateAndNormalizeFolioData } from '../importer/schemaValidator';
import {
  exportFolioToXlsxBuffer,
  importAllXlsxSheets,
  isExcelFileName,
  parseXlsxBuffer,
  XLSX_WORKBOOK_SHEETS
} from '../importer/xlsxParser';
import type {
  ColumnDisplayLabels,
  ColumnMappingConfig,
  ExportFormatType,
  FolioData,
  FolioReportMeta,
  ImportTargetSection,
  ParsedXlsxWorkbook,
  RowValidationStatus,
  RowValidationSummary
} from '../types/folio';

import type {
  D3SparklineOptions,
  SparklineTooltipController
} from '../charts/d3MarketSparkline';

export type MarketSparklineRenderer = (
  record: FolioData['markets'][number],
  options?: D3SparklineOptions
) => HTMLElement;

export interface FolioDashboardBridge {
  getData: () => FolioData;
  getMeta: () => FolioReportMeta;
  setData: (data: FolioData, meta?: FolioReportMeta) => void;
  getTemplateHtml: () => string;
  getTooltipController?: () => SparklineTooltipController | null;
  setSparklineRenderer?: (renderer: MarketSparklineRenderer) => void;
  refreshMarketTable?: () => void;
}

declare global {
  interface Window {
    FolioApp?: FolioDashboardBridge;
    __FOLIO_CUSTOM_DATA__?: FolioData;
    __FOLIO_CUSTOM_META__?: FolioReportMeta;
  }
}

const STORAGE_DATA_KEY = 'folio.customData.v1';
const STORAGE_META_KEY = 'folio.customMeta.v1';

const SECTION_TARGETS: { id: ImportTargetSection; label: string; badge: string; desc: string }[] = [
  {
    id: 'auto',
    label: 'Auto-Detect Format & Section',
    badge: 'AUTO',
    desc: 'Inspects headers or JSON keys to automatically route data to the right chart or all 10 sections.'
  },
  {
    id: 'master-records',
    label: 'Master Dataset (Populates All Charts)',
    badge: 'ALL 10',
    desc: 'Imports a market/cohort table and automatically aggregates Hero Matrix, Regions, KPIs, Scatter & Table.'
  },
  {
    id: 'full-json',
    label: 'Full Folio DATA Object (JSON / JS / HTML)',
    badge: 'DATA',
    desc: 'Imports a complete or partial Folio DATA JSON object or extracts const DATA = {...} from an HTML file.'
  },
  {
    id: 's01-heroMatrix',
    label: '01 — Hero Unit Matrix Groups',
    badge: 'FIG 01',
    desc: 'Dimension (region / assetSize / role), group name, and record count.'
  },
  {
    id: 's02a-sampleFunction',
    label: '02A — 100% Stacked Bar Composition',
    badge: 'FIG 02A',
    desc: 'Category name and percentage share (auto-normalized to 100%).'
  },
  {
    id: 's02b-sampleRegion',
    label: '02B — Sortable Regional Breakdown Table',
    badge: 'FIG 02B',
    desc: 'Region name, record count (n), share (%), and median volume ($bn).'
  },
  {
    id: 's03-priorities',
    label: '03 — Dumbbell Period Comparison (2024 vs 2026)',
    badge: 'FIG 03',
    desc: 'Initiative/category name, baseline percentage (2024), and latest percentage (2026).'
  },
  {
    id: 's04-riskLimits',
    label: '04 — Filtered Regional KPI Bars',
    badge: 'FIG 04',
    desc: 'Region name, Increasing (%), Unchanged (%), Decreasing (%), and sample size (n).'
  },
  {
    id: 's05a-regulationLine',
    label: '05A — Scroll-Drawn Trajectory Line',
    badge: 'FIG 05A',
    desc: 'Year and adoption trajectory percentage.'
  },
  {
    id: 's05b-regulationEvents',
    label: '05B — Interactive Milestone Timeline Events',
    badge: 'FIG 05B',
    desc: 'Milestone ID, decimal year position (pos), display date, short label, title, summary, and note.'
  },
  {
    id: 's06-volume',
    label: '06 — Scrollytelling Stacked Volume Columns',
    badge: 'FIG 06',
    desc: 'Year, 4 data series columns ($bn), and boolean estimate flag (est).'
  },
  {
    id: 's07-exposure',
    label: '07 — Interactive 10×5 Matrix Heatmap',
    badge: 'FIG 07',
    desc: 'Category row label followed by intensity percentages for each geographic column.'
  },
  {
    id: 's08a-waffle',
    label: '08A — 10×10 Proportion Waffle Chart',
    badge: 'FIG 08A',
    desc: 'Segment name (All, Small, Mid-market, Enterprise) and Verified / Estimated / Unverified percentages.'
  },
  {
    id: 's08b-likert',
    label: '08B — Diverging 5-Point Likert Sentiment',
    badge: 'FIG 08B',
    desc: 'Survey statement text and 5 response percentages: SD, D, N, A, SA.'
  },
  {
    id: 's09-pricing',
    label: '09 — Scatter Plot & Live OLS Regression',
    badge: 'FIG 09',
    desc: 'Record ID, category/sector name, readiness score (x: 0–100), and cost index (y: bps).'
  },
  {
    id: 's10a-outlookBars',
    label: '10A — Forward Projection Rotated Bars',
    badge: 'FIG 10A',
    desc: 'Three scenario labels (Expand, Hold, Reduce) and percentage shares.'
  },
  {
    id: 's10b-markets',
    label: '10B — Searchable Market Index Table & Sparklines',
    badge: 'FIG 10B',
    desc: 'Market name, region, records (n), policy (%), adoption 2026 (%), bps, YoY delta, and 2021–2026 trend.'
  }
];

export class FolioDataStudio {
  private bridge: FolioDashboardBridge;
  private activeTab: 'import' | 'editor' | 'validate' | 'export' = 'import';
  private selectedTarget: ImportTargetSection = 'auto';
  private editorSection: ImportTargetSection = 's10b-markets';
  private exportFormat: ExportFormatType = 'data-js';
  private exportCsvSection: ImportTargetSection = 's10b-markets';
  private exportXlsxScope: ImportTargetSection | 'all-sheets' = 'all-sheets';
  private rawInputText: string = '';
  private currentMapping: ColumnMappingConfig = {};
  private customColumnLabels: ColumnDisplayLabels = cloneColumnLabels(DEFAULT_COLUMN_DISPLAY_LABELS);
  private contextPrompt: string = DEFAULT_REPORT_META.contextPrompt || '';
  private editingLabelKey: keyof ColumnDisplayLabels | null = null;
  private isAiSynthesizing: boolean = false;
  private loadedWorkbook: ParsedXlsxWorkbook | null = null;
  private rowFilterStatus: 'all' | RowValidationStatus = 'all';
  private statusBannerMsg: string = '';
  private statusBannerType: 'ok' | 'warn' | 'info' = 'info';

  private dialogEl!: HTMLDialogElement;
  private bodyHost!: HTMLElement;
  private statusEl!: HTMLElement;
  private quickBarSummaryEl!: HTMLElement;

  constructor(bridge: FolioDashboardBridge) {
    this.bridge = bridge;
    this.rawInputText = DATASET_PRESETS[0].sampleMasterCsv;
    this.currentMapping = autoDetectColumnMapping(
      parseAnyInput(this.rawInputText).headers
    );
    const currentMeta = this.bridge.getMeta?.();
    if (currentMeta?.columnLabels) {
      this.customColumnLabels = cloneColumnLabels(currentMeta.columnLabels);
    }
    if (currentMeta?.contextPrompt) {
      this.contextPrompt = currentMeta.contextPrompt;
    }
  }

  public init(): void {
    this.restoreSavedDataset();
    this.injectStudioStyles();
    this.mountQuickWorkbenchBar();
    this.mountHeaderButton();
    this.mountStudioDialog();
    this.bindGlobalShortcut();
  }

  private restoreSavedDataset(): void {
    try {
      const savedData = localStorage.getItem(STORAGE_DATA_KEY);
      const savedMeta = localStorage.getItem(STORAGE_META_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        const { data } = validateAndNormalizeFolioData(parsedData, { autoFix: true });
        const rawSavedMeta = savedMeta ? JSON.parse(savedMeta) : {};
        const mergedLabels = cloneColumnLabels({
          ...DEFAULT_COLUMN_DISPLAY_LABELS,
          ...(rawSavedMeta.columnLabels || {})
        });
        this.customColumnLabels = mergedLabels;
        this.contextPrompt =
          typeof rawSavedMeta.contextPrompt === 'string'
            ? rawSavedMeta.contextPrompt
            : DEFAULT_REPORT_META.contextPrompt || '';
        const baseMeta: FolioReportMeta = {
          ...cloneReportMeta(DEFAULT_REPORT_META),
          ...rawSavedMeta,
          columnLabels: mergedLabels,
          contextPrompt: this.contextPrompt
        };
        const meta = baseMeta.narrative
          ? baseMeta
          : synthesizeThematicReportMeta(data, baseMeta, {
              contextPrompt: this.contextPrompt,
              columnLabels: mergedLabels
            });
        this.bridge.setData(data, meta);
      } else {
        // Ensure initial dashboard has full thematic narrative & columnLabels synced
        const initData = this.bridge.getData();
        const initMeta = synthesizeThematicReportMeta(initData, this.bridge.getMeta(), {
          contextPrompt: this.contextPrompt,
          columnLabels: this.customColumnLabels,
          preserveHeroIfDefault: true
        });
        this.bridge.setData(initData, initMeta);
      }
    } catch {
      // Ignore storage errors
    }
  }

  private persistDataset(data: FolioData, meta: FolioReportMeta): void {
    try {
      localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(data));
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
    } catch {
      // Ignore quota errors
    }
  }

  private clearSavedDataset(): void {
    try {
      localStorage.removeItem(STORAGE_DATA_KEY);
      localStorage.removeItem(STORAGE_META_KEY);
    } catch {
      // Ignore
    }
  }

  private injectStudioStyles(): void {
    if (document.getElementById('folioStudioStyles')) return;
    const style = document.createElement('style');
    style.id = 'folioStudioStyles';
    style.textContent = `
      /* Quick Importer Ribbon in Section 01 */
      .studio-ribbon {
        grid-column: 1 / 13;
        background: var(--paper-raised);
        border: 1px solid var(--ink);
        padding: var(--s-3) var(--s-4);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        margin-bottom: var(--s-2);
      }
      .studio-ribbon-left {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--s-3);
        min-width: 0;
      }
      .studio-tag {
        font-family: var(--font-mono);
        font-size: var(--t-micro);
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        background: var(--band);
        color: var(--white);
        padding: 3px 8px;
        flex-shrink: 0;
      }
      .studio-ribbon-text {
        font-size: var(--t-label);
        color: var(--ink);
        font-weight: 500;
      }
      .studio-ribbon-sub {
        font-family: var(--font-mono);
        font-size: var(--t-micro);
        color: var(--ink-3);
      }
      .studio-ribbon-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--s-2);
      }
      .studio-cta-btn {
        appearance: none;
        background: var(--ink);
        color: var(--paper);
        border: 1px solid var(--ink);
        height: 32px;
        padding: 0 var(--s-3);
        font-family: var(--font-sans);
        font-size: var(--t-label);
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        border-radius: 0;
        transition: background-color var(--d-1) var(--ease-std), color var(--d-1) var(--ease-std);
      }
      .studio-cta-btn:hover {
        background: var(--violet-ink);
        border-color: var(--violet-ink);
        color: var(--white);
      }

      /* Full-Featured Data Studio Dialog */
      dialog.studio-dialog {
        position: fixed;
        inset: 0 0 0 auto;
        width: min(980px, 100vw);
        max-width: 100vw;
        height: 100dvh;
        max-height: none;
        margin: 0;
        padding: 0;
        border: 0;
        border-left: 1px solid var(--ink);
        border-radius: 0;
        background: var(--paper);
        color: var(--ink);
        overflow: hidden;
        transform: translateX(100%);
        transition: transform 240ms var(--ease-in-out);
        z-index: 400;
      }
      dialog.studio-dialog.is-open {
        transform: translateX(0);
        transition-duration: 320ms;
        transition-timing-function: var(--ease-out);
      }
      dialog.studio-dialog::backdrop {
        background: var(--scrim);
        opacity: 0;
        transition: opacity 220ms var(--ease-in-out);
      }
      dialog.studio-dialog.is-open::backdrop {
        opacity: 1;
      }
      .studio-shell {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
      .studio-header {
        height: 40px;
        flex-shrink: 0;
        background: var(--band);
        color: var(--white);
        padding: 0 var(--s-4);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
      }
      .studio-header-left {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        min-width: 0;
      }
      .studio-header-title {
        font-size: var(--t-micro);
        font-weight: 500;
        letter-spacing: 0.02em;
        color: var(--white);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .studio-nav-bar {
        flex-shrink: 0;
        background: var(--paper-raised);
        border-bottom: 1px solid var(--ink);
        padding: var(--s-3) var(--s-4);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
      }
      .studio-status-strip {
        flex-shrink: 0;
        padding: var(--s-2) var(--s-4);
        border-bottom: 1px solid var(--rule);
        background: var(--paper-raised);
        font-family: var(--font-mono);
        font-size: var(--t-micro);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
      }
      .studio-status-strip[data-type="ok"] {
        border-left: 4px solid var(--violet-ink);
      }
      .studio-status-strip[data-type="warn"] {
        border-left: 4px solid var(--vermilion-ink);
      }
      .studio-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: var(--s-4);
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
      }
      .studio-footer {
        flex-shrink: 0;
        border-top: 1px solid var(--ink);
        padding: var(--s-3) var(--s-4);
        background: var(--paper-raised);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
      }
      .studio-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-4);
        align-items: start;
      }
      @media (max-width: 767px) {
        .studio-grid-2 {
          grid-template-columns: 1fr;
        }
      }
      .studio-box {
        background: var(--paper-raised);
        border: 1px solid var(--rule);
        padding: var(--s-3);
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
      }
      .studio-box--strong {
        border-color: var(--ink);
      }
      .studio-label {
        font-size: var(--t-micro);
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-3);
        display: block;
      }
      .studio-select,
      .studio-input {
        width: 100%;
        height: 34px;
        padding: 0 var(--s-2);
        border: 1px solid var(--ink);
        background: var(--paper);
        color: var(--ink);
        font-family: var(--font-sans);
        font-size: var(--t-label);
        border-radius: 0;
      }
      .studio-textarea {
        width: 100%;
        min-height: 190px;
        padding: var(--s-2) var(--s-3);
        border: 1px solid var(--ink);
        background: var(--paper);
        color: var(--ink);
        font-family: var(--font-mono);
        font-size: 12px;
        line-height: 1.45;
        border-radius: 0;
        resize: vertical;
        tab-size: 2;
      }
      .studio-code-output {
        width: 100%;
        min-height: 340px;
        padding: var(--s-3);
        border: 1px solid var(--ink);
        background: var(--paper);
        color: var(--ink);
        font-family: var(--font-mono);
        font-size: 12px;
        line-height: 1.45;
        border-radius: 0;
        resize: vertical;
        white-space: pre;
        overflow-x: auto;
      }
      .studio-dropzone {
        border: 1px dashed var(--ink);
        background: var(--paper);
        padding: var(--s-3);
        text-align: center;
        cursor: pointer;
        transition: background-color var(--d-1) var(--ease-std);
      }
      .studio-dropzone:hover,
      .studio-dropzone.is-dragover {
        background: var(--paper-raised);
        border-style: solid;
        border-color: var(--violet-ink);
      }
      .studio-map-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: var(--s-2);
      }
      .studio-map-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .studio-map-field label {
        font-size: 11px;
        font-weight: 500;
        color: var(--ink-2);
      }
      .studio-kpi-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--s-2);
      }
      @media (max-width: 639px) {
        .studio-kpi-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .studio-kpi-card {
        background: var(--paper-raised);
        border: 1px solid var(--rule);
        padding: var(--s-2) var(--s-3);
      }
      .studio-kpi-num {
        font-size: 22px;
        font-weight: 500;
        color: var(--ink);
        font-variant-numeric: lining-nums tabular-nums;
      }
      .studio-issue-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
      }
      .studio-issue-item {
        padding: var(--s-2) var(--s-3);
        border: 1px solid var(--rule);
        background: var(--paper-raised);
        font-size: var(--t-label);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--s-3);
      }
      /* Visual Row Validation Summary Panel */
      .studio-val-bar {
        width: 100%;
        height: 10px;
        background: var(--neutral-data);
        border: 1px solid var(--ink);
        display: flex;
        overflow: hidden;
      }
      .studio-val-bar-seg {
        height: 100%;
        transition: width var(--d-2) var(--ease-std);
      }
      .studio-val-bar-seg--passed {
        background: var(--violet);
      }
      .studio-val-bar-seg--warning {
        background: var(--magenta);
      }
      .studio-val-bar-seg--failed {
        background: var(--vermilion);
      }
      .studio-row-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.03em;
        padding: 2px 7px;
        border: 1px solid var(--ink);
        white-space: nowrap;
        background: var(--paper);
      }
      .studio-row-badge[data-status="passed"] {
        border-color: var(--violet-ink);
        color: var(--violet-ink);
      }
      .studio-row-badge[data-status="warning"] {
        border-color: var(--ink);
        color: var(--ink);
        background: color-mix(in srgb, var(--magenta) 18%, var(--paper));
      }
      .studio-row-badge[data-status="failed"] {
        border-color: var(--vermilion-ink);
        color: var(--vermilion-ink);
        background: color-mix(in srgb, var(--vermilion-tint) 32%, var(--paper));
      }
      .studio-cell-issue-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .studio-cell-issue {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px;
        padding: 5px 8px;
        border-left: 3px solid var(--ink);
        background: var(--paper);
        font-size: 12px;
        line-height: 1.4;
      }
      .studio-cell-issue[data-severity="error"] {
        border-left-color: var(--vermilion-ink);
        background: color-mix(in srgb, var(--vermilion-tint) 22%, var(--paper));
      }
      .studio-cell-issue[data-severity="warning"] {
        border-left-color: var(--magenta);
        background: color-mix(in srgb, var(--magenta) 12%, var(--paper));
      }
      .studio-raw-pill {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 1px 5px;
        border: 1px solid var(--rule);
        background: var(--paper-raised);
        color: var(--ink);
      }
      .data-table td.cell-has-error {
        background: color-mix(in srgb, var(--vermilion-tint) 35%, var(--paper));
        color: var(--vermilion-ink);
        font-weight: 600;
        outline: 1.5px solid var(--vermilion-ink);
        outline-offset: -1.5px;
      }
      .data-table td.cell-has-warning {
        background: color-mix(in srgb, var(--magenta) 14%, var(--paper));
        outline: 1px dashed var(--ink-2);
        outline-offset: -1px;
      }
    `;
    document.head.appendChild(style);
  }

  private mountHeaderButton(): void {
    const bandRight = document.querySelector('.band-right');
    const themeBtn = document.getElementById('themePanelBtn');
    if (!bandRight || !themeBtn) return;

    if (document.getElementById('dataStudioBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'band-btn';
    btn.id = 'dataStudioBtn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'dataStudioDialog');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.title = 'Open TypeScript Data Importer & Template Exporter (Shortcut: I)';
    btn.innerHTML = `
      <span aria-hidden="true" style="font-family:var(--font-mono);font-weight:600;font-size:10px;">TS</span>
      <span class="band-btn-label">Import &amp; Export Data</span>
    `;
    btn.addEventListener('click', () => {
      if (this.dialogEl.open) this.closeDialog();
      else this.openDialog('import');
    });
    bandRight.insertBefore(btn, themeBtn);
  }

  private mountQuickWorkbenchBar(): void {
    const heroGrid = document.querySelector('#s01 .spread-grid');
    const masthead = document.querySelector('#s01 .hero-masthead');
    if (!heroGrid || !masthead) return;

    if (document.getElementById('studioQuickRibbon')) return;
    const ribbon = document.createElement('div');
    ribbon.id = 'studioQuickRibbon';
    ribbon.className = 'studio-ribbon';

    const d = this.bridge.getData();
    ribbon.innerHTML = `
      <div class="studio-ribbon-left">
        <span class="studio-tag">TypeScript Data Importer</span>
        <div>
          <span class="studio-ribbon-text">Import <code>.xlsx</code>, CSV, TSV, or JSON datasets &amp; output in Folio <code>index.html</code> format</span>
          <span class="studio-ribbon-sub num" id="studioQuickSummary" style="display:block;margin-top:2px;">
            Active dataset: ${d.heroMatrix.total} records · ${d.markets.length} markets · ${d.sampleRegion.length} regions · 10 charts synced
          </span>
        </div>
      </div>
      <div class="studio-ribbon-actions">
        <label class="studio-cta-btn" for="studioQuickXlsxInput" style="cursor:pointer;" title="Directly upload an Excel (.xlsx / .xls) or CSV file">
          <input type="file" id="studioQuickXlsxInput" accept=".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.json,.html" class="sr-only">
          Import .XLSX / CSV ↑
        </label>
        <button type="button" class="seg-btn" data-open-studio="import">
          Data Studio Workbench
        </button>
        <button type="button" class="seg-btn" data-open-studio="editor">
          Edit Sections (01–10)
        </button>
        <button type="button" class="seg-btn" data-open-studio="export">
          Export .XLSX / HTML ↓
        </button>
      </div>
    `;

    masthead.insertAdjacentElement('afterend', ribbon);
    this.quickBarSummaryEl = document.getElementById('studioQuickSummary')!;

    const quickFileInput = ribbon.querySelector('#studioQuickXlsxInput') as HTMLInputElement | null;
    if (quickFileInput) {
      quickFileInput.addEventListener('change', () => {
        if (quickFileInput.files && quickFileInput.files[0]) {
          const f = quickFileInput.files[0];
          this.openDialog('import');
          this.processUploadedFile(f, true);
          quickFileInput.value = '';
        }
      });
    }

    ribbon.querySelectorAll('[data-open-studio]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-open-studio') as
          | 'import'
          | 'editor'
          | 'validate'
          | 'export';
        this.openDialog(tab || 'import');
      });
    });
  }

  public updateQuickBarSummary(): void {
    if (!this.quickBarSummaryEl) return;
    const d = this.bridge.getData();
    const m = this.bridge.getMeta();
    this.quickBarSummaryEl.textContent = `Active dataset: ${m.title} · ${d.heroMatrix.total} records · ${d.markets.length} markets · ${d.sampleRegion.length} regions · 10 charts synced`;
  }

  private mountStudioDialog(): void {
    const existing = document.getElementById('dataStudioDialog');
    if (existing) existing.remove();

    const dlg = document.createElement('dialog');
    dlg.id = 'dataStudioDialog';
    dlg.className = 'studio-dialog';
    dlg.setAttribute('aria-labelledby', 'dataStudioTitle');

    dlg.innerHTML = `
      <div class="studio-shell" id="dataStudioShell">
        <div class="studio-header">
          <div class="studio-header-left">
            <span class="band-folio num">TS</span>
            <h2 class="studio-header-title" id="dataStudioTitle">Folio Data Importer &amp; Template Generator (TypeScript)</h2>
          </div>
          <button type="button" class="band-btn" id="dataStudioCloseBtn">
            <span>Close</span>
            <span class="band-close-x" aria-hidden="true"></span>
          </button>
        </div>

        <div class="studio-nav-bar">
          <div class="seg-group" role="tablist" aria-label="Data Importer Workbench Tabs">
            <button type="button" class="seg-btn" role="tab" data-studio-tab="import" aria-pressed="true">01. Import (.XLSX / CSV / JSON)</button>
            <button type="button" class="seg-btn" role="tab" data-studio-tab="editor" aria-pressed="false">02. Section &amp; Meta Editor</button>
            <button type="button" class="seg-btn" role="tab" data-studio-tab="validate" aria-pressed="false">03. Schema Validator</button>
            <button type="button" class="seg-btn" role="tab" data-studio-tab="export" aria-pressed="false">04. Export (.XLSX / HTML / DATA)</button>
          </div>
          <div style="display:flex;align-items:center;gap:var(--s-2);">
            <button type="button" class="fig-table-btn" id="studioQuickResetBtn" title="Restore original 412-record Folio sample dataset">Reset to Default</button>
          </div>
        </div>

        <div class="studio-status-strip" id="dataStudioStatus" data-type="info" aria-live="polite">
          <span id="dataStudioStatusText">Ready — Upload or drop an Excel (.xlsx / .xls), CSV, TSV, JSON, or index.html file to transform into Folio DATA format.</span>
          <span class="num" id="dataStudioRecordBadge">n = ${this.bridge.getData().heroMatrix.total}</span>
        </div>

        <div class="studio-body" id="dataStudioBody"></div>

        <div class="studio-footer">
          <span class="mono-meta">Outputs 100% compatible Folio <code>DATA</code> schema across all 10 SVG charts &amp; 7 WCAG AA themes.</span>
          <div style="display:flex;align-items:center;gap:var(--s-2);">
            <button type="button" class="seg-btn" id="studioFooterExportXlsxBtn">Download 15-Tab .XLSX ↓</button>
            <button type="button" class="seg-btn" id="studioFooterExportHtmlBtn">Download Standalone index.html ↓</button>
            <button type="button" class="studio-cta-btn" id="studioFooterCopyDataBtn">Copy DATA Block</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dlg);
    this.dialogEl = dlg;
    this.bodyHost = dlg.querySelector('#dataStudioBody')!;
    this.statusEl = dlg.querySelector('#dataStudioStatusText')!;

    dlg.querySelector('#dataStudioCloseBtn')!.addEventListener('click', () => this.closeDialog());
    dlg.addEventListener('cancel', e => {
      e.preventDefault();
      this.closeDialog();
    });
    dlg.addEventListener('click', e => {
      if (e.target === dlg) this.closeDialog();
    });

    dlg.querySelectorAll('[data-studio-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-studio-tab') as
          | 'import'
          | 'editor'
          | 'validate'
          | 'export';
        this.switchTab(tab);
      });
    });

    dlg.querySelector('#studioQuickResetBtn')!.addEventListener('click', () => {
      const defData = cloneFolioData(DEFAULT_FOLIO_DATA);
      const defMeta = cloneReportMeta(DEFAULT_REPORT_META);
      this.loadedWorkbook = null;
      this.customColumnLabels = cloneColumnLabels(DEFAULT_COLUMN_DISPLAY_LABELS);
      this.contextPrompt = DEFAULT_REPORT_META.contextPrompt || '';
      this.editingLabelKey = null;
      this.clearSavedDataset();
      this.bridge.setData(defData, defMeta);
      this.updateQuickBarSummary();
      this.setStatus('Restored default 412-record Folio sample dataset and default column display names.', 'ok');
      this.renderActiveTab();
    });

    dlg.querySelector('#studioFooterExportXlsxBtn')!.addEventListener('click', () => {
      const buf = exportFolioToXlsxBuffer(this.bridge.getData(), 'all-sheets');
      this.downloadBinaryBlob(
        buf,
        'folio-dashboard-workbook.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      this.setStatus('Downloaded 15-tab Excel workbook: folio-dashboard-workbook.xlsx', 'ok');
    });

    dlg.querySelector('#studioFooterExportHtmlBtn')!.addEventListener('click', () => {
      this.downloadStandaloneHtml();
    });

    dlg.querySelector('#studioFooterCopyDataBtn')!.addEventListener('click', () => {
      const code = formatFolioDataAsJsBlock(this.bridge.getData(), 4);
      navigator.clipboard.writeText(code).then(() => {
        this.setStatus('Copied `const DATA = { ... };` block to clipboard!', 'ok');
      });
    });
  }

  private setStatus(msg: string, type: 'ok' | 'warn' | 'info' = 'info'): void {
    this.statusBannerMsg = msg;
    this.statusBannerType = type;
    if (this.statusEl) {
      this.statusEl.textContent = msg;
    }
    const strip = document.getElementById('dataStudioStatus');
    if (strip) strip.setAttribute('data-type', type);
    const badge = document.getElementById('dataStudioRecordBadge');
    if (badge) {
      badge.textContent = `n = ${this.bridge.getData().heroMatrix.total}`;
    }
  }

  /**
   * Synchronously synthesizes data-grounded thematic report phrasing & custom column labels,
   * updates the dashboard and localStorage immediately, and optionally calls the Gemini AI
   * endpoint to further tailor all 10 report sections to the user's context prompt.
   */
  private applyDataWithThematicSynthesis(
    newData: FolioData,
    statusSummary: string,
    options?: {
      triggerAi?: boolean;
      preserveHeroIfDefault?: boolean;
      baseMeta?: FolioReportMeta;
    }
  ): void {
    const baseMeta = options?.baseMeta || this.bridge.getMeta();
    const synthesizedMeta = synthesizeThematicReportMeta(newData, baseMeta, {
      contextPrompt: this.contextPrompt,
      columnLabels: this.customColumnLabels,
      preserveHeroIfDefault: options?.preserveHeroIfDefault ?? false
    });

    this.bridge.setData(newData, synthesizedMeta);
    this.persistDataset(newData, synthesizedMeta);
    this.updateQuickBarSummary();

    const shouldCallAi =
      options?.triggerAi === true &&
      this.contextPrompt.trim().length > 0 &&
      !this.isAiSynthesizing;

    if (!shouldCallAi) {
      this.setStatus(statusSummary, 'ok');
      return;
    }

    this.isAiSynthesizing = true;
    this.setStatus(
      `${statusSummary} · AI is tailoring report phrasing to your context prompt & data points...`,
      'info'
    );

    requestAiReportSynthesis(
      newData,
      synthesizedMeta,
      this.contextPrompt,
      this.customColumnLabels
    )
      .then(aiResult => {
        this.isAiSynthesizing = false;
        this.bridge.setData(newData, aiResult.meta);
        this.persistDataset(newData, aiResult.meta);
        this.updateQuickBarSummary();
        const engineTag =
          aiResult.synthesizedBy !== 'deterministic-fallback'
            ? 'AI-synthesized (Gemini)'
            : 'Data-grounded thematic synthesis';
        this.setStatus(
          `${statusSummary} · All 10 sections updated with ${engineTag} phrasing & custom column names!`,
          'ok'
        );
      })
      .catch(() => {
        this.isAiSynthesizing = false;
        this.setStatus(
          `${statusSummary} · Applied data-grounded thematic phrasing across all 10 sections.`,
          'ok'
        );
      });
  }

  public openDialog(tab?: 'import' | 'editor' | 'validate' | 'export'): void {
    if (tab) this.activeTab = tab;
    this.syncTabButtons();
    this.renderActiveTab();

    if (!this.dialogEl.open) {
      document.documentElement.classList.add('panel-open');
      this.dialogEl.showModal();
      const btn = document.getElementById('dataStudioBtn');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => {
        this.dialogEl.classList.add('is-open');
      });
    }
  }

  public closeDialog(): void {
    if (!this.dialogEl.open) return;
    this.dialogEl.classList.remove('is-open');
    const btn = document.getElementById('dataStudioBtn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('panel-open');
    window.setTimeout(() => {
      if (this.dialogEl.open) this.dialogEl.close();
    }, 220);
  }

  private switchTab(tab: 'import' | 'editor' | 'validate' | 'export'): void {
    this.activeTab = tab;
    this.syncTabButtons();
    this.renderActiveTab();
  }

  private syncTabButtons(): void {
    if (!this.dialogEl) return;
    this.dialogEl.querySelectorAll('[data-studio-tab]').forEach(btn => {
      const t = btn.getAttribute('data-studio-tab');
      btn.setAttribute('aria-pressed', String(t === this.activeTab));
    });
  }

  private renderActiveTab(): void {
    if (!this.bodyHost) return;
    this.bodyHost.innerHTML = '';

    if (this.activeTab === 'import') {
      this.renderImportTab();
    } else if (this.activeTab === 'editor') {
      this.renderEditorTab();
    } else if (this.activeTab === 'validate') {
      this.renderValidateTab();
    } else {
      this.renderExportTab();
    }
  }

  /**
   * Handles an uploaded or dropped File (.xlsx, .xls, .csv, .tsv, .json, .html).
   * If autoApplyOnValid is true (e.g. from the quick homepage button), automatically transforms and applies valid sheets.
   */
  private processUploadedFile(file: File, autoApplyOnValid = false): void {
    if (isExcelFileName(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const buffer = reader.result as ArrayBuffer;
          const wb = parseXlsxBuffer(buffer, file.name);
          this.loadedWorkbook = wb;

          if (wb.sheets.length === 0) {
            this.setStatus(
              `Excel workbook "${file.name}" contained no non-empty worksheets.`,
              'warn'
            );
            this.renderImportTab();
            return;
          }

          const activeSheet =
            wb.sheets.find(s => s.name === wb.activeSheetName) || wb.sheets[0];
          this.rawInputText = activeSheet.csvText;
          this.selectedTarget = 'auto';
          this.currentMapping = autoDetectColumnMapping(activeSheet.headers);

          const validSheets = wb.sheets.filter(s => s.headerValid);

          if (autoApplyOnValid && validSheets.length > 0) {
            if (validSheets.length > 1) {
              const batchResult = importAllXlsxSheets(wb, this.bridge.getData());
              this.applyDataWithThematicSynthesis(batchResult.data, batchResult.summary);
            } else {
              const singleResult = FolioDataImporter.importFromText(activeSheet.csvText, {
                target: 'auto',
                mapping: this.currentMapping,
                baseData: this.bridge.getData(),
                autoFix: true,
                strictHeaders: true
              });
              if (singleResult.headerValidation.valid) {
                this.applyDataWithThematicSynthesis(
                  singleResult.data,
                  `Imported Excel file "${file.name}" (sheet "${activeSheet.name}"): ${singleResult.summary}`
                );
              } else {
                this.setStatus(singleResult.headerValidation.summary, 'warn');
              }
            }
          } else {
            this.setStatus(
              `Loaded Excel workbook "${file.name}" (${wb.sheets.length} worksheet${
                wb.sheets.length > 1 ? 's' : ''
              }, ${validSheets.length} auto-matched Folio schema). Select a sheet or click "Transform & Apply".`,
              'info'
            );
          }

          this.renderImportTab();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Invalid Excel file format';
          this.setStatus(`Failed to parse Excel file "${file.name}": ${msg}`, 'warn');
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // Text-based files (.csv, .tsv, .json, .txt, .html)
    this.loadedWorkbook = null;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      this.rawInputText = text;
      const p = parseAnyInput(text);
      this.currentMapping = autoDetectColumnMapping(p.headers);

      if (autoApplyOnValid) {
        const result = FolioDataImporter.importFromText(this.rawInputText, {
          target: this.selectedTarget,
          mapping: this.currentMapping,
          baseData: this.bridge.getData(),
          autoFix: true,
          strictHeaders: true
        });
        if (result.headerValidation.valid) {
          this.applyDataWithThematicSynthesis(
            result.data,
            `Imported "${file.name}": ${result.summary}`
          );
          this.renderImportTab();
          return;
        }
      }

      this.setStatus(
        `Loaded file "${file.name}" (${file.size.toLocaleString()} bytes). Click "Transform & Apply" to update dashboard.`,
        'info'
      );
      this.renderImportTab();
    };
    reader.readAsText(file);
  }

  /* ============================================================================
   * TAB 1: IMPORT & MAP DATA (.XLSX / .XLS / CSV / TSV / JSON / HTML)
   * ============================================================================ */
  private renderImportTab(): void {
    const parsed = parseAnyInput(this.rawInputText);
    const detected =
      this.selectedTarget === 'auto' ? autoDetectTargetSection(parsed) : this.selectedTarget;
    const detectedInfo = SECTION_TARGETS.find(t => t.id === detected) || SECTION_TARGETS[0];

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = 'var(--s-4)';

    const wb = this.loadedWorkbook;
    const validWbSheets = wb ? wb.sheets.filter(s => s.headerValid) : [];

    // Top row: Context Prompt for AI Report Synthesis + Dataset Presets + Target Section + File Upload
    const safeContextVal = (this.contextPrompt || '').replace(/"/g, '&quot;');
    wrap.innerHTML = `
      <div class="studio-context-box" id="studioContextPromptBox">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);">
          <div>
            <span class="studio-label" style="color:var(--violet-ink);">Dataset Context Prompt — AI &amp; Thematic Report Synthesis</span>
            <p class="fig-text" style="margin-top:2px;">
              Briefly describe what your imported data represents so the AI and report generator match your dataset's domain terminology and cite actual data points across all 10 sections.
            </p>
          </div>
          <span class="mono-meta" style="padding:2px 7px;border:1px solid var(--ink);background:var(--paper);">
            Syncs All 10 Sections + Column Names
          </span>
        </div>
        <div class="studio-context-row">
          <input
            type="text"
            class="studio-context-input"
            id="studioContextPromptInput"
            value="${safeContextVal}"
            placeholder="e.g. Clinical trial recruitment, protocol compliance, and cost per patient across regional hospital networks (2021–2026)"
            aria-label="Brief context prompt describing what the imported data represents"
          >
          <button
            type="button"
            class="studio-cta-btn"
            id="studioAiSynthesizeBtn"
            title="Synthesize all 10 report sections' headlines, paragraphs, chart subtitles, and captions using your context prompt, custom column names, and actual data points"
          >
            ${this.isAiSynthesizing ? 'Synthesizing Report...' : 'Synthesize Thematic Report (AI + Data) →'}
          </button>
        </div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
          <span class="mono-meta">Quick context examples:</span>
          <button type="button" class="fig-table-btn" data-context-chip="Global enterprise workflow automation, real-time data pipeline readiness, and cross-border telemetry adoption across 16 national markets (2021–2026).">Enterprise Workflow Benchmark</button>
          <button type="button" class="fig-table-btn" data-context-chip="Enterprise AI GPU cluster telemetry, quantized inference utilization, sovereign residency compliance, and latency compression across production workloads.">AI &amp; GPU Cluster Telemetry</button>
          <button type="button" class="fig-table-btn" data-context-chip="Renewable energy grid storage efficiency, clean dispatch share, interconnection readiness, and curtailment cost reduction across regional power utilities.">Renewable Grid &amp; Storage</button>
          <button type="button" class="fig-table-btn" data-context-chip="Clinical trial site enrollment share, protocol adherence score, and patient diagnostic cycle compression across regional hospital networks.">Clinical Trial Outcomes</button>
        </div>
      </div>

      <div class="studio-grid-2">
        <div class="studio-box studio-box--strong">
          <span class="studio-label">1. Select Import Mode or Chart Section Target</span>
          <select class="studio-select" id="studioTargetSelect" aria-label="Target section for imported data">
            ${SECTION_TARGETS.map(
              t =>
                `<option value="${t.id}" ${t.id === this.selectedTarget ? 'selected' : ''}>[${t.badge}] ${t.label}</option>`
            ).join('')}
          </select>
          <p class="fig-text" id="studioTargetDesc" style="margin-top:4px;">${detectedInfo.desc}</p>
          <div style="display:flex;flex-wrap:wrap;gap:var(--s-2);margin-top:var(--s-2);">
            <button type="button" class="fig-table-btn" id="studioLoadTemplateBtn">Load Section Template</button>
            <button type="button" class="fig-table-btn" id="studioDownloadTemplateXlsxBtn">Download Template .XLSX ↓</button>
            <button type="button" class="fig-table-btn" id="studioDownloadFullWorkbookXlsxBtn" title="Download a 15-sheet Excel workbook containing templates for all 10 charts">Download 15-Tab .XLSX ↓</button>
            <button type="button" class="fig-table-btn" id="studioDownloadTemplateBtn">Template .CSV ↓</button>
          </div>
        </div>

        <div class="studio-box">
          <span class="studio-label">Quick-Load Benchmark Presets or Upload .XLSX / .CSV</span>
          <div style="display:flex;flex-wrap:wrap;gap:var(--s-2);">
            ${DATASET_PRESETS.map(
              p =>
                `<button type="button" class="seg-btn" data-preset-id="${p.id}" title="${p.tagline}">${p.name}</button>`
            ).join('')}
          </div>
          <label class="studio-dropzone" id="studioDropzone" for="studioFileInput" style="margin-top:var(--s-2);">
            <input type="file" id="studioFileInput" accept=".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.json,.txt,.html" class="sr-only">
            <span style="font-size:var(--t-label);font-weight:500;display:block;color:var(--ink);">
              Drop an Excel <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>, <code>.tsv</code>, <code>.json</code>, or <code>index.html</code> file here, or click to browse
            </span>
            <span class="mono-meta" style="display:block;margin-top:4px;">
              Supports single-sheet &amp; multi-sheet Excel (.xlsx) workbooks, CSV/TSV exports, or Folio DATA JSON
            </span>
          </label>
        </div>
      </div>

      ${
        wb
          ? `
        <div class="studio-box studio-box--strong" id="studioXlsxWorkbookBox">
          <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);">
            <div>
              <span class="studio-label">Excel (.XLSX) Workbook Inspector — ${wb.fileName.replace(/</g, '&lt;')}</span>
              <span class="mono-meta num">
                ${wb.sheets.length} worksheet${wb.sheets.length > 1 ? 's' : ''} detected · ${
                  validWbSheets.length
                } matched Folio chart schema · Click any worksheet tab below to inspect or map columns
              </span>
            </div>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--s-2);">
              ${
                validWbSheets.length > 1
                  ? `<button type="button" class="studio-cta-btn" id="studioImportAllSheetsBtn">
                      Import All ${validWbSheets.length} Valid Worksheets →
                    </button>`
                  : ''
              }
              <button type="button" class="fig-table-btn" id="studioDismissWorkbookBtn">Close Workbook</button>
            </div>
          </div>
          <div class="seg-group" role="tablist" aria-label="Excel Workbook Sheets" style="margin-top:var(--s-1);">
            ${wb.sheets
              .map(s => {
                const tInfo = SECTION_TARGETS.find(t => t.id === s.detectedTarget);
                const badge = tInfo ? tInfo.badge : s.detectedTarget;
                const isActive = s.name === wb.activeSheetName;
                return `
                  <button
                    type="button"
                    class="seg-btn"
                    data-xlsx-sheet="${s.name.replace(/"/g, '&quot;')}"
                    aria-pressed="${isActive}"
                    title="Sheet: ${s.name.replace(/"/g, '&quot;')} (${s.rows.length} rows → ${badge})"
                  >
                    <span>${s.headerValid ? '✓' : '•'} ${s.name.replace(/</g, '&lt;')}</span>
                    <span class="mono-meta" style="opacity:0.8;font-size:10px;">[${badge} · ${s.rows.length}r]</span>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <div class="studio-box studio-box--strong">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);">
          <div>
            <span class="studio-label">2. Raw Data Input (${
              wb ? `Active Worksheet: "${wb.activeSheetName.replace(/</g, '&lt;')}"` : 'CSV, TSV, JSON, or const DATA = {...}'
            })</span>
            <span class="mono-meta num" id="studioParseMeta">
              Format: ${wb ? `XLSX (${wb.activeSheetName})` : parsed.format.toUpperCase()} · ${
                parsed.format === 'folio-json' || parsed.format === 'html-data'
                  ? `${parsed.headers.length} top-level DATA keys`
                  : `${parsed.rows.length} rows · ${parsed.headers.length} columns`
              } → Routing to: ${detectedInfo.label}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:var(--s-2);">
            <button type="button" class="fig-table-btn" id="studioLoadCurrentJsonBtn">Load Active DATA as JSON</button>
            <button type="button" class="studio-cta-btn" id="studioApplyImportBtn">Transform &amp; Apply to Dashboard →</button>
          </div>
        </div>
        <textarea class="studio-textarea" id="studioRawTextarea" spellcheck="false" aria-label="Raw CSV, TSV, or JSON input data"></textarea>
      </div>

      <div class="studio-box studio-box--strong" id="studioHeaderValidationBox"></div>

      <div class="studio-box studio-box--strong" id="studioRowValidationBox" ${
        parsed.rows.length === 0 ? 'hidden' : ''
      }></div>

      <div class="studio-box studio-box--strong" id="studioMappingBox" ${
        parsed.rows.length === 0 ? 'hidden' : ''
      }>
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);">
          <div>
            <span class="studio-label">5. Smart Column Mapping &amp; In-Line Editable Display Names</span>
            <span class="mono-meta">Click any column label below (or <code>✎ Rename</code>) to customize its displayed name across all report tables, axes, filters, and prose</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--s-2);">
            <button type="button" class="fig-table-btn" id="studioAdoptCsvHeadersBtn" title="Set each column mapping's displayed name to the matched CSV column header">Use CSV Headers as Display Names</button>
            <button type="button" class="fig-table-btn" id="studioResetColLabelsBtn" title="Restore default column mapping display names">Reset Default Names</button>
          </div>
        </div>
        <div class="studio-map-grid" id="studioMapGrid"></div>
        <div class="table-scroll" id="studioPreviewTableWrap" style="margin-top:var(--s-2);max-height:240px;overflow-y:auto;"></div>
      </div>
    `;

    this.bodyHost.appendChild(wrap);

    // Context prompt input & quick chips
    const contextInput = wrap.querySelector('#studioContextPromptInput') as HTMLInputElement;
    contextInput.addEventListener('input', () => {
      this.contextPrompt = contextInput.value;
    });
    contextInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (wrap.querySelector('#studioAiSynthesizeBtn') as HTMLButtonElement)?.click();
      }
    });

    wrap.querySelectorAll('[data-context-chip]').forEach(chipBtn => {
      chipBtn.addEventListener('click', () => {
        const promptVal = chipBtn.getAttribute('data-context-chip') || '';
        this.contextPrompt = promptVal;
        contextInput.value = promptVal;
        this.applyDataWithThematicSynthesis(
          this.bridge.getData(),
          'Updated dataset context prompt across all 10 report sections (click "Synthesize Report Phrasing" for full AI rewrite)',
          { triggerAi: false }
        );
      });
    });

    const aiSynthBtn = wrap.querySelector('#studioAiSynthesizeBtn') as HTMLButtonElement;
    aiSynthBtn.addEventListener('click', () => {
      this.contextPrompt = contextInput.value.trim();
      this.applyDataWithThematicSynthesis(
        this.bridge.getData(),
        'Synthesizing thematic report phrasing for active dataset',
        { triggerAi: true }
      );
    });

    const adoptCsvBtn = wrap.querySelector('#studioAdoptCsvHeadersBtn');
    if (adoptCsvBtn) {
      adoptCsvBtn.addEventListener('click', () => {
        const currentParsed = parseAnyInput(this.rawInputText);
        this.customColumnLabels = adoptCsvHeadersAsDisplayLabels(
          this.currentMapping,
          currentParsed.headers,
          this.customColumnLabels
        );
        this.editingLabelKey = null;
        this.updateImportPreviewOnly(wrap);
        this.applyDataWithThematicSynthesis(
          this.bridge.getData(),
          'Adopted CSV column headers as displayed column names across all report sections',
          { triggerAi: false }
        );
      });
    }

    const resetLabelsBtn = wrap.querySelector('#studioResetColLabelsBtn');
    if (resetLabelsBtn) {
      resetLabelsBtn.addEventListener('click', () => {
        this.customColumnLabels = cloneColumnLabels(DEFAULT_COLUMN_DISPLAY_LABELS);
        this.editingLabelKey = null;
        this.updateImportPreviewOnly(wrap);
        this.applyDataWithThematicSynthesis(
          this.bridge.getData(),
          'Restored default column mapping display names',
          { triggerAi: false }
        );
      });
    }

    const textarea = wrap.querySelector('#studioRawTextarea') as HTMLTextAreaElement;
    textarea.value = this.rawInputText;

    const targetSelect = wrap.querySelector('#studioTargetSelect') as HTMLSelectElement;
    targetSelect.addEventListener('change', () => {
      this.selectedTarget = targetSelect.value as ImportTargetSection;
      this.renderImportTab();
    });

    // Bind Excel workbook inspector controls if active
    if (wb) {
      wrap.querySelectorAll('[data-xlsx-sheet]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sheetName = btn.getAttribute('data-xlsx-sheet') || '';
          const targetSheet = wb.sheets.find(s => s.name === sheetName);
          if (!targetSheet) return;
          wb.activeSheetName = targetSheet.name;
          this.rawInputText = targetSheet.csvText;
          this.selectedTarget = 'auto';
          this.currentMapping = autoDetectColumnMapping(targetSheet.headers);
          this.setStatus(
            `Switched to Excel worksheet "${targetSheet.name}" (${targetSheet.rows.length} rows → [${targetSheet.detectedTarget}]).`,
            'info'
          );
          this.renderImportTab();
        });
      });

      const importAllBtn = wrap.querySelector('#studioImportAllSheetsBtn');
      if (importAllBtn) {
        importAllBtn.addEventListener('click', () => {
          const batchResult = importAllXlsxSheets(wb, this.bridge.getData());
          this.applyDataWithThematicSynthesis(batchResult.data, batchResult.summary);
        });
      }

      const dismissWbBtn = wrap.querySelector('#studioDismissWorkbookBtn');
      if (dismissWbBtn) {
        dismissWbBtn.addEventListener('click', () => {
          this.loadedWorkbook = null;
          this.renderImportTab();
        });
      }
    }

    // Load template CSV for the active section into textarea
    wrap.querySelector('#studioLoadTemplateBtn')!.addEventListener('click', () => {
      const targetForCsv =
        this.selectedTarget === 'auto' || this.selectedTarget === 'full-json'
          ? 'master-records'
          : this.selectedTarget;
      this.loadedWorkbook = null;
      this.rawInputText = FolioDataImporter.exportSectionToCsv(
        this.bridge.getData(),
        targetForCsv
      );
      this.currentMapping = autoDetectColumnMapping(parseAnyInput(this.rawInputText).headers);
      this.setStatus(`Loaded template for [${targetForCsv}] into editor.`, 'info');
      this.renderImportTab();
    });

    // Download single-section template .XLSX
    wrap.querySelector('#studioDownloadTemplateXlsxBtn')!.addEventListener('click', () => {
      const targetForXlsx =
        this.selectedTarget === 'auto' || this.selectedTarget === 'full-json'
          ? 'master-records'
          : this.selectedTarget;
      const buf = exportFolioToXlsxBuffer(this.bridge.getData(), targetForXlsx);
      this.downloadBinaryBlob(
        buf,
        `folio-template-${targetForXlsx}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      this.setStatus(`Downloaded Excel template: folio-template-${targetForXlsx}.xlsx`, 'ok');
    });

    // Download 15-tab full workbook template .XLSX
    wrap.querySelector('#studioDownloadFullWorkbookXlsxBtn')!.addEventListener('click', () => {
      const buf = exportFolioToXlsxBuffer(this.bridge.getData(), 'all-sheets');
      this.downloadBinaryBlob(
        buf,
        'folio-15-tab-template-workbook.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      this.setStatus(
        'Downloaded 15-worksheet Excel template workbook: folio-15-tab-template-workbook.xlsx',
        'ok'
      );
    });

    // Download template CSV
    wrap.querySelector('#studioDownloadTemplateBtn')!.addEventListener('click', () => {
      const targetForCsv =
        this.selectedTarget === 'auto' || this.selectedTarget === 'full-json'
          ? 'master-records'
          : this.selectedTarget;
      const csv = FolioDataImporter.exportSectionToCsv(this.bridge.getData(), targetForCsv);
      this.downloadBlob(csv, `folio-template-${targetForCsv}.csv`, 'text/csv;charset=utf-8;');
      this.setStatus(`Downloaded CSV template: folio-template-${targetForCsv}.csv`, 'ok');
    });

    // Load current DATA as JSON
    wrap.querySelector('#studioLoadCurrentJsonBtn')!.addEventListener('click', () => {
      this.loadedWorkbook = null;
      this.selectedTarget = 'full-json';
      this.rawInputText = formatFolioDataAsJson(this.bridge.getData());
      this.setStatus('Loaded current full Folio DATA object as JSON.', 'info');
      this.renderImportTab();
    });

    // Presets
    wrap.querySelectorAll('[data-preset-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-preset-id');
        const preset = DATASET_PRESETS.find(p => p.id === pid);
        if (!preset) return;
        this.loadedWorkbook = null;
        const clonedData = cloneFolioData(preset.data);
        const clonedMeta = cloneReportMeta(preset.meta);
        this.customColumnLabels = cloneColumnLabels(
          clonedMeta.columnLabels || DEFAULT_COLUMN_DISPLAY_LABELS
        );
        this.contextPrompt = clonedMeta.contextPrompt || '';
        this.rawInputText = preset.sampleMasterCsv;
        this.currentMapping = autoDetectColumnMapping(parseAnyInput(this.rawInputText).headers);
        this.bridge.setData(clonedData, clonedMeta);
        this.persistDataset(clonedData, clonedMeta);
        this.updateQuickBarSummary();
        this.setStatus(`Loaded preset "${preset.name}" and updated all 10 dashboard charts & thematic phrasing!`, 'ok');
        this.renderImportTab();
      });
    });

    // File upload & drag-drop (.xlsx, .xls, .csv, .tsv, .json, .html)
    const fileInput = wrap.querySelector('#studioFileInput') as HTMLInputElement;
    const dropzone = wrap.querySelector('#studioDropzone') as HTMLElement;

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        this.processUploadedFile(fileInput.files[0], false);
        fileInput.value = '';
      }
    });

    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('is-dragover');
    });
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.processUploadedFile(e.dataTransfer.files[0], false);
      }
    });

    // Live textarea edits
    let debounce: number | undefined;
    textarea.addEventListener('input', () => {
      this.rawInputText = textarea.value;
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        const p = parseAnyInput(this.rawInputText);
        this.currentMapping = autoDetectColumnMapping(p.headers);
        this.updateImportPreviewOnly(wrap);
      }, 180);
    });

    // Transform & Apply button (gated by Header Validation Utility & Row Validator)
    wrap.querySelector('#studioApplyImportBtn')!.addEventListener('click', () => {
      const currentParsed = parseAnyInput(this.rawInputText);
      const currentDetected =
        this.selectedTarget === 'auto'
          ? autoDetectTargetSection(currentParsed)
          : this.selectedTarget;
      const rowVal = validateUploadedRows(
        currentParsed,
        currentDetected,
        this.currentMapping
      );

      // If some rows failed format validation, automatically exclude failed rows if valid rows exist
      let textToImport = this.rawInputText;
      let excludedNote = '';
      if (
        rowVal.totalRows > 0 &&
        rowVal.failedCount > 0 &&
        rowVal.passedCount + rowVal.warningCount > 0
      ) {
        textToImport = filterOutFailedRowsToCsv(currentParsed.headers, rowVal);
        excludedNote = ` [Skipped ${rowVal.failedCount} failed row${
          rowVal.failedCount > 1 ? 's' : ''
        } with invalid format]`;
      } else if (rowVal.totalRows > 0 && rowVal.failedCount === rowVal.totalRows) {
        this.setStatus(
          `Import blocked: All ${rowVal.totalRows} rows failed data format validation. Fix the highlighted errors in the Visual Validation Summary Panel below.`,
          'warn'
        );
        this.updateImportPreviewOnly(wrap);
        return;
      }

      const result = FolioDataImporter.importFromText(textToImport, {
        target: this.selectedTarget,
        mapping: this.currentMapping,
        baseData: this.bridge.getData(),
        autoFix: true,
        strictHeaders: true
      });

      if (!result.headerValidation.valid) {
        this.setStatus(result.headerValidation.summary, 'warn');
        this.updateImportPreviewOnly(wrap);
        return;
      }

      this.contextPrompt = contextInput.value.trim();
      this.applyDataWithThematicSynthesis(
        result.data,
        `${result.summary}${excludedNote} (${result.validation.issues.length} auto-normalized checks)`
      );
    });

    this.updateImportPreviewOnly(wrap);
  }

  /**
   * Builds the HTML for the Visual Row-by-Row Validation Summary Panel
   * showing Passed, Warning, and Failed rows with cell-level format error messages.
   */
  private buildVisualRowValidationPanelHtml(
    rowValidation: RowValidationSummary,
    headerValid: boolean,
    stepLabel = '4. Visual Row-by-Row Data Format Validation Summary'
  ): string {
    const total = rowValidation.totalRows;
    if (total === 0) {
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--s-2);">
          <span class="studio-label">${stepLabel}</span>
          <span class="mono-meta">No tabular rows to inspect</span>
        </div>
      `;
    }

    const passedPct = Number(((rowValidation.passedCount / total) * 100).toFixed(1));
    const warningPct = Number(((rowValidation.warningCount / total) * 100).toFixed(1));
    const failedPct = Number(((rowValidation.failedCount / total) * 100).toFixed(1));
    const validRowCount = rowValidation.passedCount + rowValidation.warningCount;

    const filteredRows = rowValidation.rows.filter(r => {
      if (this.rowFilterStatus === 'all') return true;
      return r.status === this.rowFilterStatus;
    });

    const overallBadgeText =
      rowValidation.failedCount > 0
        ? `✕ ${rowValidation.failedCount} ROW${rowValidation.failedCount > 1 ? 'S' : ''} FAILED (${rowValidation.errorMessageCount} ERRORS)`
        : rowValidation.warningCount > 0
          ? `⚠ ${rowValidation.warningCount} ROW${rowValidation.warningCount > 1 ? 'S' : ''} WITH WARNINGS`
          : `✓ ALL ${total} ROWS PASSED`;

    const overallBadgeStatus =
      rowValidation.failedCount > 0
        ? 'failed'
        : rowValidation.warningCount > 0
          ? 'warning'
          : 'passed';

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    return `
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:var(--s-2);">
        <div>
          <span class="studio-label">${stepLabel}</span>
          <p class="fig-text" style="margin-top:2px;">${escapeHtml(rowValidation.summaryText)}</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--s-2);">
          <span class="studio-row-badge" data-status="${overallBadgeStatus}">${overallBadgeText}</span>
          <button
            type="button"
            class="fig-table-btn"
            data-val-action="load-test-errors"
            title="Load a diagnostic sample dataset containing passed rows, warnings, and format errors (#VALUE!, TBD, negative counts, missing fields)"
          >
            Test Sample with Format Errors
          </button>
          ${
            rowValidation.failedCount > 0 && validRowCount > 0 && headerValid
              ? `<button
                  type="button"
                  class="studio-cta-btn"
                  data-val-action="clean-and-apply"
                  title="Remove the ${rowValidation.failedCount} failed row(s) from the input and apply the ${validRowCount} valid rows to the dashboard"
                >
                  Exclude ${rowValidation.failedCount} Failed &amp; Apply ${validRowCount} Valid Rows →
                </button>`
              : ''
          }
        </div>
      </div>

      <div class="studio-kpi-row" style="margin-top:var(--s-2);">
        <div class="studio-kpi-card">
          <span class="studio-label">Rows Inspected</span>
          <span class="studio-kpi-num num">${total}</span>
          <span class="mono-meta" style="display:block;margin-top:2px;">Lines 2–${total + 1} in file</span>
        </div>
        <div class="studio-kpi-card" style="border-color:${
          rowValidation.passedCount > 0 ? 'var(--violet-ink)' : 'var(--rule)'
        };">
          <span class="studio-label" style="color:var(--violet-ink);">✓ Passed Rows</span>
          <span class="studio-kpi-num num" style="color:var(--violet-ink);">${rowValidation.passedCount}</span>
          <span class="mono-meta num" style="display:block;margin-top:2px;">${passedPct}% strict pass</span>
        </div>
        <div class="studio-kpi-card" style="border-color:${
          rowValidation.warningCount > 0 ? 'var(--ink)' : 'var(--rule)'
        };">
          <span class="studio-label">⚠ Rows with Warnings</span>
          <span class="studio-kpi-num num">${rowValidation.warningCount}</span>
          <span class="mono-meta num" style="display:block;margin-top:2px;">${rowValidation.warningMessageCount} auto-normalized notice${
            rowValidation.warningMessageCount === 1 ? '' : 's'
          }</span>
        </div>
        <div class="studio-kpi-card" style="border-color:${
          rowValidation.failedCount > 0 ? 'var(--vermilion-ink)' : 'var(--rule)'
        };">
          <span class="studio-label" style="color:${
            rowValidation.failedCount > 0 ? 'var(--vermilion-ink)' : 'var(--ink-3)'
          };">✕ Failed Rows</span>
          <span class="studio-kpi-num num" style="color:${
            rowValidation.failedCount > 0 ? 'var(--vermilion-ink)' : 'var(--ink)'
          };">${rowValidation.failedCount}</span>
          <span class="mono-meta num" style="display:block;margin-top:2px;">${rowValidation.errorMessageCount} invalid format error${
            rowValidation.errorMessageCount === 1 ? '' : 's'
          }</span>
        </div>
      </div>

      <div style="margin-top:var(--s-1);">
        <div class="studio-val-bar" role="img" aria-label="Row validation distribution: ${passedPct}% passed, ${warningPct}% warnings, ${failedPct}% failed">
          <div class="studio-val-bar-seg studio-val-bar-seg--passed" style="width:${passedPct}%;" title="Passed: ${rowValidation.passedCount} rows (${passedPct}%)"></div>
          <div class="studio-val-bar-seg studio-val-bar-seg--warning" style="width:${warningPct}%;" title="Warnings: ${rowValidation.warningCount} rows (${warningPct}%)"></div>
          <div class="studio-val-bar-seg studio-val-bar-seg--failed" style="width:${failedPct}%;" title="Failed: ${rowValidation.failedCount} rows (${failedPct}%)"></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);margin-top:var(--s-2);">
          <div class="seg-group" role="group" aria-label="Filter rows by validation status">
            <button type="button" class="seg-btn" data-row-filter="all" aria-pressed="${
              this.rowFilterStatus === 'all'
            }">All Rows (${total})</button>
            <button type="button" class="seg-btn" data-row-filter="failed" aria-pressed="${
              this.rowFilterStatus === 'failed'
            }">✕ Failed (${rowValidation.failedCount})</button>
            <button type="button" class="seg-btn" data-row-filter="warning" aria-pressed="${
              this.rowFilterStatus === 'warning'
            }">⚠ Warnings (${rowValidation.warningCount})</button>
            <button type="button" class="seg-btn" data-row-filter="passed" aria-pressed="${
              this.rowFilterStatus === 'passed'
            }">✓ Passed (${rowValidation.passedCount})</button>
          </div>
          <span class="mono-meta num">Showing ${filteredRows.length} of ${total} row${
            total === 1 ? '' : 's'
          }</span>
        </div>
      </div>

      <div class="table-scroll" style="margin-top:var(--s-1);max-height:260px;overflow-y:auto;">
        <table class="data-table" aria-label="Row-by-row validation diagnostics">
          <thead>
            <tr>
              <th style="width:110px;">Row / File Line</th>
              <th style="width:115px;">Status</th>
              <th style="width:180px;">Record Identifier</th>
              <th>Format Validation Details &amp; Error Messages</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredRows.length === 0
                ? `<tr><td colspan="4" class="mono-meta" style="text-align:center;padding:var(--s-3);">No rows match the selected "${this.rowFilterStatus.toUpperCase()}" filter.</td></tr>`
                : filteredRows
                    .map(r => {
                      const statusLabel =
                        r.status === 'passed'
                          ? '✓ PASSED'
                          : r.status === 'warning'
                            ? '⚠ WARNING'
                            : '✕ FAILED';
                      return `
                        <tr>
                          <td class="mono-meta num">Row #${r.rowIndex} <span style="opacity:0.7;">(L${r.fileLineNumber})</span></td>
                          <td><span class="studio-row-badge" data-status="${r.status}">${statusLabel}</span></td>
                          <td style="font-weight:500;">${escapeHtml(r.primaryLabel)}</td>
                          <td>
                            ${
                              r.messages.length === 0
                                ? `<span class="mono-meta" style="color:var(--violet-ink);">✓ All required &amp; optional column formats valid</span>`
                                : `<div class="studio-cell-issue-list">
                                    ${r.messages
                                      .map(
                                        m => `
                                        <div class="studio-cell-issue" data-severity="${m.severity}">
                                          <strong style="color:${
                                            m.severity === 'error'
                                              ? 'var(--vermilion-ink)'
                                              : 'var(--ink)'
                                          };">${
                                            m.severity === 'error' ? '✕ Error' : '⚠ Warning'
                                          } in <code>"${escapeHtml(m.column)}"</code>:</strong>
                                          <span class="studio-raw-pill" title="Raw cell value">${escapeHtml(
                                            m.rawValue
                                          )}</span>
                                          <span>${escapeHtml(m.message)}</span>
                                          <span class="mono-meta">[Expected: ${escapeHtml(
                                            m.expectedFormat
                                          )}]</span>
                                        </div>
                                      `
                                      )
                                      .join('')}
                                  </div>`
                            }
                          </td>
                        </tr>
                      `;
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    `;
  }

  private bindVisualRowValidationEvents(
    host: HTMLElement,
    rowValidation: RowValidationSummary,
    headers: string[],
    onUpdate: () => void
  ): void {
    host.querySelectorAll('[data-row-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-row-filter') as 'all' | RowValidationStatus;
        this.rowFilterStatus = filter || 'all';
        onUpdate();
      });
    });

    const loadTestBtn = host.querySelector('[data-val-action="load-test-errors"]');
    if (loadTestBtn) {
      loadTestBtn.addEventListener('click', () => {
        this.loadedWorkbook = null;
        this.selectedTarget = 'master-records';
        this.rawInputText = SAMPLE_VALIDATION_TEST_CSV;
        this.currentMapping = autoDetectColumnMapping(parseAnyInput(this.rawInputText).headers);
        this.rowFilterStatus = 'all';
        this.setStatus(
          'Loaded diagnostic sample with intentional format errors (#VALUE!, "TBD", negative counts, >100% policy, missing market). Inspect the Visual Validation Summary Panel below!',
          'warn'
        );
        if (this.activeTab === 'import') {
          this.renderImportTab();
        } else {
          this.renderValidateTab();
        }
      });
    }

    const cleanApplyBtn = host.querySelector('[data-val-action="clean-and-apply"]');
    if (cleanApplyBtn) {
      cleanApplyBtn.addEventListener('click', () => {
        const cleanedCsv = filterOutFailedRowsToCsv(headers, rowValidation);
        const removedCount = rowValidation.failedCount;
        const keptCount = rowValidation.passedCount + rowValidation.warningCount;
        this.rawInputText = cleanedCsv;
        this.rowFilterStatus = 'all';

        const result = FolioDataImporter.importFromText(this.rawInputText, {
          target: this.selectedTarget,
          mapping: this.currentMapping,
          baseData: this.bridge.getData(),
          autoFix: true,
          strictHeaders: true
        });

        this.applyDataWithThematicSynthesis(
          result.data,
          `Excluded ${removedCount} failed row${
            removedCount > 1 ? 's' : ''
          } and applied ${keptCount} valid rows to the dashboard!`
        );
        if (this.activeTab === 'import') {
          this.renderImportTab();
        } else {
          this.renderValidateTab();
        }
      });
    }
  }

  private updateImportPreviewOnly(wrap: HTMLElement): void {
    const parsed = parseAnyInput(this.rawInputText);
    const detected =
      this.selectedTarget === 'auto' ? autoDetectTargetSection(parsed) : this.selectedTarget;
    const detectedInfo = SECTION_TARGETS.find(t => t.id === detected) || SECTION_TARGETS[0];

    const metaSpan = wrap.querySelector('#studioParseMeta');
    if (metaSpan) {
      metaSpan.textContent = `Format: ${parsed.format.toUpperCase()} · ${
        parsed.format === 'folio-json' || parsed.format === 'html-data'
          ? `${parsed.headers.length} top-level DATA keys`
          : `${parsed.rows.length} rows · ${parsed.headers.length} columns`
      } → Routing to: ${detectedInfo.label}`;
    }

    const headerValidation = validateCsvHeaders(parsed.headers, detected, this.currentMapping);
    const rowValidation = validateUploadedRows(parsed, detected, this.currentMapping);

    const allRowsFailed =
      rowValidation.totalRows > 0 && rowValidation.failedCount === rowValidation.totalRows;
    const canApply = headerValidation.valid && !allRowsFailed;

    const applyBtn = wrap.querySelector('#studioApplyImportBtn') as HTMLButtonElement | null;
    if (applyBtn) {
      applyBtn.disabled = !canApply;
      applyBtn.style.opacity = canApply ? '1' : '0.45';
      applyBtn.style.cursor = canApply ? 'pointer' : 'not-allowed';
      applyBtn.title = allRowsFailed
        ? `All ${rowValidation.totalRows} rows contain format errors.`
        : headerValidation.summary;
    }

    const headerValBox = wrap.querySelector('#studioHeaderValidationBox') as HTMLElement | null;
    if (headerValBox) {
      if (parsed.format === 'folio-json' || parsed.format === 'html-data') {
        headerValBox.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--s-2);">
            <span class="studio-label">3. Pre-Transformation Header &amp; Key Check</span>
            <span class="mono-meta" style="color:var(--violet-ink);font-weight:600;">✓ PASS · Structured DATA Object (${parsed.headers.length} keys)</span>
          </div>
          <p class="fig-text">Detected structured JSON / HTML <code>DATA</code> block. Ready for template transformation.</p>
        `;
      } else {
        const reqMatches = headerValidation.matched.filter(m => m.required);
        const optMatches = headerValidation.matched.filter(m => !m.required);
        headerValBox.innerHTML = `
          <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);">
            <div>
              <span class="studio-label">3. Pre-Transformation CSV Header Validation (${detectedInfo.badge})</span>
              <p class="fig-text" style="margin-top:2px;">${headerValidation.summary}</p>
            </div>
            <span class="mono-meta" style="padding:3px 8px;border:1px solid ${
              headerValidation.valid ? 'var(--violet-ink)' : 'var(--vermilion-ink)'
            };color:${
              headerValidation.valid ? 'var(--violet-ink)' : 'var(--vermilion-ink)'
            };font-weight:600;">
              ${
                headerValidation.valid
                  ? `✓ PASS (${reqMatches.length} required columns verified)`
                  : `✕ BLOCKED (${headerValidation.missing.length} required column${
                      headerValidation.missing.length > 1 ? 's' : ''
                    } missing)`
              }
            </span>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:var(--s-2);margin-top:var(--s-2);">
            ${reqMatches
              .map(
                m => `
                <span class="mono-meta" style="padding:4px 8px;border:1px solid var(--ink);background:var(--paper);">
                  <strong style="color:var(--violet-ink);">✓ ${m.key}</strong> → <code>"${m.matchedHeader}"</code> (${m.matchType})
                </span>
              `
              )
              .join('')}
            ${headerValidation.missing
              .map(
                miss => `
                <span class="mono-meta" style="padding:4px 8px;border:1px solid var(--vermilion-ink);background:var(--paper);color:var(--vermilion-ink);">
                  <strong>✕ Missing '${miss.key}'</strong> (${miss.label} · expected ${miss.expectedExamples
                    .map(e => `"${e}"`)
                    .join(' / ')}${
                    miss.suggestedHeader ? ` · closest: "${miss.suggestedHeader}"` : ''
                  })
                </span>
              `
              )
              .join('')}
            ${optMatches
              .map(
                m => `
                <span class="mono-meta" style="padding:4px 8px;border:1px solid var(--rule);background:var(--paper);color:var(--ink-2);">
                  + optional <strong>${m.key}</strong> → <code>"${m.matchedHeader}"</code>
                </span>
              `
              )
              .join('')}
          </div>
        `;
      }
    }

    const rowValBox = wrap.querySelector('#studioRowValidationBox') as HTMLElement | null;
    if (rowValBox) {
      if (parsed.rows.length === 0) {
        rowValBox.hidden = true;
      } else {
        rowValBox.hidden = false;
        rowValBox.innerHTML = this.buildVisualRowValidationPanelHtml(
          rowValidation,
          headerValidation.valid
        );
        this.bindVisualRowValidationEvents(rowValBox, rowValidation, parsed.headers, () =>
          this.updateImportPreviewOnly(wrap)
        );
      }
    }

    const mappingBox = wrap.querySelector('#studioMappingBox') as HTMLElement;
    const mapGrid = wrap.querySelector('#studioMapGrid') as HTMLElement;
    const previewWrap = wrap.querySelector('#studioPreviewTableWrap') as HTMLElement;

    if (!mappingBox || !mapGrid || !previewWrap) return;

    if (parsed.rows.length === 0) {
      mappingBox.hidden = true;
      return;
    }
    mappingBox.hidden = false;

    const mapFields: {
      key: keyof ColumnMappingConfig;
      labelKey: keyof ColumnDisplayLabels;
      defaultLabel: string;
    }[] = [
      {
        key: 'marketCol',
        labelKey: 'market',
        defaultLabel: DEFAULT_COLUMN_DISPLAY_LABELS.market
      },
      {
        key: 'regionCol',
        labelKey: 'region',
        defaultLabel: DEFAULT_COLUMN_DISPLAY_LABELS.region
      },
      {
        key: 'shareCol',
        labelKey: 'value',
        defaultLabel: DEFAULT_COLUMN_DISPLAY_LABELS.value
      },
      {
        key: 'recordsCol',
        labelKey: 'count',
        defaultLabel: DEFAULT_COLUMN_DISPLAY_LABELS.count
      },
      {
        key: 'tierCol',
        labelKey: 'tier',
        defaultLabel: DEFAULT_COLUMN_DISPLAY_LABELS.tier
      },
      {
        key: 'segmentCol',
        labelKey: 'segment',
        defaultLabel: DEFAULT_COLUMN_DISPLAY_LABELS.segment
      },
      {
        key: 'policyCol',
        labelKey: 'policy',
        defaultLabel: DEFAULT_COLUMN_DISPLAY_LABELS.policy
      },
      {
        key: 'bpsCol',
        labelKey: 'bps',
        defaultLabel: DEFAULT_COLUMN_DISPLAY_LABELS.bps
      },
      {
        key: 'deltaCol',
        labelKey: 'delta',
        defaultLabel: DEFAULT_COLUMN_DISPLAY_LABELS.delta
      }
    ];

    const escapeAttr = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const optsHtml = (selected?: string) =>
      `<option value="">— Auto / None —</option>` +
      parsed.headers
        .map(
          h =>
            `<option value="${escapeAttr(h)}" ${
              h === selected ? 'selected' : ''
            }>${escapeAttr(h)}</option>`
        )
        .join('');

    mapGrid.innerHTML = mapFields
      .map(f => {
        const displayLabel = this.customColumnLabels[f.labelKey] || f.defaultLabel;
        const isEditing = this.editingLabelKey === f.labelKey;
        return `
        <div class="studio-map-field-card ${isEditing ? 'is-editing' : ''}" data-field-card="${f.labelKey}">
          <div class="studio-map-label-row">
            ${
              isEditing
                ? `
                  <input
                    type="text"
                    class="studio-inline-label-input"
                    data-col-label-input="${f.labelKey}"
                    value="${escapeAttr(displayLabel)}"
                    aria-label="Edit display name for ${escapeAttr(f.defaultLabel)}"
                  >
                  <button
                    type="button"
                    class="studio-inline-edit-badge"
                    data-col-label-save="${f.labelKey}"
                    title="Save custom column display name"
                  >✓ Save</button>
                `
                : `
                  <button
                    type="button"
                    class="studio-inline-label-trigger"
                    data-col-label-edit="${f.labelKey}"
                    title="Click to inline-edit this column's displayed name (currently: ${escapeAttr(displayLabel)})"
                  >
                    <span>${escapeAttr(displayLabel)}</span>
                  </button>
                  <button
                    type="button"
                    class="studio-inline-edit-badge"
                    data-col-label-edit="${f.labelKey}"
                    title="Rename '${escapeAttr(displayLabel)}'"
                  >✎ Rename</button>
                `
            }
          </div>
          <select class="studio-select" data-map-key="${f.key}" style="height:28px;font-size:12px;" aria-label="${escapeAttr(displayLabel)} source column">
            ${optsHtml(this.currentMapping[f.key] as string | undefined)}
          </select>
        </div>
      `;
      })
      .join('');

    const commitLabelEdit = (labelKey: keyof ColumnDisplayLabels, rawNewVal: string) => {
      const cleaned = rawNewVal.trim() || DEFAULT_COLUMN_DISPLAY_LABELS[labelKey];
      const changed = this.customColumnLabels[labelKey] !== cleaned;
      this.customColumnLabels[labelKey] = cleaned;
      this.editingLabelKey = null;
      this.updateImportPreviewOnly(wrap);
      if (changed) {
        this.applyDataWithThematicSynthesis(
          this.bridge.getData(),
          `Renamed column "${labelKey}" to "${cleaned}" across all report charts, tables & prose`,
          { triggerAi: false }
        );
      }
    };

    mapGrid.querySelectorAll('[data-col-label-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-col-label-edit') as keyof ColumnDisplayLabels;
        this.editingLabelKey = k;
        this.updateImportPreviewOnly(wrap);
        const inp = mapGrid.querySelector(
          `[data-col-label-input="${k}"]`
        ) as HTMLInputElement | null;
        if (inp) {
          inp.focus();
          inp.select();
        }
      });
    });

    mapGrid.querySelectorAll('[data-col-label-save]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        // Prevent blur from firing before click
        e.preventDefault();
      });
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-col-label-save') as keyof ColumnDisplayLabels;
        const inp = mapGrid.querySelector(
          `[data-col-label-input="${k}"]`
        ) as HTMLInputElement | null;
        commitLabelEdit(k, inp ? inp.value : '');
      });
    });

    mapGrid.querySelectorAll('[data-col-label-input]').forEach(node => {
      const inp = node as HTMLInputElement;
      const k = inp.getAttribute('data-col-label-input') as keyof ColumnDisplayLabels;
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitLabelEdit(k, inp.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.editingLabelKey = null;
          this.updateImportPreviewOnly(wrap);
        }
      });
      inp.addEventListener('blur', () => {
        if (this.editingLabelKey === k) {
          commitLabelEdit(k, inp.value);
        }
      });
    });

    mapGrid.querySelectorAll('[data-map-key]').forEach(sel => {
      sel.addEventListener('change', () => {
        const k = sel.getAttribute('data-map-key') as keyof ColumnMappingConfig;
        const val = (sel as HTMLSelectElement).value;
        (this.currentMapping as Record<string, unknown>)[k] = val || undefined;
        this.updateImportPreviewOnly(wrap);
      });
    });

    // Build preview table of first 12 rows with inline cell-level validation highlighting
    // Also show which custom display label each mapped CSV column corresponds to
    const headerToCustomDisplay = new Map<string, string>();
    mapFields.forEach(f => {
      const mappedCol = this.currentMapping[f.key] as string | undefined;
      if (mappedCol) {
        headerToCustomDisplay.set(
          mappedCol,
          this.customColumnLabels[f.labelKey] || f.defaultLabel
        );
      }
    });

    const previewEntries = rowValidation.rows.slice(0, 12);
    const ths =
      `<th style="width:95px;">Row Status</th>` +
      parsed.headers
        .map(h => {
          const customDisp = headerToCustomDisplay.get(h);
          return customDisp && customDisp !== h
            ? `<th><div>${escapeAttr(h)}</div><div class="mono-meta" style="color:var(--violet-ink);font-size:10px;font-weight:500;">→ ${escapeAttr(customDisp)}</div></th>`
            : `<th>${escapeAttr(h)}</th>`;
        })
        .join('');
    const trs = previewEntries
      .map(entry => {
        const badgeIcon =
          entry.status === 'passed' ? '✓' : entry.status === 'warning' ? '⚠' : '✕';
        const statusCell = `<td><span class="studio-row-badge" data-status="${entry.status}">${badgeIcon} #${entry.rowIndex}</span></td>`;
        const dataCells = parsed.headers
          .map(h => {
            const cellMsgs = entry.messages.filter(m => m.column === h);
            const hasErr = cellMsgs.some(m => m.severity === 'error');
            const hasWarn = !hasErr && cellMsgs.some(m => m.severity === 'warning');
            const cls = hasErr ? 'cell-has-error' : hasWarn ? 'cell-has-warning' : '';
            const titleAttr =
              cellMsgs.length > 0
                ? `title="${cellMsgs
                    .map(m => `${m.severity.toUpperCase()}: ${m.message} (Expected: ${m.expectedFormat})`)
                    .join(' | ')
                    .replace(/"/g, '&quot;')}"`
                : '';
            const rawVal = entry.rawRow[h] !== undefined ? entry.rawRow[h] : '';
            return `<td class="${cls}" ${titleAttr}>${rawVal !== '' ? rawVal : '<span style="opacity:0.45;">(empty)</span>'}</td>`;
          })
          .join('');
        return `<tr>${statusCell}${dataCells}</tr>`;
      })
      .join('');
    previewWrap.innerHTML = `
      <table class="data-table">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    `;
  }

  /* ============================================================================
   * TAB 2: VISUAL SECTION & METADATA EDITOR (01–10)
   * ============================================================================ */
  private renderEditorTab(): void {
    const data = this.bridge.getData();
    const meta = this.bridge.getMeta();
    const colLabels = cloneColumnLabels(meta.columnLabels || this.customColumnLabels);
    const sectionCsv = FolioDataImporter.exportSectionToCsv(data, this.editorSection);
    const sectionObj = SECTION_TARGETS.find(s => s.id === this.editorSection) || SECTION_TARGETS[3];

    const editableSections = SECTION_TARGETS.filter(
      s => s.id !== 'auto' && s.id !== 'full-json' && s.id !== 'master-records'
    );

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = 'var(--s-4)';

    wrap.innerHTML = `
      <div class="studio-box studio-box--strong">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);">
          <div>
            <span class="studio-label">Thematic Dataset Context &amp; Custom Column Display Names</span>
            <p class="fig-text" style="margin-top:2px;">Update the dataset context prompt or any column mapping display name and click <strong>Update &amp; Re-Synthesize Report</strong> to propagate across all 10 sections.</p>
          </div>
          <button type="button" class="studio-cta-btn" id="studioEditorSynthesizeBtn">Update &amp; Re-Synthesize Report (AI + Data) →</button>
        </div>
        <div class="studio-map-field" style="margin-top:var(--s-1);">
          <label>Dataset Context Prompt (describes what the imported data represents)</label>
          <input type="text" class="studio-input" id="editorContextPrompt" value="${(meta.contextPrompt || this.contextPrompt || '').replace(/"/g, '&quot;')}">
        </div>
        <div class="studio-map-grid" style="margin-top:var(--s-2);">
          <div class="studio-map-field">
            <label>Primary Entity Column Name (market)</label>
            <input type="text" class="studio-input" id="colLabelMarket" value="${colLabels.market.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Region / Geography Column Name (region)</label>
            <input type="text" class="studio-input" id="colLabelRegion" value="${colLabels.region.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Primary Value / Share Metric Name (value)</label>
            <input type="text" class="studio-input" id="colLabelValue" value="${colLabels.value.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Record Count Column Name (count)</label>
            <input type="text" class="studio-input" id="colLabelCount" value="${colLabels.count.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Tier / Scale Dimension Name (tier)</label>
            <input type="text" class="studio-input" id="colLabelTier" value="${colLabels.tier.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Segment / Role Dimension Name (segment)</label>
            <input type="text" class="studio-input" id="colLabelSegment" value="${colLabels.segment.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Policy / Readiness Metric Name (policy)</label>
            <input type="text" class="studio-input" id="colLabelPolicy" value="${colLabels.policy.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Efficiency / Cost Metric Name (bps)</label>
            <input type="text" class="studio-input" id="colLabelBps" value="${colLabels.bps.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>YoY Change / Delta Metric Name (delta)</label>
            <input type="text" class="studio-input" id="colLabelDelta" value="${colLabels.delta.replace(/"/g, '&quot;')}">
          </div>
        </div>
      </div>

      <div class="studio-box">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);">
          <span class="studio-label">Report Masthead &amp; Hero Metadata</span>
          <button type="button" class="studio-cta-btn" id="studioSaveMetaBtn">Update Report Headings &amp; KPIs</button>
        </div>
        <div class="studio-map-grid" style="margin-top:var(--s-1);">
          <div class="studio-map-field">
            <label>Brand Logotype</label>
            <input type="text" class="studio-input" id="metaBrand" value="${meta.brand.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Report Title</label>
            <input type="text" class="studio-input" id="metaTitle" value="${meta.title.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Edition / Year</label>
            <input type="text" class="studio-input" id="metaYear" value="${meta.year.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Figure Source Attribution</label>
            <input type="text" class="studio-input" id="metaSource" value="${meta.sourceLabel.replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Hero Headline Line 1</label>
            <input type="text" class="studio-input" id="metaH1" value="${meta.heroHeadline[0].replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Hero Headline Line 2</label>
            <input type="text" class="studio-input" id="metaH2" value="${meta.heroHeadline[1].replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Hero Headline Line 3</label>
            <input type="text" class="studio-input" id="metaH3" value="${meta.heroHeadline[2].replace(/"/g, '&quot;')}">
          </div>
          <div class="studio-map-field">
            <label>Masthead Subtitle</label>
            <input type="text" class="studio-input" id="metaMasthead" value="${meta.mastheadNote.replace(/"/g, '&quot;')}">
          </div>
        </div>
      </div>

      <div class="studio-box studio-box--strong">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);">
          <div style="flex:1;min-width:260px;">
            <span class="studio-label">Interactive Chart Section Dataset Editor (01–10)</span>
            <select class="studio-select" id="studioEditorSectionSelect" style="margin-top:4px;">
              ${editableSections
                .map(
                  s =>
                    `<option value="${s.id}" ${s.id === this.editorSection ? 'selected' : ''}>[${s.badge}] ${s.label}</option>`
                )
                .join('')}
            </select>
          </div>
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--s-2);">
            <button type="button" class="fig-table-btn" id="studioEditorExportXlsxBtn">Download Section .XLSX ↓</button>
            <button type="button" class="fig-table-btn" id="studioEditorExportCsvBtn">Download Section CSV ↓</button>
            <button type="button" class="studio-cta-btn" id="studioEditorApplyBtn">Apply Section Changes to Chart →</button>
          </div>
        </div>
        <p class="fig-text" style="margin-top:4px;">${sectionObj.desc} Edit rows below in CSV format and click <strong>Apply Section Changes</strong> to re-render immediately.</p>
        <textarea class="studio-textarea" id="studioSectionCsvEditor" spellcheck="false" style="min-height:240px;"></textarea>
      </div>
    `;

    this.bodyHost.appendChild(wrap);
    const secTextarea = wrap.querySelector('#studioSectionCsvEditor') as HTMLTextAreaElement;
    secTextarea.value = sectionCsv;

    wrap.querySelector('#studioEditorSectionSelect')!.addEventListener('change', e => {
      this.editorSection = (e.target as HTMLSelectElement).value as ImportTargetSection;
      this.renderEditorTab();
    });

    wrap.querySelector('#studioEditorExportXlsxBtn')!.addEventListener('click', () => {
      const buf = exportFolioToXlsxBuffer(this.bridge.getData(), this.editorSection);
      this.downloadBinaryBlob(
        buf,
        `folio-${this.editorSection}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      this.setStatus(`Downloaded ${this.editorSection}.xlsx`, 'ok');
    });

    wrap.querySelector('#studioEditorExportCsvBtn')!.addEventListener('click', () => {
      this.downloadBlob(
        secTextarea.value,
        `folio-${this.editorSection}.csv`,
        'text/csv;charset=utf-8;'
      );
      this.setStatus(`Downloaded ${this.editorSection}.csv`, 'ok');
    });

    wrap.querySelector('#studioEditorApplyBtn')!.addEventListener('click', () => {
      const res = FolioDataImporter.importFromText(secTextarea.value, {
        target: this.editorSection,
        baseData: this.bridge.getData(),
        autoFix: true,
        strictHeaders: true
      });
      if (res.headerValidation && !res.headerValidation.valid) {
        this.setStatus(res.headerValidation.summary, 'warn');
        return;
      }
      this.applyDataWithThematicSynthesis(res.data, res.summary, { triggerAi: false });
      this.renderEditorTab();
    });

    wrap.querySelector('#studioEditorSynthesizeBtn')!.addEventListener('click', () => {
      this.contextPrompt = (wrap.querySelector('#editorContextPrompt') as HTMLInputElement).value.trim();
      this.customColumnLabels = {
        ...this.customColumnLabels,
        market:
          (wrap.querySelector('#colLabelMarket') as HTMLInputElement).value.trim() ||
          DEFAULT_COLUMN_DISPLAY_LABELS.market,
        region:
          (wrap.querySelector('#colLabelRegion') as HTMLInputElement).value.trim() ||
          DEFAULT_COLUMN_DISPLAY_LABELS.region,
        value:
          (wrap.querySelector('#colLabelValue') as HTMLInputElement).value.trim() ||
          DEFAULT_COLUMN_DISPLAY_LABELS.value,
        count:
          (wrap.querySelector('#colLabelCount') as HTMLInputElement).value.trim() ||
          DEFAULT_COLUMN_DISPLAY_LABELS.count,
        tier:
          (wrap.querySelector('#colLabelTier') as HTMLInputElement).value.trim() ||
          DEFAULT_COLUMN_DISPLAY_LABELS.tier,
        segment:
          (wrap.querySelector('#colLabelSegment') as HTMLInputElement).value.trim() ||
          DEFAULT_COLUMN_DISPLAY_LABELS.segment,
        policy:
          (wrap.querySelector('#colLabelPolicy') as HTMLInputElement).value.trim() ||
          DEFAULT_COLUMN_DISPLAY_LABELS.policy,
        bps:
          (wrap.querySelector('#colLabelBps') as HTMLInputElement).value.trim() ||
          DEFAULT_COLUMN_DISPLAY_LABELS.bps,
        delta:
          (wrap.querySelector('#colLabelDelta') as HTMLInputElement).value.trim() ||
          DEFAULT_COLUMN_DISPLAY_LABELS.delta
      };
      this.applyDataWithThematicSynthesis(
        this.bridge.getData(),
        'Updated context prompt and custom column display names across all 10 sections',
        { triggerAi: true }
      );
      this.renderEditorTab();
    });

    wrap.querySelector('#studioSaveMetaBtn')!.addEventListener('click', () => {
      const updatedMeta: FolioReportMeta = {
        ...this.bridge.getMeta(),
        brand: (wrap.querySelector('#metaBrand') as HTMLInputElement).value.trim() || 'folio',
        title: (wrap.querySelector('#metaTitle') as HTMLInputElement).value.trim() || 'Data Visualization',
        year: (wrap.querySelector('#metaYear') as HTMLInputElement).value.trim() || '2026',
        sourceLabel:
          (wrap.querySelector('#metaSource') as HTMLInputElement).value.trim() ||
          'Source: Custom imported dataset',
        mastheadNote:
          (wrap.querySelector('#metaMasthead') as HTMLInputElement).value.trim() ||
          'Interactive Data Dashboard',
        heroHeadline: [
          (wrap.querySelector('#metaH1') as HTMLInputElement).value.trim() || 'Interactive data',
          (wrap.querySelector('#metaH2') as HTMLInputElement).value.trim() || 'visualizations built',
          (wrap.querySelector('#metaH3') as HTMLInputElement).value.trim() || 'to remix & share.'
        ]
      };
      this.bridge.setData(this.bridge.getData(), updatedMeta);
      this.persistDataset(this.bridge.getData(), updatedMeta);
      this.updateQuickBarSummary();
      this.setStatus('Updated report masthead, hero headline, and source attribution.', 'ok');
    });
  }

  /* ============================================================================
   * TAB 3: SCHEMA VALIDATOR & DIAGNOSTICS
   * ============================================================================ */
  private renderValidateTab(): void {
    const currentData = this.bridge.getData();
    const { data: normalized, validation } = validateAndNormalizeFolioData(currentData, {
      autoFix: false
    });
    const parsed = parseAnyInput(this.rawInputText);
    const detected =
      this.selectedTarget === 'auto' ? autoDetectTargetSection(parsed) : this.selectedTarget;
    const headerValidation = validateCsvHeaders(parsed.headers, detected, this.currentMapping);
    const rowValidation = validateUploadedRows(parsed, detected, this.currentMapping);

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = 'var(--s-4)';

    wrap.innerHTML = `
      <div class="studio-kpi-row">
        <div class="studio-kpi-card">
          <span class="studio-label">Total Sample Records</span>
          <span class="studio-kpi-num num">${currentData.heroMatrix.total.toLocaleString()}</span>
        </div>
        <div class="studio-kpi-card">
          <span class="studio-label">Indexed Markets (Sec 10)</span>
          <span class="studio-kpi-num num">${currentData.markets.length}</span>
        </div>
        <div class="studio-kpi-card">
          <span class="studio-label">Geographic Regions</span>
          <span class="studio-kpi-num num">${currentData.sampleRegion.length}</span>
        </div>
        <div class="studio-kpi-card">
          <span class="studio-label">Schema Compliance</span>
          <span class="studio-kpi-num" style="color:${
            validation.issues.length === 0 ? 'var(--violet-ink)' : 'var(--vermilion-ink)'
          };">
            ${validation.issues.length === 0 ? '100% Valid' : `${validation.issues.length} Notices`}
          </span>
        </div>
      </div>

      <div class="studio-box studio-box--strong" id="studioValidateTabRowBox">
        ${this.buildVisualRowValidationPanelHtml(
          rowValidation,
          headerValidation.valid,
          'Uploaded File Row-by-Row Validation Summary'
        )}
      </div>

      <div class="studio-box studio-box--strong">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-2);">
          <div>
            <span class="studio-label">Folio Schema &amp; Invariant Verification</span>
            <p class="fig-text">Verifies that all 10 chart structures match <code>index.html</code> contracts, percentage bars sum to 100%, and region counts balance.</p>
          </div>
          <button type="button" class="studio-cta-btn" id="studioRunAutoNormalizeBtn">Auto-Normalize All Percentages &amp; Totals</button>
        </div>

        ${
          validation.issues.length === 0
            ? `<div style="padding:var(--s-3);border:1px solid var(--rule);background:var(--paper);margin-top:var(--s-2);">
                <strong style="color:var(--violet-ink);">✓ All 10 chart schemas verified.</strong> Every section (<code>heroMatrix</code>, <code>sampleFunction</code>, <code>sampleRegion</code>, <code>priorities</code>, <code>riskLimits</code>, <code>regulationLine</code>, <code>regulationEvents</code>, <code>volume</code>, <code>exposure</code>, <code>waffle</code>, <code>likert</code>, <code>pricing</code>, <code>outlookBars</code>, <code>markets</code>) is strictly aligned with <code>index.html</code>.
              </div>`
            : `<ul class="studio-issue-list" style="margin-top:var(--s-2);">
                ${validation.issues
                  .map(
                    iss => `
                    <li class="studio-issue-item">
                      <div>
                        <strong>[${iss.section}] <code>${iss.path}</code></strong>
                        <p style="margin-top:2px;color:var(--ink-2);">${iss.message}</p>
                      </div>
                      <span class="mono-meta" style="color:var(--vermilion-ink);">${iss.severity.toUpperCase()}</span>
                    </li>
                  `
                  )
                  .join('')}
              </ul>`
        }
      </div>

      <div class="studio-box">
        <span class="studio-label">Section-by-Section Inventory</span>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>DATA Property</th>
                <th class="is-num">Items / Dimensions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>01 Overview</td><td><code>DATA.heroMatrix</code></td><td class="is-num">${currentData.heroMatrix.total} records (${currentData.heroMatrix.region.length} regions)</td><td>Ready</td></tr>
              <tr><td>02A Stacked Bar</td><td><code>DATA.sampleFunction</code></td><td class="is-num">${currentData.sampleFunction.length} categories (${currentData.sampleFunction.reduce((a, b) => a + b.value, 0)}%)</td><td>Ready</td></tr>
              <tr><td>02B Region Table</td><td><code>DATA.sampleRegion</code></td><td class="is-num">${currentData.sampleRegion.length} regions</td><td>Ready</td></tr>
              <tr><td>03 Dumbbell</td><td><code>DATA.priorities</code></td><td class="is-num">${currentData.priorities.length} comparisons</td><td>Ready</td></tr>
              <tr><td>04 KPI Targets</td><td><code>DATA.riskLimits</code></td><td class="is-num">${Object.keys(currentData.riskLimits.regions).length} regional filters</td><td>Ready</td></tr>
              <tr><td>05 Timeline</td><td><code>DATA.regulationLine / Events</code></td><td class="is-num">${currentData.regulationLine.length} pts · ${currentData.regulationEvents.length} milestones</td><td>Ready</td></tr>
              <tr><td>06 Volume Columns</td><td><code>DATA.volume</code></td><td class="is-num">${currentData.volume.years.length} years × ${currentData.volume.series.length} series</td><td>Ready</td></tr>
              <tr><td>07 Heatmap</td><td><code>DATA.exposure</code></td><td class="is-num">${currentData.exposure.rows.length}×${currentData.exposure.cols.length} (${currentData.exposure.rows.length * currentData.exposure.cols.length} cells)</td><td>Ready</td></tr>
              <tr><td>08A Waffle</td><td><code>DATA.waffle</code></td><td class="is-num">${Object.keys(currentData.waffle).length} segment views</td><td>Ready</td></tr>
              <tr><td>08B Likert</td><td><code>DATA.likert</code></td><td class="is-num">${currentData.likert.length} survey statements</td><td>Ready</td></tr>
              <tr><td>09 Scatter OLS</td><td><code>DATA.pricing</code></td><td class="is-num">${currentData.pricing.deals.length} points (${currentData.pricing.sectors.length} sectors)</td><td>Ready</td></tr>
              <tr><td>10A Outlook Bars</td><td><code>DATA.outlookBars</code></td><td class="is-num">${currentData.outlookBars.values.join('% / ')}%</td><td>Ready</td></tr>
              <tr><td>10B Market Index</td><td><code>DATA.markets</code></td><td class="is-num">${currentData.markets.length} searchable markets</td><td>Ready</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bodyHost.appendChild(wrap);

    const rowBox = wrap.querySelector('#studioValidateTabRowBox') as HTMLElement | null;
    if (rowBox) {
      this.bindVisualRowValidationEvents(rowBox, rowValidation, parsed.headers, () => {
        this.renderValidateTab();
      });
    }

    wrap.querySelector('#studioRunAutoNormalizeBtn')!.addEventListener('click', () => {
      const fixed = validateAndNormalizeFolioData(normalized, { autoFix: true });
      this.bridge.setData(fixed.data, this.bridge.getMeta());
      this.persistDataset(fixed.data, this.bridge.getMeta());
      this.updateQuickBarSummary();
      this.setStatus('Auto-normalized all percentages to 100% and synchronized record totals.', 'ok');
      this.renderValidateTab();
    });
  }

  /* ============================================================================
   * TAB 4: OUTPUT & EXPORT (index.html & .XLSX FORMAT)
   * ============================================================================ */
  private renderExportTab(): void {
    const data = this.bridge.getData();
    const meta = this.bridge.getMeta();

    let outputCode = '';
    let filename = 'folio-data.js';
    let mime = 'text/javascript;charset=utf-8;';
    let xlsxBinary: ArrayBuffer | null = null;

    if (this.exportFormat === 'data-js') {
      outputCode = formatFolioDataAsJsBlock(data, 4);
      filename = 'folio-data-block.js';
      mime = 'text/javascript;charset=utf-8;';
    } else if (this.exportFormat === 'data-json') {
      outputCode = formatFolioDataAsJson(data);
      filename = 'folio-data.json';
      mime = 'application/json;charset=utf-8;';
    } else if (this.exportFormat === 'data-ts') {
      outputCode = formatFolioDataAsTypeScript(data, meta);
      filename = 'folio-data.ts';
      mime = 'text/typescript;charset=utf-8;';
    } else if (this.exportFormat === 'index-html') {
      outputCode = generateStandaloneIndexHtml(this.bridge.getTemplateHtml(), data, meta);
      filename = 'index.html';
      mime = 'text/html;charset=utf-8;';
    } else if (this.exportFormat === 'workbook-xlsx') {
      xlsxBinary = exportFolioToXlsxBuffer(data, this.exportXlsxScope);
      filename =
        this.exportXlsxScope === 'all-sheets'
          ? 'folio-dashboard-workbook.xlsx'
          : `folio-${this.exportXlsxScope}.xlsx`;
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (this.exportXlsxScope === 'all-sheets') {
        outputCode = XLSX_WORKBOOK_SHEETS.map(s => {
          const csv = FolioDataImporter.exportSectionToCsv(data, s.section);
          return `### WORKSHEET: ${s.sheetName} (${s.section})\n${csv}`;
        }).join('\n\n');
      } else {
        outputCode = FolioDataImporter.exportSectionToCsv(data, this.exportXlsxScope);
      }
    } else {
      outputCode = FolioDataImporter.exportSectionToCsv(data, this.exportCsvSection);
      filename = `folio-${this.exportCsvSection}.csv`;
      mime = 'text/csv;charset=utf-8;';
    }

    const lineCount = outputCode.split('\n').length;
    const byteCount = xlsxBinary ? xlsxBinary.byteLength : new Blob([outputCode]).size;

    const editableSections = SECTION_TARGETS.filter(
      s => s.id !== 'auto' && s.id !== 'full-json'
    );

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = 'var(--s-4)';

    wrap.innerHTML = `
      <div class="studio-box studio-box--strong">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-3);">
          <div>
            <span class="studio-label">Select Output Format (Compatible with <code>index.html</code> &amp; Excel <code>.xlsx</code>)</span>
            <div class="seg-group" role="group" aria-label="Export format selector" style="margin-top:6px;">
              <button type="button" class="seg-btn" data-exp-fmt="data-js" aria-pressed="${this.exportFormat === 'data-js'}">const DATA = {...} (index.html JS)</button>
              <button type="button" class="seg-btn" data-exp-fmt="index-html" aria-pressed="${this.exportFormat === 'index-html'}">Standalone index.html</button>
              <button type="button" class="seg-btn" data-exp-fmt="workbook-xlsx" aria-pressed="${this.exportFormat === 'workbook-xlsx'}">Excel Workbook (.xlsx)</button>
              <button type="button" class="seg-btn" data-exp-fmt="data-json" aria-pressed="${this.exportFormat === 'data-json'}">FolioData JSON</button>
              <button type="button" class="seg-btn" data-exp-fmt="data-ts" aria-pressed="${this.exportFormat === 'data-ts'}">TypeScript Module (.ts)</button>
              <button type="button" class="seg-btn" data-exp-fmt="section-csv" aria-pressed="${this.exportFormat === 'section-csv'}">Section CSV</button>
            </div>
          </div>

          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--s-2);">
            <button type="button" class="fig-table-btn" id="studioCopyOutputBtn">Copy Text Preview</button>
            <button type="button" class="studio-cta-btn" id="studioDownloadOutputBtn">Download ${filename} ↓</button>
          </div>
        </div>

        ${
          this.exportFormat === 'workbook-xlsx'
            ? `<div style="margin-top:var(--s-2);">
                <label class="studio-label" for="studioExportXlsxScopeSelect">Choose Excel (.XLSX) Workbook Scope</label>
                <select class="studio-select" id="studioExportXlsxScopeSelect" style="max-width:480px;margin-top:4px;">
                  <option value="all-sheets" ${
                    this.exportXlsxScope === 'all-sheets' ? 'selected' : ''
                  }>[ALL 15 TABS] Complete Multi-Sheet Folio Workbook (All 10 Charts + Master Dataset)</option>
                  ${editableSections
                    .map(
                      s =>
                        `<option value="${s.id}" ${
                          s.id === this.exportXlsxScope ? 'selected' : ''
                        }>[${s.badge}] Single Worksheet: ${s.label}</option>`
                    )
                    .join('')}
                </select>
              </div>`
            : ''
        }

        ${
          this.exportFormat === 'section-csv'
            ? `<div style="margin-top:var(--s-2);">
                <label class="studio-label" for="studioExportCsvSectionSelect">Choose Section for CSV Output</label>
                <select class="studio-select" id="studioExportCsvSectionSelect" style="max-width:420px;margin-top:4px;">
                  ${editableSections
                    .map(
                      s =>
                        `<option value="${s.id}" ${
                          s.id === this.exportCsvSection ? 'selected' : ''
                        }>[${s.badge}] ${s.label}</option>`
                    )
                    .join('')}
                </select>
              </div>`
            : ''
        }

        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:var(--s-2);">
          <span class="mono-meta num">File: ${filename} · ${lineCount.toLocaleString()} lines · ${(byteCount / 1024).toFixed(1)} KB</span>
          <span class="mono-meta">${
            this.exportFormat === 'workbook-xlsx'
              ? 'Round-trip compatible with Folio .XLSX Importer'
              : 'Ready to paste into <code>index.html</code> or deploy standalone'
          }</span>
        </div>

        <textarea class="studio-code-output" id="studioExportCodeArea" readonly aria-label="Generated output code in index.html format"></textarea>
      </div>
    `;

    this.bodyHost.appendChild(wrap);
    const codeArea = wrap.querySelector('#studioExportCodeArea') as HTMLTextAreaElement;
    codeArea.value = outputCode;

    wrap.querySelectorAll('[data-exp-fmt]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.exportFormat = btn.getAttribute('data-exp-fmt') as ExportFormatType;
        this.renderExportTab();
      });
    });

    const xlsxScopeSelect = wrap.querySelector(
      '#studioExportXlsxScopeSelect'
    ) as HTMLSelectElement | null;
    if (xlsxScopeSelect) {
      xlsxScopeSelect.addEventListener('change', () => {
        this.exportXlsxScope = xlsxScopeSelect.value as ImportTargetSection | 'all-sheets';
        this.renderExportTab();
      });
    }

    const csvSecSelect = wrap.querySelector('#studioExportCsvSectionSelect') as HTMLSelectElement | null;
    if (csvSecSelect) {
      csvSecSelect.addEventListener('change', () => {
        this.exportCsvSection = csvSecSelect.value as ImportTargetSection;
        this.renderExportTab();
      });
    }

    wrap.querySelector('#studioCopyOutputBtn')!.addEventListener('click', () => {
      navigator.clipboard.writeText(outputCode).then(() => {
        this.setStatus(`Copied ${filename} preview (${lineCount.toLocaleString()} lines) to clipboard!`, 'ok');
      });
    });

    wrap.querySelector('#studioDownloadOutputBtn')!.addEventListener('click', () => {
      if (this.exportFormat === 'workbook-xlsx' && xlsxBinary) {
        this.downloadBinaryBlob(xlsxBinary, filename, mime);
      } else {
        this.downloadBlob(outputCode, filename, mime);
      }
      this.setStatus(`Downloaded ${filename} (${(byteCount / 1024).toFixed(1)} KB).`, 'ok');
    });
  }

  private downloadStandaloneHtml(): void {
    const html = generateStandaloneIndexHtml(
      this.bridge.getTemplateHtml(),
      this.bridge.getData(),
      this.bridge.getMeta()
    );
    this.downloadBlob(html, 'folio-custom-dashboard.html', 'text/html;charset=utf-8;');
    this.setStatus('Downloaded standalone index.html with your custom DATA embedded!', 'ok');
  }

  private downloadBlob(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private downloadBinaryBlob(buffer: ArrayBuffer, filename: string, mimeType: string): void {
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private bindGlobalShortcut(): void {
    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.toLowerCase() === 'i' && !this.dialogEl.open) {
        e.preventDefault();
        this.openDialog('import');
      }
    });
  }
}
