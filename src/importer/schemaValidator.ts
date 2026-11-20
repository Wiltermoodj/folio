import { cloneFolioData, DEFAULT_FOLIO_DATA } from '../data/defaultData';
import type { FolioData, ValidationIssue, ValidationResult } from '../types/folio';
import { parseNumeric } from './csvParser';

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

/**
 * Normalizes an array of numbers so their rounded integers sum to exactly 100.
 */
export function normalizePercentagesTo100(values: number[]): number[] {
  const clean = values.map(v => Math.max(0, parseNumeric(v, 0)));
  const sum = clean.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const even = Math.floor(100 / (clean.length || 1));
    return clean.map((_, i) => (i === 0 ? 100 - even * (clean.length - 1) : even));
  }
  const scaled = clean.map(v => (v / sum) * 100);
  const rounded = scaled.map(v => Math.round(v));
  const diff = 100 - rounded.reduce((a, b) => a + b, 0);
  if (diff !== 0 && rounded.length > 0) {
    // Adjust largest item
    let maxIdx = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (rounded[i] > rounded[maxIdx]) maxIdx = i;
    }
    rounded[maxIdx] = Math.max(0, rounded[maxIdx] + diff);
  }
  return rounded;
}

/**
 * Validates and optionally repairs/normalizes a partial or complete FolioData object
 * so it is 100% compatible with index.html.
 */
export function validateAndNormalizeFolioData(
  input: unknown,
  options: { autoFix?: boolean; baseData?: FolioData } = {}
): { data: FolioData; validation: ValidationResult } {
  const autoFix = options.autoFix !== false;
  const base = cloneFolioData(options.baseData || DEFAULT_FOLIO_DATA);
  const issues: ValidationIssue[] = [];

  if (!input || typeof input !== 'object') {
    issues.push({
      severity: 'error',
      section: 'Global',
      path: 'DATA',
      message: 'Input data is not a valid object; restored baseline structure.',
      autoFixed: true
    });
    return {
      data: base,
      validation: {
        valid: false,
        issues,
        stats: {
          totalRecords: base.heroMatrix.total,
          marketCount: base.markets.length,
          regionCount: base.sampleRegion.length,
          sectionCount: base.sections.length
        }
      }
    };
  }

  const raw = input as Partial<FolioData>;
  const out: FolioData = cloneFolioData(base);

  // 1. Sections & Palette
  if (Array.isArray(raw.sections) && raw.sections.length === 10) {
    out.sections = raw.sections.map((s, i) => ({
      id: s.id || base.sections[i].id,
      num: s.num || base.sections[i].num,
      short: s.short || base.sections[i].short,
      folioL: s.folioL || base.sections[i].folioL,
      folioR: s.folioR || base.sections[i].folioR
    }));
  }
  if (Array.isArray(raw.palette) && raw.palette.length > 0) {
    out.palette = raw.palette;
  }

  // 2. Section 01: heroMatrix
  if (raw.heroMatrix && typeof raw.heroMatrix === 'object') {
    const hm = raw.heroMatrix;
    const region = Array.isArray(hm.region) && hm.region.length > 0
      ? hm.region.map(g => ({ name: String(g.name || 'Region'), count: Math.max(1, Math.round(parseNumeric(g.count, 10))) }))
      : base.heroMatrix.region;
    const regionSum = region.reduce((a, g) => a + g.count, 0);
    const total = Math.max(1, Math.round(parseNumeric(hm.total, regionSum)) || regionSum);

    const normalizeGroupsToTotal = (groups: { name: string; count: number }[], label: string) => {
      const sum = groups.reduce((a, g) => a + g.count, 0);
      if (sum !== total) {
        issues.push({
          severity: 'warning',
          section: '01 Overview',
          path: `heroMatrix.${label}`,
          message: `Group counts summed to ${sum} instead of total (${total}).`,
          autoFixed: autoFix
        });
        if (autoFix && groups.length > 0 && sum > 0) {
          const scaled = groups.map(g => ({
            name: g.name,
            count: Math.max(1, Math.round((g.count / sum) * total))
          }));
          const newSum = scaled.reduce((a, g) => a + g.count, 0);
          scaled[0].count = Math.max(1, scaled[0].count + (total - newSum));
          return scaled;
        }
      }
      return groups;
    };

    const assetSize = Array.isArray(hm.assetSize) && hm.assetSize.length > 0
      ? hm.assetSize.map(g => ({ name: String(g.name || 'Tier'), count: Math.max(1, Math.round(parseNumeric(g.count, 10))) }))
      : base.heroMatrix.assetSize;
    const role = Array.isArray(hm.role) && hm.role.length > 0
      ? hm.role.map(g => ({ name: String(g.name || 'Segment'), count: Math.max(1, Math.round(parseNumeric(g.count, 10))) }))
      : base.heroMatrix.role;

    out.heroMatrix = {
      total,
      region: normalizeGroupsToTotal(region, 'region'),
      assetSize: normalizeGroupsToTotal(assetSize, 'assetSize'),
      role: normalizeGroupsToTotal(role, 'role')
    };
  }

  // 3. Section 02A: sampleFunction (100% stacked bar)
  if (Array.isArray(raw.sampleFunction) && raw.sampleFunction.length > 0) {
    const rawVals = raw.sampleFunction.map(i => parseNumeric(i.value, 0));
    const sum = rawVals.reduce((a, b) => a + b, 0);
    let normVals = rawVals.map(v => Math.round(v));
    if (Math.round(sum) !== 100) {
      issues.push({
        severity: 'warning',
        section: '02 Breakdown',
        path: 'sampleFunction',
        message: `Stacked bar shares summed to ${sum.toFixed(1)}% instead of 100%.`,
        autoFixed: autoFix
      });
      if (autoFix) normVals = normalizePercentagesTo100(rawVals);
    }
    out.sampleFunction = raw.sampleFunction.map((item, idx) => ({
      name: String(item.name || `Category ${idx + 1}`),
      value: normVals[idx],
      color: item.color || SERIES_COLORS[idx % SERIES_COLORS.length],
      text: item.text || SERIES_TEXT_COLORS[idx % SERIES_TEXT_COLORS.length]
    }));
  }

  // 4. Section 02B: sampleRegion
  if (Array.isArray(raw.sampleRegion) && raw.sampleRegion.length > 0) {
    const totalN = raw.sampleRegion.reduce((a, r) => a + Math.max(0, parseNumeric(r.n, 0)), 0) || 1;
    out.sampleRegion = raw.sampleRegion.map(r => {
      const n = Math.max(0, Math.round(parseNumeric(r.n, 0)));
      const calcShare = Number(((n / totalN) * 100).toFixed(1));
      const share = r.share !== undefined ? Number(parseNumeric(r.share, calcShare).toFixed(1)) : calcShare;
      return {
        region: String(r.region || 'Region'),
        n,
        share,
        medianBook: Number(parseNumeric(r.medianBook, 25).toFixed(1))
      };
    });
  }

  // 5. Section 03: priorities (Dumbbell chart)
  if (Array.isArray(raw.priorities) && raw.priorities.length > 0) {
    out.priorities = raw.priorities.map((p, idx) => ({
      item: String(p.item || `Initiative ${idx + 1}`),
      y2024: Math.min(100, Math.max(0, Math.round(parseNumeric(p.y2024, 20)))),
      y2026: Math.min(100, Math.max(0, Math.round(parseNumeric(p.y2026, 45))))
    }));
  }

  // 6. Section 04: riskLimits (Rotated KPI bars by region)
  if (raw.riskLimits && typeof raw.riskLimits === 'object') {
    const rl = raw.riskLimits;
    const labels: [string, string, string] =
      Array.isArray(rl.labels) && rl.labels.length >= 3
        ? [String(rl.labels[0]), String(rl.labels[1]), String(rl.labels[2])]
        : base.riskLimits.labels;
    const colors: [string, string, string] =
      Array.isArray(rl.colors) && rl.colors.length >= 3
        ? [String(rl.colors[0]), String(rl.colors[1]), String(rl.colors[2])]
        : base.riskLimits.colors;

    const regions: Record<string, { n: number; values: [number, number, number] }> = {};
    let maxObserved = 50;

    if (rl.regions && typeof rl.regions === 'object') {
      for (const [regName, entry] of Object.entries(rl.regions)) {
        if (!entry || typeof entry !== 'object') continue;
        const rawV = Array.isArray(entry.values) ? entry.values : [20, 60, 20];
        let v0 = Math.round(parseNumeric(rawV[0], 20));
        let v1 = Math.round(parseNumeric(rawV[1], 60));
        let v2 = Math.round(parseNumeric(rawV[2], 20));
        const sum = v0 + v1 + v2;
        if (sum !== 100) {
          issues.push({
            severity: 'warning',
            section: '04 KPI Targets',
            path: `riskLimits.regions.${regName}`,
            message: `Region "${regName}" KPI values summed to ${sum}% instead of 100%.`,
            autoFixed: autoFix
          });
          if (autoFix) {
            const norm = normalizePercentagesTo100([v0, v1, v2]);
            [v0, v1, v2] = norm;
          }
        }
        maxObserved = Math.max(maxObserved, v0, v1, v2);
        regions[regName] = {
          n: Math.max(1, Math.round(parseNumeric(entry.n, 50))),
          values: [v0, v1, v2]
        };
      }
    }

    if (Object.keys(regions).length === 0) {
      Object.assign(regions, base.riskLimits.regions);
    } else if (!regions.Global) {
      const firstKey = Object.keys(regions)[0];
      regions.Global = { ...regions[firstKey] };
    }

    out.riskLimits = {
      maxAll: Math.max(maxObserved, Math.round(parseNumeric(rl.maxAll, maxObserved))),
      labels,
      colors,
      regions
    };
  }

  // 7. Section 05: regulationLine & regulationEvents
  if (Array.isArray(raw.regulationLine) && raw.regulationLine.length >= 2) {
    out.regulationLine = raw.regulationLine
      .map((pt, idx) => ({
        year: Math.round(parseNumeric(pt.year, 2021 + idx)),
        value: Math.min(100, Math.max(0, Math.round(parseNumeric(pt.value, 25))))
      }))
      .sort((a, b) => a.year - b.year);
  }
  if (Array.isArray(raw.regulationEvents) && raw.regulationEvents.length > 0) {
    out.regulationEvents = raw.regulationEvents.map((ev, idx) => ({
      id: String(ev.id || `event-${idx + 1}`),
      pos: parseNumeric(ev.pos, 2021.5 + idx * 0.6),
      date: String(ev.date || '2024'),
      short: String(ev.short || `Milestone ${idx + 1}`),
      title: String(ev.title || `Milestone ${idx + 1}`),
      summary: String(ev.summary || 'Milestone annotation description.'),
      why: String(ev.why || 'Key inflection takeaway.')
    }));
  }

  // 8. Section 06: volume
  if (raw.volume && typeof raw.volume === 'object') {
    const series =
      Array.isArray(raw.volume.series) && raw.volume.series.length > 0
        ? raw.volume.series.map((s, idx) => ({
            key: String(s.key || `s${idx}`),
            label: String(s.label || `Series ${idx + 1}`),
            color: String(s.color || SERIES_COLORS[idx % SERIES_COLORS.length])
          }))
        : base.volume.series;

    const years =
      Array.isArray(raw.volume.years) && raw.volume.years.length > 0
        ? raw.volume.years.map((yr, idx) => {
            const yearStr = String(yr.year || `${2019 + idx}`);
            const est = Boolean(yr.est || yearStr.toLowerCase().endsWith('e'));
            const rec: Record<string, string | number | boolean> = {
              year: yearStr,
              loans: 0,
              green: 0,
              scf: 0,
              trans: 0,
              total: 0,
              est
            };
            let calcTotal = 0;
            series.forEach(s => {
              const v = Math.max(0, Math.round(parseNumeric(yr[s.key], 0)));
              rec[s.key] = v;
              calcTotal += v;
            });
            rec.total = calcTotal;
            return rec as FolioData['volume']['years'][number];
          })
        : base.volume.years;

    out.volume = { series, years };
  }

  // 9. Section 07: exposure (Heatmap)
  if (raw.exposure && typeof raw.exposure === 'object') {
    const cols =
      Array.isArray(raw.exposure.cols) && raw.exposure.cols.length >= 2
        ? raw.exposure.cols.map(String)
        : base.exposure.cols;
    const rows =
      Array.isArray(raw.exposure.rows) && raw.exposure.rows.length > 0
        ? raw.exposure.rows.map((r, rIdx) => {
            const rawVals = Array.isArray(r.vals) ? r.vals : [];
            const vals = cols.map((_, cIdx) =>
              Math.min(100, Math.max(0, Math.round(parseNumeric(rawVals[cIdx], 25))))
            );
            return {
              sector: String(r.sector || `Category ${rIdx + 1}`),
              vals
            };
          })
        : base.exposure.rows;
    out.exposure = { cols, rows };
  }

  // 10. Section 08A: waffle
  if (raw.waffle && typeof raw.waffle === 'object') {
    const waffleOut: FolioData['waffle'] = {};
    for (const [seg, split] of Object.entries(raw.waffle)) {
      if (!split || typeof split !== 'object') continue;
      let verified = Math.round(parseNumeric(split.verified, 25));
      let estimated = Math.round(parseNumeric(split.estimated, 40));
      let none = Math.round(parseNumeric(split.none, 35));
      if (verified + estimated + none !== 100) {
        issues.push({
          severity: 'warning',
          section: '08 Sentiment',
          path: `waffle.${seg}`,
          message: `Waffle segment "${seg}" summed to ${verified + estimated + none}% instead of 100%.`,
          autoFixed: autoFix
        });
        if (autoFix) {
          [verified, estimated, none] = normalizePercentagesTo100([verified, estimated, none]);
        }
      }
      waffleOut[seg] = { verified, estimated, none };
    }
    if (Object.keys(waffleOut).length > 0) {
      if (!waffleOut.All) {
        const first = Object.values(waffleOut)[0];
        waffleOut.All = { ...first };
      }
      out.waffle = waffleOut;
    }
  }

  // 11. Section 08B: likert
  if (Array.isArray(raw.likert) && raw.likert.length > 0) {
    out.likert = raw.likert.map((item, idx) => {
      const rawV = Array.isArray(item.vals) ? item.vals : [10, 15, 25, 30, 20];
      let v = [0, 1, 2, 3, 4].map(i => Math.round(parseNumeric(rawV[i], 20)));
      const sum = v.reduce((a, b) => a + b, 0);
      if (sum !== 100) {
        issues.push({
          severity: 'warning',
          section: '08 Sentiment',
          path: `likert[${idx}]`,
          message: `Likert statement #${idx + 1} responses summed to ${sum}% instead of 100%.`,
          autoFixed: autoFix
        });
        if (autoFix) v = normalizePercentagesTo100(v);
      }
      return {
        id: idx + 1,
        text: String(item.text || `Survey statement ${idx + 1}`),
        vals: [v[0], v[1], v[2], v[3], v[4]]
      };
    });
  }

  // 12. Section 09: pricing (Scatter + OLS)
  if (raw.pricing && typeof raw.pricing === 'object') {
    const shapes: FolioData['pricing']['sectors'][number]['shape'][] = [
      'circle',
      'square',
      'triangle',
      'diamond',
      'hollow'
    ];
    const deals =
      Array.isArray(raw.pricing.deals) && raw.pricing.deals.length >= 2
        ? raw.pricing.deals.map((d, idx) => ({
            id: idx + 1,
            sector: String(d.sector || 'General'),
            score: Math.min(100, Math.max(0, Math.round(parseNumeric(d.score, 50)))),
            bps: Math.max(1, Math.round(parseNumeric(d.bps, 150)))
          }))
        : base.pricing.deals;

    const uniqueSectors = Array.from(new Set(deals.map(d => d.sector)));
    const sectors =
      Array.isArray(raw.pricing.sectors) && raw.pricing.sectors.length > 0
        ? raw.pricing.sectors
        : uniqueSectors.map((name, idx) => ({
            name,
            color: idx === 4 ? 'var(--ink-3)' : SERIES_COLORS[idx % SERIES_COLORS.length],
            shape: shapes[idx % shapes.length]
          }));

    out.pricing = { sectors, deals };
  }

  // 13. Section 10A: outlookBars
  if (raw.outlookBars && typeof raw.outlookBars === 'object') {
    const ob = raw.outlookBars;
    const rawV = Array.isArray(ob.values) ? ob.values : [41, 47, 12];
    let v0 = Math.round(parseNumeric(rawV[0], 41));
    let v1 = Math.round(parseNumeric(rawV[1], 47));
    let v2 = Math.round(parseNumeric(rawV[2], 12));
    if (v0 + v1 + v2 !== 100 && autoFix) {
      [v0, v1, v2] = normalizePercentagesTo100([v0, v1, v2]);
    }
    const maxV = Math.max(50, v0, v1, v2);
    out.outlookBars = {
      maxAll: Math.max(maxV, Math.round(parseNumeric(ob.maxAll, maxV))),
      labels:
        Array.isArray(ob.labels) && ob.labels.length >= 3
          ? [String(ob.labels[0]), String(ob.labels[1]), String(ob.labels[2])]
          : base.outlookBars.labels,
      colors:
        Array.isArray(ob.colors) && ob.colors.length >= 3
          ? [String(ob.colors[0]), String(ob.colors[1]), String(ob.colors[2])]
          : base.outlookBars.colors,
      values: [v0, v1, v2]
    };
  }

  // 14. Section 10B: markets
  if (Array.isArray(raw.markets) && raw.markets.length > 0) {
    out.markets = raw.markets.map((m, idx) => {
      const share = Number(parseNumeric(m.share, 15).toFixed(1));
      const delta = Number(parseNumeric(m.delta, 3.5).toFixed(1));
      let trend = Array.isArray(m.trend)
        ? m.trend.map(v => Number(parseNumeric(v, 10).toFixed(1)))
        : [];
      if (trend.length < 2) {
        const start = Math.max(0.5, Number((share - delta * 2.4).toFixed(1)));
        trend = [0, 1, 2, 3, 4, 5].map(step =>
          Number((start + ((share - start) * step) / 5).toFixed(1))
        );
      }
      return {
        market: String(m.market || `Market ${idx + 1}`),
        region: String(m.region || 'Global'),
        n: Math.max(1, Math.round(parseNumeric(m.n, 15))),
        policy: Math.min(100, Math.max(0, Math.round(parseNumeric(m.policy, 70)))),
        share,
        bps: Math.round(parseNumeric(m.bps, 10)),
        delta,
        trend
      };
    });
  }

  const hasUnfixedErrors = issues.some(i => i.severity === 'error' && !i.autoFixed);

  return {
    data: out,
    validation: {
      valid: !hasUnfixedErrors,
      issues,
      stats: {
        totalRecords: out.heroMatrix.total,
        marketCount: out.markets.length,
        regionCount: out.sampleRegion.length,
        sectionCount: out.sections.length
      }
    }
  };
}
