import type {
  ColumnDisplayLabels,
  ColumnMappingConfig,
  FolioData,
  FolioReportMeta,
  FolioReportNarrative,
} from '../types/folio';

export const DEFAULT_COLUMN_DISPLAY_LABELS: ColumnDisplayLabels = {
  market: 'Primary Entity / Market (market)',
  region: 'Region / Geography (region)',
  value: 'Value / Adoption Share (value)',
  year: 'Period / Year (year)',
  policy: 'Policy / Readiness Score (policy)',
  bps: 'Efficiency / Cost Index (bps)',
  delta: 'YoY Change / Delta (delta)',
  count: 'Records Count (count)',
  tier: 'Tier / Asset Size (tier)',
  segment: 'Segment / Role / Sector (segment)',
  category: 'Category / Dimension (category)',
  value_2024: '2024 Baseline (value_2024)',
};

const DEFAULT_SHORT_FALLBACKS: Record<keyof ColumnDisplayLabels, string> = {
  market: 'Market',
  region: 'Region',
  value: 'Adoption 2026 (%)',
  year: 'Year',
  policy: 'Policy (%)',
  bps: 'Efficiency gain (bps)',
  delta: 'Δ YoY (pp)',
  count: 'Records',
  tier: 'Tier',
  segment: 'Segment',
  category: 'Category',
  value_2024: '2024',
};

export function cloneColumnLabels(
  labels?: Partial<ColumnDisplayLabels>
): ColumnDisplayLabels {
  return {
    ...DEFAULT_COLUMN_DISPLAY_LABELS,
    ...(labels || {}),
  };
}

/**
 * Converts a mapping field label (either default like "Primary Entity / Market (market)"
 * or user-edited like "Hospital Facility" or "Department (dept)") into a clean display label
 * for table headers, chart axes, filter buttons, and narrative copy.
 */
export function getShortColumnLabel(
  labels: Partial<ColumnDisplayLabels> | undefined,
  key: keyof ColumnDisplayLabels
): string {
  const raw = (labels?.[key] || DEFAULT_COLUMN_DISPLAY_LABELS[key] || '').trim();
  if (!raw) return DEFAULT_SHORT_FALLBACKS[key];

  if (raw === DEFAULT_COLUMN_DISPLAY_LABELS[key]) {
    return DEFAULT_SHORT_FALLBACKS[key];
  }

  const stripped = raw
    .replace(
      /\s*\((market|region|value|year|tier|segment|policy|bps|delta|count|records|category|value_2024)\)\s*$/i,
      ''
    )
    .trim();

  return stripped || DEFAULT_SHORT_FALLBACKS[key];
}

/**
 * Infers singular and plural entity nouns from the custom market label or context prompt.
 */
export function inferEntityNouns(
  labels?: Partial<ColumnDisplayLabels>,
  contextPrompt?: string
): { singular: string; plural: string } {
  const shortMarket = getShortColumnLabel(labels, 'market');
  const cleanBase = shortMarket
    .replace(/\s*\([^)]*\)\s*/g, '')
    .split('/')[0]
    .trim();

  if (cleanBase && cleanBase.toLowerCase() !== 'market') {
    const lower = cleanBase.toLowerCase();
    const plural =
      lower.endsWith('y') && !/[aeiou]y$/.test(lower)
        ? `${cleanBase.slice(0, -1)}ies`
        : lower.endsWith('s')
          ? cleanBase
          : `${cleanBase}s`;
    return {
      singular: cleanBase.toLowerCase(),
      plural: plural.toLowerCase(),
    };
  }

  if (contextPrompt && contextPrompt.trim()) {
    const cp = contextPrompt.toLowerCase();
    if (/(hospital|clinic|patient|trial|medical|health)/.test(cp)) {
      return { singular: 'clinical site', plural: 'clinical sites' };
    }
    if (/(product|sku|store|retail|ecommerce|merchandise)/.test(cp)) {
      return { singular: 'product line', plural: 'product lines' };
    }
    if (/(school|university|student|campus|district)/.test(cp)) {
      return { singular: 'institution', plural: 'institutions' };
    }
    if (/(energy|grid|solar|wind|power|plant|utility)/.test(cp)) {
      return { singular: 'grid hub', plural: 'grid hubs' };
    }
    if (/(cluster|workload|gpu|cloud|server|datacenter)/.test(cp)) {
      return { singular: 'cloud hub', plural: 'cloud hubs' };
    }
    if (/(department|team|employee|workforce|office)/.test(cp)) {
      return { singular: 'business unit', plural: 'business units' };
    }
  }

  return { singular: 'market', plural: 'markets' };
}

/**
 * Adopts the actual CSV column headers from the user's file as the displayed column names.
 */
export function adoptCsvHeadersAsDisplayLabels(
  mapping: ColumnMappingConfig,
  headersOrCurrent?: string[] | Partial<ColumnDisplayLabels>,
  current?: Partial<ColumnDisplayLabels>
): ColumnDisplayLabels {
  const existing = Array.isArray(headersOrCurrent) ? current : headersOrCurrent;
  const base = cloneColumnLabels(existing);
  if (mapping.marketCol) base.market = mapping.marketCol;
  if (mapping.regionCol) base.region = mapping.regionCol;
  if (mapping.shareCol) base.value = mapping.shareCol;
  if (mapping.recordsCol) base.count = mapping.recordsCol;
  if (mapping.tierCol) base.tier = mapping.tierCol;
  if (mapping.segmentCol) base.segment = mapping.segmentCol;
  if (mapping.policyCol) base.policy = mapping.policyCol;
  if (mapping.bpsCol) base.bps = mapping.bpsCol;
  if (mapping.deltaCol) base.delta = mapping.deltaCol;
  if (mapping.y2024Col) base.value_2024 = mapping.y2024Col;
  return base;
}

export interface DatasetStatisticalDigest {
  contextPrompt: string;
  columnHeaders: {
    entity: string;
    region: string;
    share: string;
    records: string;
    tier: string;
    segment: string;
    policy: string;
    bps: string;
    delta: string;
    medianVolume: string;
    trend: string;
  };
  entitySingular: string;
  entityPlural: string;
  totalRecords: number;
  entityCount: number;
  regionCount: number;
  avgShare: number;
  avgPolicy: number;
  avgDelta: number;
  avgBps: number;
  topEntitiesByShare: {
    name: string;
    region: string;
    share: number;
    policy: number;
    delta: number;
    bps: number;
    n: number;
  }[];
  fastestGrowingEntity: {
    name: string;
    region: string;
    delta: number;
    share: number;
  } | null;
  topRegions: { region: string; n: number; share: number; medianBook: number }[];
  regionTotals: { region: string; n: number; share: number; medianBook: number }[];
  functionCategories: { name: string; value: number }[];
  topDumbbellGainers: { item: string; y2024: number; y2026: number; diff: number }[];
  topDumbbellDecliners: { item: string; y2024: number; y2026: number; diff: number }[];
  riskLimitsGlobal: {
    labels: [string, string, string];
    values: [number, number, number];
    n: number;
  };
  riskLimitsTopExpandingRegion: {
    region: string;
    expandPct: number;
    holdPct: number;
    reducePct: number;
  } | null;
  trajectory: {
    startYear: number;
    startVal: number;
    endYear: number;
    endVal: number;
    milestoneCount: number;
    firstEventTitle: string;
    latestEventTitle: string;
  };
  volume: {
    startYear: string;
    startTotal: number;
    endYear: string;
    endTotal: number;
    endTrillions: number;
    seriesSummary: { label: string; startVal: number; endVal: number }[];
  };
  heatmap: {
    rowCount: number;
    colCount: number;
    cols: string[];
    highestRow: {
      sector: string;
      peakVal: number;
      peakCol: string;
      globalVal: number;
    } | null;
    lowestRow: { sector: string; globalVal: number } | null;
  };
  waffle: {
    allVerified: number;
    allEstimated: number;
    allNone: number;
    topSegmentName: string;
    topSegmentVerified: number;
  };
  likert: {
    topAgreeStatements: { text: string; agreePct: number; disagreePct: number }[];
    lowestAgreeStatement: { text: string; agreePct: number; disagreePct: number } | null;
  };
  scatter: {
    pointCount: number;
    sectors: string[];
    slope: number;
    r2: number;
  };
  outlook: {
    labels: [string, string, string];
    values: [number, number, number];
  };
}

function computeOlsStats(
  deals: FolioData['pricing']['deals']
): { slope: number; r2: number } {
  const n = deals.length;
  if (n < 2) return { slope: -1.3, r2: 0.92 };
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  deals.forEach((p) => {
    sx += p.score;
    sy += p.bps;
    sxx += p.score * p.score;
    sxy += p.score * p.bps;
  });
  const mx = sx / n;
  const my = sy / n;
  const den = sxx - n * mx * mx;
  if (Math.abs(den) < 1e-9) return { slope: 0, r2: 0 };
  const slope = (sxy - n * mx * my) / den;
  const intercept = my - slope * mx;
  let ssRes = 0,
    ssTot = 0;
  deals.forEach((p) => {
    const pred = slope * p.score + intercept;
    ssRes += (p.bps - pred) ** 2;
    ssTot += (p.bps - my) ** 2;
  });
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;
  return {
    slope: Number(slope.toFixed(2)),
    r2: Number(r2.toFixed(2)),
  };
}

/**
 * Extracts exact statistics and extreme values from any FolioData object so that
 * both the deterministic narrative builder and Gemini AI reference real data points.
 */
export function extractDatasetFacts(
  data: FolioData,
  labels?: Partial<ColumnDisplayLabels>,
  contextPrompt = ''
): DatasetStatisticalDigest {
  const colHeaders = {
    entity: getShortColumnLabel(labels, 'market'),
    region: getShortColumnLabel(labels, 'region'),
    share: getShortColumnLabel(labels, 'value'),
    records: getShortColumnLabel(labels, 'count'),
    tier: getShortColumnLabel(labels, 'tier'),
    segment: getShortColumnLabel(labels, 'segment'),
    policy: getShortColumnLabel(labels, 'policy'),
    bps: getShortColumnLabel(labels, 'bps'),
    delta: getShortColumnLabel(labels, 'delta'),
    medianVolume: 'Median volume ($bn)',
    trend: 'Trend 2021–26',
  };

  const { singular, plural } = inferEntityNouns(labels, contextPrompt);
  const markets = data.markets || [];
  const totalRecords =
    data.heroMatrix.total || markets.reduce((a, m) => a + m.n, 0) || 1;
  const entityCount = markets.length || 16;
  const regionCount =
    data.sampleRegion.length || data.heroMatrix.region.length || 4;

  const avgShare =
    markets.length > 0
      ? Number(
          (markets.reduce((a, m) => a + m.share, 0) / markets.length).toFixed(1)
        )
      : 14.1;
  const avgPolicy =
    markets.length > 0
      ? Number(
          (markets.reduce((a, m) => a + m.policy, 0) / markets.length).toFixed(1)
        )
      : 70.0;
  const avgDelta =
    markets.length > 0
      ? Number(
          (markets.reduce((a, m) => a + m.delta, 0) / markets.length).toFixed(1)
        )
      : 4.5;
  const avgBps =
    markets.length > 0
      ? Number(
          (markets.reduce((a, m) => a + m.bps, 0) / markets.length).toFixed(1)
        )
      : 12.0;

  const sortedByShare = [...markets].sort((a, b) => b.share - a.share);
  const topEntitiesByShare = sortedByShare.slice(0, 3).map((m) => ({
    name: m.market,
    region: m.region,
    share: m.share,
    policy: m.policy,
    delta: m.delta,
    bps: m.bps,
    n: m.n,
  }));

  const sortedByDelta = [...markets].sort((a, b) => b.delta - a.delta);
  const fastestGrowingEntity = sortedByDelta[0]
    ? {
        name: sortedByDelta[0].market,
        region: sortedByDelta[0].region,
        delta: sortedByDelta[0].delta,
        share: sortedByDelta[0].share,
      }
    : null;

  const topRegions = [...data.sampleRegion].sort((a, b) => b.n - a.n);
  const functionCategories = [...data.sampleFunction].sort(
    (a, b) => b.value - a.value
  );

  const dumbbellWithDiff = data.priorities.map((p) => ({
    item: p.item,
    y2024: p.y2024,
    y2026: p.y2026,
    diff: p.y2026 - p.y2024,
  }));
  const topDumbbellGainers = [...dumbbellWithDiff]
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);
  const topDumbbellDecliners = [...dumbbellWithDiff]
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 2);

  const rlGlobal = data.riskLimits.regions.Global ||
    Object.values(data.riskLimits.regions)[0] || {
      n: totalRecords,
      values: [20, 60, 20] as [number, number, number],
    };
  const nonGlobalEntries = Object.entries(data.riskLimits.regions).filter(
    ([k]) => k !== 'Global'
  );
  const sortedExpanding = [...nonGlobalEntries].sort(
    (a, b) => b[1].values[0] - a[1].values[0]
  );
  const riskLimitsTopExpandingRegion = sortedExpanding[0]
    ? {
        region: sortedExpanding[0][0],
        expandPct: sortedExpanding[0][1].values[0],
        holdPct: sortedExpanding[0][1].values[1],
        reducePct: sortedExpanding[0][1].values[2],
      }
    : null;

  const regPts = data.regulationLine || [];
  const startPt = regPts[0] || { year: 2021, value: 23 };
  const endPt = regPts[regPts.length - 1] || { year: 2026, value: 55 };
  const regEvs = data.regulationEvents || [];

  const volYears = data.volume.years || [];
  const firstYr = volYears[0] || {
    year: '2019',
    total: 214,
    loans: 112,
    green: 64,
    scf: 38,
    trans: 0,
    est: false,
  };
  const lastYr = volYears[volYears.length - 1] || {
    year: '2026e',
    total: 1840,
    loans: 702,
    green: 298,
    scf: 541,
    trans: 299,
    est: true,
  };
  const seriesSummary = data.volume.series.map((s) => ({
    label: s.label,
    startVal: Number(firstYr[s.key] || 0),
    endVal: Number(lastYr[s.key] || 0),
  }));

  const expCols = data.exposure.cols || [];
  const expRows = data.exposure.rows || [];
  let highestRow: DatasetStatisticalDigest['heatmap']['highestRow'] = null;
  let lowestRow: DatasetStatisticalDigest['heatmap']['lowestRow'] = null;
  if (expRows.length > 0) {
    const scoredRows = expRows.map((r) => {
      const maxVal = Math.max(...r.vals);
      const maxIdx = r.vals.indexOf(maxVal);
      const globalVal = r.vals[r.vals.length - 1] ?? maxVal;
      return {
        sector: r.sector,
        peakVal: maxVal,
        peakCol: expCols[maxIdx] || 'Global',
        globalVal,
      };
    });
    scoredRows.sort((a, b) => b.peakVal - a.peakVal);
    highestRow = scoredRows[0];
    lowestRow = {
      sector: scoredRows[scoredRows.length - 1].sector,
      globalVal: scoredRows[scoredRows.length - 1].globalVal,
    };
  }

  const waffleEntries = Object.entries(data.waffle || {});
  const allWaffle =
    data.waffle.All ||
    (waffleEntries[0]
      ? waffleEntries[0][1]
      : { verified: 23, estimated: 41, none: 36 });
  const bestWaffleEntry = [...waffleEntries].sort(
    (a, b) => b[1].verified - a[1].verified
  )[0];

  const likertScored = (data.likert || []).map((l) => ({
    text: l.text,
    agreePct: (l.vals[3] || 0) + (l.vals[4] || 0),
    disagreePct: (l.vals[0] || 0) + (l.vals[1] || 0),
  }));
  const sortedLikert = [...likertScored].sort(
    (a, b) => b.agreePct - a.agreePct
  );

  const ols = computeOlsStats(data.pricing.deals || []);

  return {
    contextPrompt: contextPrompt.trim(),
    columnHeaders: colHeaders,
    entitySingular: singular,
    entityPlural: plural,
    totalRecords,
    entityCount,
    regionCount,
    avgShare,
    avgPolicy,
    avgDelta,
    avgBps,
    topEntitiesByShare,
    fastestGrowingEntity,
    topRegions,
    regionTotals: topRegions,
    functionCategories,
    topDumbbellGainers,
    topDumbbellDecliners,
    riskLimitsGlobal: {
      labels: data.riskLimits.labels,
      values: rlGlobal.values,
      n: rlGlobal.n,
    },
    riskLimitsTopExpandingRegion,
    trajectory: {
      startYear: startPt.year,
      startVal: startPt.value,
      endYear: endPt.year,
      endVal: endPt.value,
      milestoneCount: regEvs.length,
      firstEventTitle: regEvs[0]?.title || 'Baseline launch',
      latestEventTitle:
        regEvs[regEvs.length - 1]?.title || 'Annual benchmark release',
    },
    volume: {
      startYear: firstYr.year,
      startTotal: firstYr.total,
      endYear: lastYr.year,
      endTotal: lastYr.total,
      endTrillions: Number((lastYr.total / 1000).toFixed(2)),
      seriesSummary,
    },
    heatmap: {
      rowCount: expRows.length,
      colCount: expCols.length,
      cols: expCols,
      highestRow,
      lowestRow,
    },
    waffle: {
      allVerified: allWaffle.verified,
      allEstimated: allWaffle.estimated,
      allNone: allWaffle.none,
      topSegmentName: bestWaffleEntry ? bestWaffleEntry[0] : 'Enterprise',
      topSegmentVerified: bestWaffleEntry ? bestWaffleEntry[1].verified : 52,
    },
    likert: {
      topAgreeStatements: sortedLikert.slice(0, 2),
      lowestAgreeStatement: sortedLikert[sortedLikert.length - 1] || null,
    },
    scatter: {
      pointCount: data.pricing.deals.length,
      sectors: data.pricing.sectors.map((s) => s.name),
      slope: ols.slope,
      r2: ols.r2,
    },
    outlook: {
      labels: data.outlookBars.labels,
      values: data.outlookBars.values,
    },
  };
}

function splitIntoThreeHeadlineLines(
  phrase: string,
  fallback: [string, string, string]
): [string, string, string] {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return fallback;
  const third = Math.ceil(words.length / 3);
  const l1 = words.slice(0, third).join(' ');
  const l2 = words.slice(third, third * 2).join(' ');
  const l3 = words.slice(third * 2).join(' ');
  if (!l1 || !l2 || !l3) return fallback;
  return [l1, l2, l3];
}

/**
 * Deterministically builds a complete, data-grounded FolioReportMeta & FolioReportNarrative
 * using the user's contextPrompt, custom columnLabels, and actual data points from FolioData.
 */
export function synthesizeThematicReportMeta(
  data: FolioData,
  baseMeta: FolioReportMeta,
  options: {
    contextPrompt?: string;
    columnLabels?: Partial<ColumnDisplayLabels>;
    updateHeadingsFromContext?: boolean;
    preserveHeroIfDefault?: boolean;
  } = {}
): FolioReportMeta {
  const columnLabels = cloneColumnLabels(
    options.columnLabels ?? baseMeta.columnLabels
  );
  const contextPrompt = (
    options.contextPrompt ??
    baseMeta.contextPrompt ??
    ''
  ).trim();
  const facts = extractDatasetFacts(data, columnLabels, contextPrompt);
  const { columnHeaders: ch, entitySingular, entityPlural } = facts;

  const top1 = facts.topEntitiesByShare[0];
  const top2 = facts.topEntitiesByShare[1];
  const top3 = facts.topEntitiesByShare[2];
  const topReg = facts.topRegions[0];
  const secReg = facts.topRegions[1];
  const lowReg = facts.topRegions[facts.topRegions.length - 1];

  const fnListText = facts.functionCategories
    .map((f) => `${f.name} (${f.value} %)`)
    .join(', ');

  const gainer1 = facts.topDumbbellGainers[0];
  const gainer2 = facts.topDumbbellGainers[1];
  const decliner1 = facts.topDumbbellDecliners[0];

  const s0 = facts.volume.seriesSummary[0] || {
    label: 'Series A',
    startVal: 112,
    endVal: 702,
  };
  const s1 = facts.volume.seriesSummary[1] || {
    label: 'Series B',
    startVal: 64,
    endVal: 298,
  };
  const s2 = facts.volume.seriesSummary[2] || {
    label: 'Series C',
    startVal: 38,
    endVal: 541,
  };
  const s3 = facts.volume.seriesSummary[3] || {
    label: 'Series D',
    startVal: 0,
    endVal: 299,
  };

  const baselineShare = Math.max(
    0.1,
    Number((facts.avgShare - facts.avgDelta).toFixed(1))
  );

  let title = baseMeta.title;
  let mastheadNote = baseMeta.mastheadNote;
  let heroHeadline: [string, string, string] = [...baseMeta.heroHeadline] as [
    string,
    string,
    string,
  ];
  let heroLede = baseMeta.heroLede;
  let sourceLabel = baseMeta.sourceLabel;

  const shouldRewriteHero =
    !options.preserveHeroIfDefault &&
    options.updateHeadingsFromContext !== false;

  if (contextPrompt && shouldRewriteHero) {
    const cleanTopic = contextPrompt.replace(/[.!?]+$/, '').trim();
    const shortTopicWords = cleanTopic.split(/\s+/).slice(0, 4).join(' ');
    title =
      shortTopicWords.length > 36
        ? shortTopicWords.slice(0, 36).trim()
        : shortTopicWords;
    mastheadNote = `${cleanTopic} · ${facts.totalRecords.toLocaleString()} ${ch.records} across ${facts.entityCount} ${entityPlural} & ${facts.regionCount} ${ch.region} groups`;
    heroHeadline = splitIntoThreeHeadlineLines(
      cleanTopic.split(/\s+/).length >= 4
        ? `${cleanTopic.split(/\s+/).slice(0, 7).join(' ')}.`
        : `${cleanTopic} benchmark & performance analysis.`,
      heroHeadline
    );
    heroLede = `Comprehensive analysis of ${cleanTopic.toLowerCase()}, synthesized across ${facts.totalRecords.toLocaleString()} ${ch.records.toLowerCase()} in ${facts.entityCount} ${entityPlural} and ${facts.regionCount} ${ch.region.toLowerCase()} cohorts. ${
      top1
        ? `Leading ${entityPlural} by ${ch.share} include ${top1.name} (${top1.share} %, ${ch.policy}: ${top1.policy} %)${
            top2 ? ` and ${top2.name} (${top2.share} %)` : ''
          }, with an overall average ${ch.share.toLowerCase()} of ${facts.avgShare} % (${facts.avgDelta >= 0 ? '+' : ''}${facts.avgDelta} pp ${ch.delta}).`
        : ''
    }`;
    sourceLabel = `Source: ${title} dataset (${facts.totalRecords.toLocaleString()} ${ch.records.toLowerCase()}, ${facts.entityCount} ${entityPlural})`;
  } else if (shouldRewriteHero) {
    mastheadNote = `${title} · ${facts.totalRecords.toLocaleString()} ${ch.records} · ${facts.entityCount} ${entityPlural} across ${facts.regionCount} ${ch.region} cohorts`;
    sourceLabel = `Source: ${title} benchmark, n = ${facts.totalRecords.toLocaleString()}`;
    heroLede = `Interactive benchmark analyzing ${facts.totalRecords.toLocaleString()} ${ch.records.toLowerCase()} across ${facts.entityCount} ${entityPlural} and ${facts.regionCount} ${ch.region.toLowerCase()} cohorts. ${
      top1
        ? `${top1.name} leads ${ch.share.toLowerCase()} at ${top1.share} % (${ch.policy}: ${top1.policy} %)${
            top2 ? `, followed by ${top2.name} (${top2.share} %)` : ''
          }${top3 ? ` and ${top3.name} (${top3.share} %)` : ''}.`
        : ''
    }`;
  }

  const narrative: FolioReportNarrative = {
    kpiCaptions: [
      `${ch.records.toLowerCase()} analyzed across ${ch.region.toLowerCase()}, ${ch.tier.toLowerCase()} & ${ch.segment.toLowerCase()}`,
      `${entityPlural} indexed across ${facts.regionCount} ${ch.region.toLowerCase()} cohorts`,
      `cumulative multi-year ${s0.label.toLowerCase()} & ${s2.label.toLowerCase()} volume (${facts.volume.endYear})`,
      `mean ${ch.share.toLowerCase()} across ${facts.entityCount} ${entityPlural} (baseline: ${baselineShare} %)`,
    ],
    s01ChartSubtitle: `Unit matrix chart — ${facts.totalRecords.toLocaleString()} ${ch.records.toLowerCase()} grouped by ${ch.region}, ${ch.tier} & ${ch.segment}`,
    s01FigureCaption: `Unit matrix of ${facts.totalRecords.toLocaleString()} ${ch.records.toLowerCase()} across ${facts.entityCount} ${entityPlural}; select a grouping above to disaggregate by ${ch.region}, ${ch.tier}, or ${ch.segment}.`,

    s02: {
      kicker: `02 — ${ch.segment} & ${ch.region} breakdown`,
      headline: [
        `${ch.segment} mix`,
        `and ${ch.region.toLowerCase()}`,
        `concentration.`,
      ],
      paragraphs: [
        `This spread pairs a 100 % stacked ${ch.segment.toLowerCase()} composition bar with a sortable ${ch.region.toLowerCase()} summary table. Hovering or focusing any row in the ${ch.region.toLowerCase()} table cross-highlights matching squares in the Section 01 unit matrix.`,
        `Across ${facts.totalRecords.toLocaleString()} total ${ch.records.toLowerCase()}, the ${ch.segment.toLowerCase()} distribution spans ${fnListText}.`,
        topReg
          ? `Geographically, ${topReg.region} accounts for the largest concentration with ${topReg.n} ${ch.records.toLowerCase()} (${topReg.share.toFixed(1)} % share, ${ch.medianVolume.toLowerCase()}: ${topReg.medianBook.toFixed(1)})${
              secReg
                ? `, followed by ${secReg.region} with ${secReg.n} (${secReg.share.toFixed(1)} %)`
                : ''
            }.`
          : `Every figure includes an expandable accessible data table toggle and keyboard controls.`,
        lowReg && lowReg !== topReg
          ? `${lowReg.region} represents ${lowReg.n} ${ch.records.toLowerCase()} (${lowReg.share.toFixed(1)} % of the cohort) with a ${ch.medianVolume.toLowerCase()} of ${lowReg.medianBook.toFixed(1)}.`
          : `Click any column header in the ${ch.region.toLowerCase()} table to re-rank cohorts by ${ch.records.toLowerCase()}, share, or ${ch.medianVolume.toLowerCase()}.`,
      ],
      chartSubtitle: `Composition by ${ch.segment.toLowerCase()} (100% stacked bar)`,
      secondaryChartSubtitle: `Sortable ${ch.region.toLowerCase()} breakdown`,
      figureCaption: `Proportional ${ch.segment.toLowerCase()} breakdown across ${facts.totalRecords.toLocaleString()} ${ch.records.toLowerCase()} rendered as a 100% stacked bar.`,
      secondaryFigureCaption: `${ch.region} distribution and ${ch.medianVolume.toLowerCase()} across ${facts.totalRecords.toLocaleString()} ${ch.records.toLowerCase()}; hover rows to highlight Section 01.`,
    },

    s03: {
      kicker: `03 — Period-over-period shifts`,
      headline: [
        `Largest gains led`,
        `by ${(gainer1?.item || 'top initiatives').split(/\s+/).slice(0, 2).join(' ').toLowerCase()}`,
        `through 2026.`,
      ],
      paragraphs: [
        `Dumbbell range comparisons track how ${data.priorities.length} tracked categories shifted between the 2024 baseline (hollow circles) and the 2026 snapshot (filled dots).`,
        gainer1
          ? `${gainer1.item} recorded the steepest expansion, climbing from ${gainer1.y2024} % in 2024 to ${gainer1.y2026} % in 2026 (${gainer1.diff >= 0 ? '+' : '−'}${Math.abs(gainer1.diff)} pp)${
              gainer2
                ? `, alongside ${gainer2.item} (${gainer2.y2024} % → ${gainer2.y2026} %, ${gainer2.diff >= 0 ? '+' : '−'}${Math.abs(gainer2.diff)} pp)`
                : ''
            }.`
          : `Connecting lines encode direction and momentum across every tracked initiative.`,
        decliner1 && decliner1.diff < 0
          ? `Conversely, ${decliner1.item} contracted by ${Math.abs(decliner1.diff)} percentage points over the same window, falling from ${decliner1.y2024} % to ${decliner1.y2026} %.`
          : `Even the slowest-moving category (${decliner1?.item || 'baseline cohort'}) shifted from ${decliner1?.y2024 ?? 0} % to ${decliner1?.y2026 ?? 0} %.`,
        `Use the segmented sort controls to reorder all ${data.priorities.length} categories live by 2026 level, net change, or 2024 baseline.`,
      ],
      chartSubtitle: `% benchmark comparison across ${data.priorities.length} tracked categories, 2024 vs 2026`,
      figureCaption: `Animated dumbbell comparison tracking 2024 baseline vs 2026 levels across ${data.priorities.length} categories.`,
    },

    s04: {
      kicker: `04 — ${ch.region} posture distribution`,
      headline: [
        `Filter ${ch.region.toLowerCase()}`,
        `postures across`,
        `${facts.riskLimitsGlobal.labels.join(', ').toLowerCase()}.`,
      ],
      leadStatValue: `${facts.riskLimitsGlobal.values[1]} %`,
      leadStatCaption: `held ${ch.share.toLowerCase()} targets in "${facts.riskLimitsGlobal.labels[1]}" globally (n = ${facts.riskLimitsGlobal.n}), while ${facts.riskLimitsGlobal.values[2]} % reported "${facts.riskLimitsGlobal.labels[2]}" and ${facts.riskLimitsGlobal.values[0]} % reported "${facts.riskLimitsGlobal.labels[0]}".`,
      paragraphs: [
        `This vertical bar spread disaggregates ${facts.totalRecords.toLocaleString()} ${ch.records.toLowerCase()} into three posture buckets—${facts.riskLimitsGlobal.labels[0]}, ${facts.riskLimitsGlobal.labels[1]}, and ${facts.riskLimitsGlobal.labels[2]}—with synchronized rolling numerals.`,
        `At the global level (n = ${facts.riskLimitsGlobal.n}), ${facts.riskLimitsGlobal.values[1]} % are in ${facts.riskLimitsGlobal.labels[1]}, ${facts.riskLimitsGlobal.values[0]} % in ${facts.riskLimitsGlobal.labels[0]}, and ${facts.riskLimitsGlobal.values[2]} % in ${facts.riskLimitsGlobal.labels[2]}.`,
        facts.riskLimitsTopExpandingRegion
          ? `Among individual ${ch.region.toLowerCase()} cohorts, ${facts.riskLimitsTopExpandingRegion.region} shows the highest "${facts.riskLimitsGlobal.labels[0]}" share at ${facts.riskLimitsTopExpandingRegion.expandPct} % (${facts.riskLimitsTopExpandingRegion.holdPct} % ${facts.riskLimitsGlobal.labels[1].toLowerCase()}, ${facts.riskLimitsTopExpandingRegion.reducePct} % ${facts.riskLimitsGlobal.labels[2].toLowerCase()}).`
          : `Switch between ${ch.region.toLowerCase()} filters to inspect localized deviations against the global baseline.`,
        `Each bar supports keyboard navigation and hover tooltips comparing regional percentages against the overall benchmark.`,
      ],
      chartSubtitle: `${ch.region} posture distribution across ${facts.riskLimitsGlobal.labels.join(', ')}`,
      figureCaption: `Animated vertical KPI bars filtered by ${ch.region.toLowerCase()} (${facts.riskLimitsGlobal.labels.join(' / ')}).`,
    },

    s05: {
      kicker: `05 — Multi-year trajectory & milestones`,
      headline: [
        `Trajectory rose`,
        `from ${facts.trajectory.startVal} % in ${facts.trajectory.startYear}`,
        `to ${facts.trajectory.endVal} % in ${facts.trajectory.endYear}.`,
      ],
      paragraphs: [
        `A scroll-scrubbed SVG trajectory tracks ${ch.share.toLowerCase()} climbing +${facts.trajectory.endVal - facts.trajectory.startVal} percentage points from ${facts.trajectory.startVal} % in ${facts.trajectory.startYear} to ${facts.trajectory.endVal} % in ${facts.trajectory.endYear}.`,
        `Directly beneath the trend line, an aligned timeline maps ${facts.trajectory.milestoneCount} key milestones from "${facts.trajectory.firstEventTitle}" through "${facts.trajectory.latestEventTitle}".`,
        `Click any square milestone node—or step through with the Left and Right arrow keys—to inspect how each event shaped the multi-year trajectory.`,
        `Across individual ${entityPlural}, ${
          facts.fastestGrowingEntity
            ? `${facts.fastestGrowingEntity.name} recorded the fastest annual momentum at +${facts.fastestGrowingEntity.delta} pp (${ch.share}: ${facts.fastestGrowingEntity.share} %).`
            : `annual momentum averaged +${facts.avgDelta} pp.`
        }`,
      ],
      chartSubtitle: `${ch.share} trajectory (${facts.trajectory.startYear}–${facts.trajectory.endYear}) paired with ${facts.trajectory.milestoneCount} milestone markers`,
      figureCaption: `Scroll-scrubbed trajectory (${facts.trajectory.startYear}–${facts.trajectory.endYear}) paired with ${facts.trajectory.milestoneCount} timeline events.`,
    },

    s06: {
      kicker: `06 — Stacked volume composition`,
      headline: [
        `Cumulative volume`,
        `scales from $${facts.volume.startTotal}bn`,
        `to $${facts.volume.endTotal.toLocaleString()}bn.`,
      ],
      paragraphs: [
        `Sticky scrollytelling steps trace aggregate volume across ${data.volume.years.length} periods—expanding from $${facts.volume.startTotal.toLocaleString()}bn in ${facts.volume.startYear} to $${facts.volume.endTotal.toLocaleString()}bn in ${facts.volume.endYear} across ${data.volume.series.map((s) => s.label).join(', ')}.`,
      ],
      scrollySteps: [
        {
          kicker: `Step 01 · Primary series foundation`,
          title: `${facts.volume.startYear}–2021: ${s0.label} anchored early scale`,
          body: `Isolates ${s0.label}, which expanded from $${s0.startVal.toLocaleString()}bn in ${facts.volume.startYear} to $${s0.endVal.toLocaleString()}bn by ${facts.volume.endYear} while establishing the core baseline.`,
        },
        {
          kicker: `Step 02 · Secondary acceleration`,
          title: `2022–2024: ${s2.label} accelerated rapidly`,
          body: `Highlights ${s2.label}, scaling from $${s2.startVal.toLocaleString()}bn in ${facts.volume.startYear} to $${s2.endVal.toLocaleString()}bn in ${facts.volume.endYear} alongside ${s1.label} ($${s1.endVal.toLocaleString()}bn).`,
        },
        {
          kicker: `Step 03 · Full stack & ${facts.volume.endYear} outlook`,
          title: `Full 4-series stack reaches $${facts.volume.endTotal.toLocaleString()}bn`,
          body: `Restores all four series—including ${s3.label} ($${s3.startVal.toLocaleString()}bn → $${s3.endVal.toLocaleString()}bn)—with hatched diagonal fill distinguishing forecast intervals.`,
        },
      ],
      figureCaption: `Scrollytelling stacked columns ($bn) across ${data.volume.series.map((s) => s.label).join(', ')} (${facts.volume.startYear}–${facts.volume.endYear}).`,
    },

    s07: {
      kicker: `07 — Cross-${ch.region.toLowerCase()} intensity heatmap`,
      headline: [
        `Compare ${facts.heatmap.rowCount}×${facts.heatmap.colCount} matrix`,
        `intensity across`,
        `${ch.region.toLowerCase()} cohorts.`,
      ],
      paragraphs: [
        facts.heatmap.highestRow
          ? `This ${facts.heatmap.rowCount}×${facts.heatmap.colCount} matrix heatmap compares intensity across ${facts.heatmap.rowCount} categories and ${facts.heatmap.colCount} ${ch.region.toLowerCase()} columns. "${facts.heatmap.highestRow.sector}" records the highest concentration, peaking at ${facts.heatmap.highestRow.peakVal} % in ${facts.heatmap.highestRow.peakCol} (${facts.heatmap.highestRow.globalVal} % overall).`
          : `This full-width matrix heatmap visualizes intensity across ${facts.heatmap.rowCount} categories and ${facts.heatmap.colCount} columns.`,
        facts.heatmap.lowestRow
          ? `At the lower end of the matrix, "${facts.heatmap.lowestRow.sector}" averages ${facts.heatmap.lowestRow.globalVal} %. Click any column header to sort categories live, or drag the threshold slider to isolate high-intensity cells.`
          : `Click any column header to sort categories live, or use the threshold slider to filter cells above a minimum percentage.`,
      ],
      chartSubtitle: `${facts.heatmap.rowCount}×${facts.heatmap.colCount} intensity matrix across ${facts.heatmap.cols.join(', ')}`,
      figureCaption: `Interactive ${facts.heatmap.rowCount}×${facts.heatmap.colCount} matrix heatmap across ${facts.heatmap.cols.join(', ')}.`,
    },

    s08: {
      kicker: `08 — Verification & sentiment distribution`,
      headline: [
        `${facts.waffle.allVerified} % verified coverage`,
        `paired with`,
        `diverging sentiment.`,
      ],
      waffleCalloutTitle: `in 100 ${ch.records.toLowerCase()} meet full verification criteria`,
      paragraphs: [
        `The 10×10 waffle lattice translates percentage splits into 100 discrete squares—showing ${facts.waffle.allVerified} % verified, ${facts.waffle.allEstimated} % estimated, and ${facts.waffle.allNone} % unverified across all ${ch.records.toLowerCase()}.`,
        `Filtering by segment reveals that ${facts.waffle.topSegmentName} achieves ${facts.waffle.topSegmentVerified} % verified coverage. Clicking any segment button ripples through the 100-cell grid and updates the rolling KPI counter.`,
        facts.likert.topAgreeStatements[0]
          ? `Beneath the waffle chart, diverging 5-point Likert bars show ${facts.likert.topAgreeStatements[0].agreePct} % net agreement that "${facts.likert.topAgreeStatements[0].text}".`
          : `Directly below, a diverging stacked Likert bar chart aligns 5-point responses around a shared neutral midpoint.`,
        facts.likert.lowestAgreeStatement
          ? `By contrast, only ${facts.likert.lowestAgreeStatement.agreePct} % agree that "${facts.likert.lowestAgreeStatement.text}" (${facts.likert.lowestAgreeStatement.disagreePct} % disagree).`
          : `Toggle between original statement order and net-agreement ranking above the chart.`,
      ],
      evidenceStats: [
        {
          value: `${facts.likert.topAgreeStatements[0]?.agreePct ?? 70} %`,
          caption: facts.likert.topAgreeStatements[0]
            ? `agree: "${facts.likert.topAgreeStatements[0].text}"`
            : `top statement net agreement across respondents`,
        },
        {
          value: `${facts.waffle.topSegmentVerified} %`,
          caption: `verified share in ${facts.waffle.topSegmentName} (vs ${facts.waffle.allVerified} % overall)`,
        },
        {
          value: `${facts.likert.lowestAgreeStatement?.agreePct ?? 19} %`,
          caption: facts.likert.lowestAgreeStatement
            ? `agree: "${facts.likert.lowestAgreeStatement.text}"`
            : `lowest statement agreement across sample`,
        },
      ],
      chartSubtitle: `10×10 proportion waffle chart (${Object.keys(data.waffle).join(' · ')})`,
      secondaryChartSubtitle: `Diverging 5-point Likert sentiment bars (${data.likert.length} statements)`,
      figureCaption: `10×10 waffle chart showing verified (${facts.waffle.allVerified} %), estimated (${facts.waffle.allEstimated} %), and unverified (${facts.waffle.allNone} %) proportions.`,
      secondaryFigureCaption: `Diverging stacked Likert bars across ${data.likert.length} statements centered on the neutral midpoint.`,
    },

    s09: {
      kicker: `09 — ${ch.policy} vs ${ch.bps} regression`,
      headline: [
        `Live OLS regression`,
        `across ${facts.scatter.pointCount} observations`,
        `(R² = ${facts.scatter.r2.toFixed(2)}).`,
      ],
      paragraphs: [
        `Evaluates the empirical relationship between ${ch.policy} (x-axis) and ${ch.bps} (y-axis) across ${facts.scatter.pointCount} observations spanning ${facts.scatter.sectors.join(', ')}. Across all active points, each unit of ${ch.policy.toLowerCase()} shifts ${ch.bps.toLowerCase()} by ${Math.abs(facts.scatter.slope).toFixed(1)} pts.`,
        `With an ordinary least-squares fit of R² = ${facts.scatter.r2.toFixed(2)}, higher ${ch.policy.toLowerCase()} scores consistently correlate with ${facts.scatter.slope <= 0 ? 'lower' : 'higher'} ${ch.bps.toLowerCase()}.`,
        `Use the ${ch.segment.toLowerCase()} chips and minimum ${ch.policy.toLowerCase()} slider to isolate specific cohorts; the OLS trend line, slope readout, and R² recalculate in real time.`,
        `Distinct geometric markers keep every ${ch.segment.toLowerCase()} cohort distinguishable without relying on color alone.`,
      ],
      chartSubtitle: `${ch.bps} (y) vs ${ch.policy} (x), ${facts.scatter.pointCount} observations across ${facts.scatter.sectors.length} cohorts`,
      figureCaption: `${ch.bps} (y) plotted against ${ch.policy} (x) across ${facts.scatter.pointCount} observations with live OLS regression.`,
    },

    s10: {
      kicker: `10 — ${ch.entity} index & CSV export`,
      headline: [
        `Search, sort & export`,
        `all ${facts.entityCount} ${entityPlural}`,
        `with live sparklines.`,
      ],
      paragraphs: [
        `The closing spread pairs a 12-month scenario projection (${facts.outlook.labels[0]}: ${facts.outlook.values[0]} %, ${facts.outlook.labels[1]}: ${facts.outlook.values[1]} %, ${facts.outlook.labels[2]}: ${facts.outlook.values[2]} %) with a full-width searchable index across all ${facts.entityCount} ${entityPlural}.`,
        top1
          ? `In the index table below, ${top1.name} (${top1.region}) leads ${ch.share.toLowerCase()} at ${top1.share.toFixed(1)} % (${ch.policy}: ${top1.policy} %, ${ch.bps}: ${top1.bps}, ${ch.delta}: +${top1.delta.toFixed(1)})${
              top2 ? `, followed by ${top2.name} (${top2.share.toFixed(1)} %)` : ''
            }. Filter by ${entitySingular} name or ${ch.region.toLowerCase()}, sort any column, and export to CSV.`
          : `Filter live by ${entitySingular} keyword or ${ch.region.toLowerCase()}, sort by any custom column header, and export the filtered view to CSV.`,
      ],
      chartSubtitle: `Forward 12-month scenario mix (${facts.outlook.labels.map((l, i) => `${l} ${facts.outlook.values[i]}%`).join(' · ')})`,
      figureCaption: `Three-bar scenario projection across ${facts.totalRecords.toLocaleString()} ${ch.records.toLowerCase()} (${facts.outlook.labels.join(' / ')}).`,
      tableHeading: `Interactive ${ch.entity} Index — ${facts.entityCount} ${entityPlural} across ${facts.regionCount} ${ch.region.toLowerCase()} groups`,
      searchPlaceholder: `Filter by ${entitySingular} name…`,
      entitySingular,
      entityPlural,
    },
  };

  return {
    ...baseMeta,
    title,
    mastheadNote,
    heroHeadline,
    heroLede,
    sourceLabel,
    kpiVolumeTrillions: facts.volume.endTrillions,
    kpiAdoptionRate: facts.avgShare,
    kpiAdoptionDelta: facts.avgDelta,
    contextPrompt,
    columnLabels,
    narrative,
  };
}

/**
 * Calls the server-side Gemini endpoint (/api/ai/synthesize-report) to generate
 * thematic, data-grounded report phrasing tailored to the user's context prompt,
 * custom column labels, and actual imported data points.
 */
export async function requestAiReportSynthesis(
  data: FolioData,
  currentMeta: FolioReportMeta,
  contextPromptOverride?: string,
  columnLabelsOverride?: Partial<ColumnDisplayLabels>
): Promise<{
  meta: FolioReportMeta;
  synthesizedBy: string;
  aiGenerated: boolean;
  message: string;
}> {
  const baselineMeta = synthesizeThematicReportMeta(data, currentMeta, {
    contextPrompt: contextPromptOverride ?? currentMeta.contextPrompt,
    columnLabels: columnLabelsOverride ?? currentMeta.columnLabels,
    updateHeadingsFromContext: true,
  });

  const facts = extractDatasetFacts(
    data,
    baselineMeta.columnLabels,
    baselineMeta.contextPrompt || ''
  );

  try {
    const response = await fetch('/api/ai/synthesize-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextPrompt: baselineMeta.contextPrompt || '',
        columnLabels: baselineMeta.columnLabels,
        facts,
        fallbackMeta: baselineMeta,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const reason = errBody.error || `HTTP ${response.status}`;
      return {
        meta: baselineMeta,
        synthesizedBy: 'deterministic-fallback',
        aiGenerated: false,
        message: `Applied data-grounded thematic report phrasing (${reason}).`,
      };
    }

    const body = await response.json();
    const returnedMeta: FolioReportMeta = body?.meta || baselineMeta;
    const synthesizedBy: string =
      body?.synthesizedBy || 'deterministic-fallback';

    return {
      meta: returnedMeta,
      synthesizedBy,
      aiGenerated: synthesizedBy === 'gemini-4-hydrogen',
      message:
        synthesizedBy === 'gemini-4-hydrogen'
          ? 'AI synthesized thematic report phrasing & data-point insights across all 10 sections.'
          : 'Applied data-grounded thematic report phrasing across all 10 sections.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return {
      meta: baselineMeta,
      synthesizedBy: 'deterministic-fallback',
      aiGenerated: false,
      message: `Applied data-grounded thematic report phrasing (${msg}).`,
    };
  }
}
