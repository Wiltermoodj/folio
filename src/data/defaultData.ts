import type { DatasetPreset, FolioData, FolioReportMeta } from '../types/folio';
import {
  cloneColumnLabels,
  DEFAULT_COLUMN_DISPLAY_LABELS,
  synthesizeThematicReportMeta,
} from '../importer/reportSynthesizer';

const BASE_DEFAULT_META: FolioReportMeta = {
  brand: 'folio',
  title: 'Data Visualization',
  year: 'Template',
  mastheadNote: 'Remixable Dashboard Showcase · 10 Interactive Charts · 7 Themes · Sample Dataset (412 records)',
  heroHeadline: [
    'Interactive data',
    'visualizations built',
    'to remix & share.'
  ],
  heroLede:
    'Folio is an interactive data visualization and editorial dashboard template built with responsive SVG charts, live filters, scrollytelling columns, and accessible data tables. Explore this 412-record sample benchmark across 16 markets, switch among 7 high-contrast themes in the control panel, or swap in your own dataset to publish a custom report.',
  sourceLabel: 'Source: Folio sample dataset, n = 412',
  kpiVolumeTrillions: 1.84,
  kpiAdoptionRate: 14.1,
  kpiAdoptionDelta: 4.5,
  contextPrompt:
    'Global enterprise workflow automation, real-time data pipeline readiness, and cross-border telemetry adoption across 16 national markets (2021–2026).',
  columnLabels: cloneColumnLabels(DEFAULT_COLUMN_DISPLAY_LABELS),
};

export const DEFAULT_FOLIO_DATA: FolioData = {
  sections: [
    { id: 's01', num: '01', short: 'Overview', folioL: '002', folioR: '003' },
    { id: 's02', num: '02', short: 'Breakdown', folioL: '010', folioR: '011' },
    { id: 's03', num: '03', short: 'Rankings', folioL: '018', folioR: '019' },
    { id: 's04', num: '04', short: 'KPI Targets', folioL: '026', folioR: '027' },
    { id: 's05', num: '05', short: 'Timeline', folioL: '034', folioR: '035' },
    { id: 's06', num: '06', short: 'Volume', folioL: '042', folioR: '043' },
    { id: 's07', num: '07', short: 'Heatmap', folioL: '050', folioR: '051' },
    { id: 's08', num: '08', short: 'Sentiment', folioL: '058', folioR: '059' },
    { id: 's09', num: '09', short: 'Correlation', folioL: '066', folioR: '067' },
    { id: 's10', num: '10', short: 'Data Table', folioL: '074', folioR: '075' }
  ],
  palette: ['var(--violet)', 'var(--vermilion)', 'var(--magenta)', 'var(--ink)', 'var(--neutral-data)'],

  heroMatrix: {
    total: 412,
    region: [
      { name: 'Europe', count: 148 },
      { name: 'Asia-Pacific', count: 121 },
      { name: 'Americas', count: 87 },
      { name: 'Middle East & Africa', count: 56 }
    ],
    assetSize: [
      { name: 'Tier 1 (>$500M)', count: 62 },
      { name: 'Tier 2 ($100–500M)', count: 139 },
      { name: 'Tier 3 ($20–100M)', count: 128 },
      { name: 'Tier 4 (<$20M)', count: 83 }
    ],
    role: [
      { name: 'Global platform', count: 74 },
      { name: 'Regional provider', count: 196 },
      { name: 'Public sector', count: 41 },
      { name: 'Digital-first', count: 101 }
    ]
  },

  sampleFunction: [
    { name: 'Leadership', value: 34, color: 'var(--violet)', text: 'var(--on-violet)' },
    { name: 'Operations', value: 27, color: 'var(--vermilion)', text: 'var(--on-vermilion)' },
    { name: 'Strategy', value: 21, color: 'var(--magenta)', text: 'var(--on-magenta)' },
    { name: 'Analytics', value: 12, color: 'var(--ink)', text: 'var(--paper)' },
    { name: 'Other', value: 6, color: 'var(--neutral-data)', text: 'var(--ink)' }
  ],

  sampleRegion: [
    { region: 'Europe', n: 148, share: 35.9, medianBook: 42.0 },
    { region: 'Asia-Pacific', n: 121, share: 29.4, medianBook: 37.5 },
    { region: 'Americas', n: 87, share: 21.1, medianBook: 28.4 },
    { region: 'Middle East & Africa', n: 56, share: 13.6, medianBook: 12.9 }
  ],

  priorities: [
    { item: 'Workflow automation', y2024: 31, y2026: 62 },
    { item: 'Real-time data pipelines', y2024: 44, y2026: 57 },
    { item: 'Vendor risk monitoring', y2024: 22, y2026: 54 },
    { item: 'Supply-chain traceability', y2024: 18, y2026: 41 },
    { item: 'Automated compliance audit', y2024: 29, y2026: 38 },
    { item: 'Legacy report exports', y2024: 47, y2026: 36 },
    { item: 'Scenario stress testing', y2024: 26, y2026: 33 },
    { item: 'Predictive forecasting', y2024: 6, y2026: 19 }
  ],

  riskLimits: {
    maxAll: 66,
    labels: ['Increasing', 'Unchanged', 'Decreasing'],
    colors: ['var(--violet)', 'var(--vermilion)', 'var(--magenta)'],
    regions: {
      Global: { n: 412, values: [18, 58, 24] },
      Europe: { n: 148, values: [12, 49, 39] },
      'Asia-Pacific': { n: 121, values: [21, 63, 16] },
      Americas: { n: 87, values: [24, 60, 16] },
      'Middle East & Africa': { n: 56, values: [19, 66, 15] }
    }
  },

  regulationLine: [
    { year: 2021, value: 23 },
    { year: 2022, value: 29 },
    { year: 2023, value: 38 },
    { year: 2024, value: 46 },
    { year: 2025, value: 51 },
    { year: 2026, value: 55 }
  ],

  regulationEvents: [
    {
      id: 'baseline-2021',
      pos: 2021 + 10 / 12,
      date: 'Nov 2021',
      short: 'Baseline spec',
      title: 'Open reporting baseline specification published',
      summary: 'Sample milestone card: illustrates how a foundational schema launch anchors year-one adoption across the trajectory chart.',
      why: 'Shows how an early milestone establishes baseline metrics across cross-border reporting workflows.'
    },
    {
      id: 'mandate-2023',
      pos: 2023 + 0 / 12,
      date: 'Jan 2023',
      short: 'Audit mandate',
      title: 'Automated disclosure framework enters rollout phase',
      summary: 'Sample milestone card: demonstrates rich contextual annotations synced to an interactive SVG timeline node.',
      why: 'Illustrates how period-specific events explain inflection points visible on the trend line above.'
    },
    {
      id: 'schema-2023',
      pos: 2023 + 5 / 12,
      date: 'Jun 2023',
      short: 'Unified schema',
      title: 'Global telemetry and reporting standards released',
      summary: 'Sample milestone card: pairs co-occurring mid-year milestones on staggered vertical tiers so adjacent labels remain collision-free.',
      why: 'Demonstrates automatic multi-tier placement when multiple events share the same horizontal timestamp.'
    },
    {
      id: 'trace-2023',
      pos: 2023 + 5 / 12,
      date: 'Jun 2023',
      short: 'Traceability rule',
      title: 'Origin verification rule takes effect',
      summary: 'Sample milestone card: tracks secondary verification requirements tied to geographic source data.',
      why: 'Customize each event title, summary and takeaway directly in the DATA.regulationEvents array.'
    },
    {
      id: 'gov-2024',
      pos: 2024 + 2 / 12,
      date: 'Mar 2024',
      short: 'Governance rule',
      title: 'Standardized analytics governance update adopted',
      summary: 'Sample milestone card: captures a mid-series inflection point as standardized pipelines expand across regional teams.',
      why: 'Pairs qualitative commentary seamlessly with quantitative year-over-year percentage gains.'
    },
    {
      id: 'diligence-2024',
      pos: 2024 + 6 / 12,
      date: 'Jul 2024',
      short: 'Supply audit',
      title: 'Multi-tier data verification policy takes effect',
      summary: 'Sample milestone card: illustrates downstream accountability across multi-tier supplier networks.',
      why: 'Shows how keyboard arrow keys step smoothly across every historical event marker.'
    },
    {
      id: 'filings-2025',
      pos: 2025 + 2 / 12,
      date: '2025',
      short: 'First filings',
      title: 'First wave of standardized annual datasets published',
      summary: 'Sample milestone card: marks broad ecosystem availability of structured benchmark datasets for comparative analysis.',
      why: 'Demonstrates right-aligned end labeling so late-period milestones never clip past the SVG viewport.'
    }
  ],

  volume: {
    series: [
      { key: 'loans', label: 'Core platforms', color: 'var(--violet)' },
      { key: 'green', label: 'Cloud infrastructure', color: 'var(--vermilion)' },
      { key: 'scf', label: 'Analytics tools', color: 'var(--magenta)' },
      { key: 'trans', label: 'AI workflows', color: 'var(--ink)' }
    ],
    years: [
      { year: '2019', loans: 112, green: 64, scf: 38, trans: 0, total: 214, est: false },
      { year: '2020', loans: 138, green: 71, scf: 52, trans: 0, total: 261, est: false },
      { year: '2021', loans: 241, green: 96, scf: 88, trans: 0, total: 425, est: false },
      { year: '2022', loans: 318, green: 122, scf: 141, trans: 0, total: 581, est: false },
      { year: '2023', loans: 402, green: 158, scf: 214, trans: 36, total: 810, est: false },
      { year: '2024', loans: 488, green: 197, scf: 296, trans: 92, total: 1073, est: false },
      { year: '2025', loans: 571, green: 236, scf: 372, trans: 168, total: 1347, est: false },
      { year: '2026e', loans: 702, green: 298, scf: 541, trans: 299, total: 1840, est: true }
    ]
  },

  exposure: {
    cols: ['Europe', 'Asia-Pacific', 'Americas', 'Middle East & Africa', 'Global'],
    rows: [
      { sector: 'Legacy infrastructure', vals: [88, 61, 72, 44, 71] },
      { sector: 'Manual audit workflows', vals: [58, 39, 41, 27, 45] },
      { sector: 'Unverified vendor feeds', vals: [71, 46, 38, 22, 50] },
      { sector: 'On-premise data silos', vals: [54, 28, 31, 12, 36] },
      { sector: 'Batch CSV pipelines', vals: [49, 21, 33, 14, 33] },
      { sector: 'Paper reporting trails', vals: [37, 24, 19, 11, 26] },
      { sector: 'Unmonitored endpoints', vals: [31, 18, 15, 9, 21] },
      { sector: 'Static PDF exports', vals: [23, 9, 14, 6, 15] },
      { sector: 'Ad-hoc spreadsheets', vals: [19, 7, 11, 5, 12] },
      { sector: 'Custom ETL scripts', vals: [14, 6, 9, 4, 9] }
    ]
  },

  waffle: {
    All: { verified: 23, estimated: 41, none: 36 },
    Small: { verified: 8, estimated: 38, none: 54 },
    'Mid-market': { verified: 21, estimated: 45, none: 34 },
    Enterprise: { verified: 52, estimated: 37, none: 11 }
  },

  likert: [
    { id: 1, text: 'Interactive visuals make complex datasets easier to understand', vals: [4, 9, 17, 41, 29] },
    { id: 2, text: 'Static spreadsheets alone are sufficient for executive reporting', vals: [21, 38, 22, 15, 4] },
    { id: 3, text: 'Teams are converging around shared data schemas fast enough', vals: [9, 27, 31, 26, 7] },
    { id: 4, text: 'Unverified data quality blocks automated workflow decisions', vals: [6, 14, 25, 36, 19] },
    { id: 5, text: 'Public dashboards should always include accessible table views', vals: [3, 8, 19, 38, 32] }
  ],

  pricing: {
    sectors: [
      { name: 'Retail', color: 'var(--violet)', shape: 'circle' },
      { name: 'Logistics', color: 'var(--vermilion)', shape: 'square' },
      { name: 'Energy', color: 'var(--magenta)', shape: 'triangle' },
      { name: 'SaaS', color: 'var(--ink)', shape: 'diamond' },
      { name: 'Media', color: 'var(--ink-3)', shape: 'hollow' }
    ],
    deals: [
      { id: 1, sector: 'Retail', score: 22, bps: 188 },
      { id: 2, sector: 'Retail', score: 35, bps: 171 },
      { id: 3, sector: 'Retail', score: 48, bps: 160 },
      { id: 4, sector: 'Retail', score: 61, bps: 141 },
      { id: 5, sector: 'Retail', score: 74, bps: 128 },
      { id: 6, sector: 'Retail', score: 83, bps: 116 },
      { id: 7, sector: 'Logistics', score: 18, bps: 205 },
      { id: 8, sector: 'Logistics', score: 29, bps: 192 },
      { id: 9, sector: 'Logistics', score: 44, bps: 167 },
      { id: 10, sector: 'Logistics', score: 57, bps: 158 },
      { id: 11, sector: 'Logistics', score: 66, bps: 139 },
      { id: 12, sector: 'Logistics', score: 79, bps: 131 },
      { id: 13, sector: 'Energy', score: 12, bps: 214 },
      { id: 14, sector: 'Energy', score: 25, bps: 199 },
      { id: 15, sector: 'Energy', score: 39, bps: 181 },
      { id: 16, sector: 'Energy', score: 52, bps: 170 },
      { id: 17, sector: 'Energy', score: 68, bps: 149 },
      { id: 18, sector: 'Energy', score: 88, bps: 122 },
      { id: 19, sector: 'SaaS', score: 31, bps: 176 },
      { id: 20, sector: 'SaaS', score: 42, bps: 158 },
      { id: 21, sector: 'SaaS', score: 55, bps: 146 },
      { id: 22, sector: 'SaaS', score: 63, bps: 137 },
      { id: 23, sector: 'SaaS', score: 77, bps: 119 },
      { id: 24, sector: 'SaaS', score: 91, bps: 104 },
      { id: 25, sector: 'Media', score: 27, bps: 169 },
      { id: 26, sector: 'Media', score: 38, bps: 162 },
      { id: 27, sector: 'Media', score: 50, bps: 151 },
      { id: 28, sector: 'Media', score: 64, bps: 133 },
      { id: 29, sector: 'Media', score: 72, bps: 121 },
      { id: 30, sector: 'Media', score: 86, bps: 109 }
    ]
  },

  outlookBars: {
    maxAll: 50,
    labels: ['Expand', 'Hold', 'Reduce'],
    colors: ['var(--vermilion)', 'var(--violet)', 'var(--magenta)'],
    values: [41, 47, 12]
  },

  markets: [
    { market: 'United Kingdom', region: 'Europe', n: 31, policy: 84, share: 21.4, bps: 14, delta: 5.1, trend: [6.2, 8.9, 11.8, 14.6, 16.3, 21.4] },
    { market: 'Germany', region: 'Europe', n: 27, policy: 81, share: 19.8, bps: 12, delta: 4.6, trend: [5.1, 7.4, 10.2, 12.9, 15.2, 19.8] },
    { market: 'France', region: 'Europe', n: 22, policy: 86, share: 22.7, bps: 16, delta: 4.9, trend: [6.8, 9.6, 12.7, 15.5, 17.8, 22.7] },
    { market: 'Netherlands', region: 'Europe', n: 14, policy: 89, share: 24.9, bps: 18, delta: 5.3, trend: [7.9, 10.8, 14.1, 17.2, 19.6, 24.9] },
    { market: 'Switzerland', region: 'Europe', n: 11, policy: 77, share: 17.1, bps: 11, delta: 3.8, trend: [4.4, 6.3, 8.8, 11.5, 13.3, 17.1] },
    { market: 'Singapore', region: 'Asia-Pacific', n: 19, policy: 79, share: 18.6, bps: 13, delta: 5.7, trend: [3.9, 6.1, 8.7, 10.4, 12.9, 18.6] },
    { market: 'Hong Kong SAR', region: 'Asia-Pacific', n: 17, policy: 64, share: 13.2, bps: 9, delta: 3.4, trend: [2.8, 4.2, 6.0, 8.1, 9.8, 13.2] },
    { market: 'Japan', region: 'Asia-Pacific', n: 21, policy: 71, share: 12.5, bps: 8, delta: 3.1, trend: [3.0, 4.4, 6.2, 7.9, 9.4, 12.5] },
    { market: 'Mainland China', region: 'Asia-Pacific', n: 24, policy: 58, share: 11.9, bps: 7, delta: 4.2, trend: [1.9, 3.1, 4.8, 6.0, 7.7, 11.9] },
    { market: 'India', region: 'Asia-Pacific', n: 16, policy: 46, share: 7.8, bps: 5, delta: 2.6, trend: [1.1, 1.9, 3.0, 4.1, 5.2, 7.8] },
    { market: 'United States', region: 'Americas', n: 34, policy: 62, share: 10.4, bps: 6, delta: 1.9, trend: [3.4, 4.9, 6.6, 7.8, 8.5, 10.4] },
    { market: 'Canada', region: 'Americas', n: 12, policy: 74, share: 13.7, bps: 9, delta: 3.2, trend: [3.7, 5.2, 7.1, 8.9, 10.5, 13.7] },
    { market: 'Brazil', region: 'Americas', n: 15, policy: 53, share: 9.6, bps: 7, delta: 3.0, trend: [2.0, 3.2, 4.6, 5.5, 6.6, 9.6] },
    { market: 'United Arab Emirates', region: 'Middle East & Africa', n: 13, policy: 57, share: 8.9, bps: 6, delta: 3.3, trend: [1.2, 2.0, 3.1, 4.2, 5.6, 8.9] },
    { market: 'Saudi Arabia', region: 'Middle East & Africa', n: 10, policy: 41, share: 5.2, bps: 4, delta: 1.8, trend: [0.6, 1.1, 1.9, 2.6, 3.4, 5.2] },
    { market: 'South Africa', region: 'Middle East & Africa', n: 9, policy: 66, share: 11.3, bps: 8, delta: 2.9, trend: [3.1, 4.4, 5.9, 7.2, 8.4, 11.3] }
  ]
};

export const DEFAULT_REPORT_META: FolioReportMeta = {
  ...synthesizeThematicReportMeta(DEFAULT_FOLIO_DATA, BASE_DEFAULT_META, {
    contextPrompt: BASE_DEFAULT_META.contextPrompt,
    columnLabels: BASE_DEFAULT_META.columnLabels,
    preserveHeroIfDefault: true,
  }),
};

export function cloneFolioData(d: FolioData = DEFAULT_FOLIO_DATA): FolioData {
  return JSON.parse(JSON.stringify(d)) as FolioData;
}

export function cloneReportMeta(m: FolioReportMeta = DEFAULT_REPORT_META): FolioReportMeta {
  return JSON.parse(JSON.stringify(m)) as FolioReportMeta;
}

const CLOUD_AI_DATA: FolioData = {
  ...cloneFolioData(DEFAULT_FOLIO_DATA),
  heroMatrix: {
    total: 540,
    region: [
      { name: 'Europe', count: 182 },
      { name: 'Asia-Pacific', count: 158 },
      { name: 'Americas', count: 134 },
      { name: 'Middle East & Africa', count: 66 }
    ],
    assetSize: [
      { name: 'Hyperscale (>10k GPUs)', count: 94 },
      { name: 'Enterprise (1k–10k GPUs)', count: 176 },
      { name: 'Mid-Cluster (100–1k GPUs)', count: 162 },
      { name: 'Edge / Local (<100 GPUs)', count: 108 }
    ],
    role: [
      { name: 'Real-time inference', count: 218 },
      { name: 'Fine-tuning pipelines', count: 144 },
      { name: 'Retrieval & vector DB', count: 112 },
      { name: 'Foundation pre-training', count: 66 }
    ]
  },
  sampleFunction: [
    { name: 'Inference API', value: 38, color: 'var(--violet)', text: 'var(--on-violet)' },
    { name: 'Vector Retrieval', value: 24, color: 'var(--vermilion)', text: 'var(--on-vermilion)' },
    { name: 'Fine-Tuning', value: 19, color: 'var(--magenta)', text: 'var(--on-magenta)' },
    { name: 'Evaluation & Guardrails', value: 13, color: 'var(--ink)', text: 'var(--paper)' },
    { name: 'Batch Archival', value: 6, color: 'var(--neutral-data)', text: 'var(--ink)' }
  ],
  sampleRegion: [
    { region: 'Europe', n: 182, share: 33.7, medianBook: 58.4 },
    { region: 'Asia-Pacific', n: 158, share: 29.3, medianBook: 51.2 },
    { region: 'Americas', n: 134, share: 24.8, medianBook: 64.0 },
    { region: 'Middle East & Africa', n: 66, share: 12.2, medianBook: 24.5 }
  ],
  priorities: [
    { item: 'FP8 / INT4 model quantization', y2024: 24, y2026: 68 },
    { item: 'Multi-region failover routing', y2024: 39, y2026: 61 },
    { item: 'Semantic prompt caching', y2024: 18, y2026: 56 },
    { item: 'Sovereign data residency', y2024: 31, y2026: 53 },
    { item: 'Automated eval regression', y2024: 22, y2026: 47 },
    { item: 'Single-vendor dedicated reserv.', y2024: 54, y2026: 35 },
    { item: 'Carbon-aware job scheduling', y2024: 19, y2026: 38 },
    { item: 'Zero-trust enclave execution', y2024: 11, y2026: 29 }
  ],
  riskLimits: {
    maxAll: 68,
    labels: ['Increasing', 'Unchanged', 'Decreasing'],
    colors: ['var(--violet)', 'var(--vermilion)', 'var(--magenta)'],
    regions: {
      Global: { n: 540, values: [42, 44, 14] },
      Europe: { n: 182, values: [38, 47, 15] },
      'Asia-Pacific': { n: 158, values: [46, 42, 12] },
      Americas: { n: 134, values: [49, 39, 12] },
      'Middle East & Africa': { n: 66, values: [34, 48, 18] }
    }
  },
  regulationLine: [
    { year: 2021, value: 14 },
    { year: 2022, value: 22 },
    { year: 2023, value: 35 },
    { year: 2024, value: 49 },
    { year: 2025, value: 61 },
    { year: 2026, value: 72 }
  ],
  volume: {
    series: [
      { key: 'loans', label: 'Inference clusters', color: 'var(--violet)' },
      { key: 'green', label: 'Storage & vector mesh', color: 'var(--vermilion)' },
      { key: 'scf', label: 'Observability & eval', color: 'var(--magenta)' },
      { key: 'trans', label: 'Agentic orchestration', color: 'var(--ink)' }
    ],
    years: [
      { year: '2019', loans: 140, green: 85, scf: 42, trans: 0, total: 267, est: false },
      { year: '2020', loans: 190, green: 110, scf: 65, trans: 0, total: 365, est: false },
      { year: '2021', loans: 295, green: 145, scf: 98, trans: 0, total: 538, est: false },
      { year: '2022', loans: 410, green: 198, scf: 154, trans: 18, total: 780, est: false },
      { year: '2023', loans: 560, green: 260, scf: 230, trans: 74, total: 1124, est: false },
      { year: '2024', loans: 720, green: 340, scf: 310, trans: 165, total: 1535, est: false },
      { year: '2025', loans: 880, green: 420, scf: 395, trans: 290, total: 1985, est: false },
      { year: '2026e', loans: 1050, green: 510, scf: 490, trans: 410, total: 2460, est: true }
    ]
  },
  waffle: {
    All: { verified: 46, estimated: 38, none: 16 },
    Small: { verified: 22, estimated: 44, none: 34 },
    'Mid-market': { verified: 44, estimated: 40, none: 16 },
    Enterprise: { verified: 68, estimated: 25, none: 7 }
  },
  outlookBars: {
    maxAll: 60,
    labels: ['Expand', 'Hold', 'Reduce'],
    colors: ['var(--vermilion)', 'var(--violet)', 'var(--magenta)'],
    values: [54, 36, 10]
  },
  markets: [
    { market: 'United States', region: 'Americas', n: 88, policy: 91, share: 34.2, bps: 28, delta: 9.8, trend: [9.4, 13.8, 18.5, 23.1, 27.9, 34.2] },
    { market: 'United Kingdom', region: 'Europe', n: 46, policy: 88, share: 29.6, bps: 24, delta: 8.4, trend: [8.1, 11.4, 15.9, 19.8, 23.5, 29.6] },
    { market: 'Germany', region: 'Europe', n: 42, policy: 85, share: 27.1, bps: 21, delta: 7.6, trend: [7.2, 10.1, 14.0, 17.6, 21.4, 27.1] },
    { market: 'Singapore', region: 'Asia-Pacific', n: 39, policy: 92, share: 31.8, bps: 26, delta: 9.1, trend: [8.5, 12.2, 16.8, 21.0, 25.4, 31.8] },
    { market: 'Japan', region: 'Asia-Pacific', n: 36, policy: 83, share: 25.4, bps: 19, delta: 6.8, trend: [6.4, 9.2, 12.8, 16.5, 20.1, 25.4] },
    { market: 'France', region: 'Europe', n: 34, policy: 87, share: 28.3, bps: 23, delta: 8.1, trend: [7.5, 10.9, 14.8, 18.9, 22.7, 28.3] },
    { market: 'Canada', region: 'Americas', n: 26, policy: 84, share: 26.0, bps: 20, delta: 7.2, trend: [7.0, 9.8, 13.4, 17.2, 20.8, 26.0] },
    { market: 'Netherlands', region: 'Europe', n: 24, policy: 90, share: 30.4, bps: 25, delta: 8.7, trend: [8.2, 11.8, 16.1, 20.4, 24.8, 30.4] },
    { market: 'South Korea', region: 'Asia-Pacific', n: 28, policy: 86, share: 27.9, bps: 22, delta: 7.9, trend: [7.1, 10.5, 14.6, 18.4, 22.1, 27.9] },
    { market: 'Australia', region: 'Asia-Pacific', n: 22, policy: 81, share: 23.8, bps: 18, delta: 6.4, trend: [5.9, 8.7, 12.1, 15.6, 19.0, 23.8] },
    { market: 'Switzerland', region: 'Europe', n: 20, policy: 89, share: 28.9, bps: 23, delta: 7.8, trend: [7.8, 11.2, 15.2, 19.1, 23.0, 28.9] },
    { market: 'India', region: 'Asia-Pacific', n: 33, policy: 76, share: 22.1, bps: 17, delta: 8.5, trend: [4.2, 6.8, 10.4, 13.9, 17.6, 22.1] },
    { market: 'Brazil', region: 'Americas', n: 20, policy: 72, share: 19.4, bps: 15, delta: 5.9, trend: [4.5, 6.9, 9.8, 12.7, 15.8, 19.4] },
    { market: 'United Arab Emirates', region: 'Middle East & Africa', n: 26, policy: 82, share: 24.6, bps: 20, delta: 7.4, trend: [5.4, 8.3, 12.0, 15.8, 19.5, 24.6] },
    { market: 'Saudi Arabia', region: 'Middle East & Africa', n: 22, policy: 75, share: 18.7, bps: 14, delta: 5.6, trend: [3.8, 6.1, 9.0, 12.1, 15.0, 18.7] },
    { market: 'South Africa', region: 'Middle East & Africa', n: 18, policy: 69, share: 15.8, bps: 12, delta: 4.5, trend: [3.6, 5.4, 7.9, 10.4, 12.9, 15.8] }
  ]
};

const CLOUD_AI_COLUMN_LABELS = {
  market: 'Cloud Hub / Jurisdiction (market)',
  region: 'Availability Zone Region (region)',
  value: 'Quantized GPU Utilization % (value)',
  year: 'Telemetry Year (year)',
  policy: 'Sovereign Residency Score % (policy)',
  bps: 'Latency Compression (ms/bps)',
  delta: 'Utilization Gain YoY (pp)',
  count: 'Production Clusters (count)',
  tier: 'Cluster Scale Tier (tier)',
  segment: 'AI Workload Architecture (segment)',
};

const CLOUD_AI_CONTEXT_PROMPT =
  'Enterprise AI GPU cluster telemetry, quantized inference utilization, sovereign residency compliance, and latency compression across 540 production workloads.';

export const DATASET_PRESETS: DatasetPreset[] = [
  {
    id: 'folio-default',
    name: 'Folio Default Benchmark (412 Records)',
    tagline: 'Original 412-record global technology & workflow adoption benchmark across 16 markets.',
    meta: cloneReportMeta(DEFAULT_REPORT_META),
    data: cloneFolioData(DEFAULT_FOLIO_DATA),
    sampleMasterCsv: `Market,Region,Records,Tier,Segment,Policy (%),Adoption 2026 (%),Efficiency gain (bps),Delta YoY (pp),2021,2022,2023,2024,2025,2026
United Kingdom,Europe,31,Tier 1 (>$500M),Global platform,84,21.4,14,5.1,6.2,8.9,11.8,14.6,16.3,21.4
Germany,Europe,27,Tier 2 ($100–500M),Regional provider,81,19.8,12,4.6,5.1,7.4,10.2,12.9,15.2,19.8
France,Europe,22,Tier 2 ($100–500M),Regional provider,86,22.7,16,4.9,6.8,9.6,12.7,15.5,17.8,22.7
Netherlands,Europe,14,Tier 1 (>$500M),Digital-first,89,24.9,18,5.3,7.9,10.8,14.1,17.2,19.6,24.9
Switzerland,Europe,11,Tier 3 ($20–100M),Public sector,77,17.1,11,3.8,4.4,6.3,8.8,11.5,13.3,17.1
Singapore,Asia-Pacific,19,Tier 1 (>$500M),Digital-first,79,18.6,13,5.7,3.9,6.1,8.7,10.4,12.9,18.6
Hong Kong SAR,Asia-Pacific,17,Tier 2 ($100–500M),Global platform,64,13.2,9,3.4,2.8,4.2,6.0,8.1,9.8,13.2
Japan,Asia-Pacific,21,Tier 2 ($100–500M),Regional provider,71,12.5,8,3.1,3.0,4.4,6.2,7.9,9.4,12.5
Mainland China,Asia-Pacific,24,Tier 3 ($20–100M),Regional provider,58,11.9,7,4.2,1.9,3.1,4.8,6.0,7.7,11.9
India,Asia-Pacific,16,Tier 3 ($20–100M),Digital-first,46,7.8,5,2.6,1.1,1.9,3.0,4.1,5.2,7.8
United States,Americas,34,Tier 1 (>$500M),Global platform,62,10.4,6,1.9,3.4,4.9,6.6,7.8,8.5,10.4
Canada,Americas,12,Tier 2 ($100–500M),Regional provider,74,13.7,9,3.2,3.7,5.2,7.1,8.9,10.5,13.7
Brazil,Americas,15,Tier 4 (<$20M),Digital-first,53,9.6,7,3.0,2.0,3.2,4.6,5.5,6.6,9.6
United Arab Emirates,Middle East & Africa,13,Tier 3 ($20–100M),Public sector,57,8.9,6,3.3,1.2,2.0,3.1,4.2,5.6,8.9
Saudi Arabia,Middle East & Africa,10,Tier 4 (<$20M),Public sector,41,5.2,4,1.8,0.6,1.1,1.9,2.6,3.4,5.2
South Africa,Middle East & Africa,9,Tier 4 (<$20M),Regional provider,66,11.3,8,2.9,3.1,4.4,5.9,7.2,8.4,11.3`
  },
  {
    id: 'cloud-ai-telemetry',
    name: 'AI & Cloud Infrastructure Telemetry (540 Workloads)',
    tagline: 'Enterprise GPU cluster utilization, inference latency reduction, and sovereign cloud adoption.',
    meta: synthesizeThematicReportMeta(
      CLOUD_AI_DATA,
      {
        brand: 'folio',
        title: 'Cloud & AI Telemetry',
        year: '2026',
        mastheadNote: 'Enterprise AI Compute Benchmark · 10 Interactive Charts · 540 Production Workloads',
        heroHeadline: [
          'Sovereign AI compute',
          'utilization & cost',
          'telemetry report.'
        ],
        heroLede:
          'Tracking 540 production inference and training clusters across 16 regional cloud hubs. Evaluates quantized model routing, batch scheduling efficiency, and unit cost compression from 2021 through 2026.',
        sourceLabel: 'Source: Cloud & AI Telemetry Benchmark, n = 540',
        kpiVolumeTrillions: 2.46,
        kpiAdoptionRate: 28.4,
        kpiAdoptionDelta: 9.2,
        contextPrompt: CLOUD_AI_CONTEXT_PROMPT,
        columnLabels: CLOUD_AI_COLUMN_LABELS,
      },
      {
        contextPrompt: CLOUD_AI_CONTEXT_PROMPT,
        columnLabels: CLOUD_AI_COLUMN_LABELS,
      }
    ),
    data: CLOUD_AI_DATA,
    sampleMasterCsv: `Cloud Hub,Availability Zone Region,Production Clusters,Cluster Scale Tier,AI Workload Architecture,Sovereign Residency Score (%),Quantized GPU Utilization (%),Latency Compression (bps),Utilization Gain YoY (pp),2021,2022,2023,2024,2025,2026
United States,Americas,88,Hyperscale (>10k GPUs),Real-time inference,91,34.2,28,9.8,9.4,13.8,18.5,23.1,27.9,34.2
United Kingdom,Europe,46,Enterprise (1k–10k GPUs),Real-time inference,88,29.6,24,8.4,8.1,11.4,15.9,19.8,23.5,29.6
Germany,Europe,42,Enterprise (1k–10k GPUs),Fine-tuning pipelines,85,27.1,21,7.6,7.2,10.1,14.0,17.6,21.4,27.1
Singapore,Asia-Pacific,39,Hyperscale (>10k GPUs),Real-time inference,92,31.8,26,9.1,8.5,12.2,16.8,21.0,25.4,31.8
Japan,Asia-Pacific,36,Enterprise (1k–10k GPUs),Retrieval & vector DB,83,25.4,19,6.8,6.4,9.2,12.8,16.5,20.1,25.4
France,Europe,34,Mid-Cluster (100–1k GPUs),Fine-tuning pipelines,87,28.3,23,8.1,7.5,10.9,14.8,18.9,22.7,28.3
Canada,Americas,26,Mid-Cluster (100–1k GPUs),Retrieval & vector DB,84,26.0,20,7.2,7.0,9.8,13.4,17.2,20.8,26.0
Netherlands,Europe,24,Enterprise (1k–10k GPUs),Real-time inference,90,30.4,25,8.7,8.2,11.8,16.1,20.4,24.8,30.4
South Korea,Asia-Pacific,28,Mid-Cluster (100–1k GPUs),Foundation pre-training,86,27.9,22,7.9,7.1,10.5,14.6,18.4,22.1,27.9
Australia,Asia-Pacific,22,Edge / Local (<100 GPUs),Retrieval & vector DB,81,23.8,18,6.4,5.9,8.7,12.1,15.6,19.0,23.8
Switzerland,Europe,20,Mid-Cluster (100–1k GPUs),Fine-tuning pipelines,89,28.9,23,7.8,7.8,11.2,15.2,19.1,23.0,28.9
India,Asia-Pacific,33,Mid-Cluster (100–1k GPUs),Real-time inference,76,22.1,17,8.5,4.2,6.8,10.4,13.9,17.6,22.1
Brazil,Americas,20,Edge / Local (<100 GPUs),Retrieval & vector DB,72,19.4,15,5.9,4.5,6.9,9.8,12.7,15.8,19.4
United Arab Emirates,Middle East & Africa,26,Enterprise (1k–10k GPUs),Foundation pre-training,82,24.6,20,7.4,5.4,8.3,12.0,15.8,19.5,24.6
Saudi Arabia,Middle East & Africa,22,Edge / Local (<100 GPUs),Fine-tuning pipelines,75,18.7,14,5.6,3.8,6.1,9.0,12.1,15.0,18.7
South Africa,Middle East & Africa,18,Edge / Local (<100 GPUs),Retrieval & vector DB,69,15.8,12,4.5,3.6,5.4,7.9,10.4,12.9,15.8`
  }
];

