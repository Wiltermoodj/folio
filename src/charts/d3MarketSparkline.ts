import * as d3 from 'd3';
import type { MarketRecord } from '../types/folio';

export interface SparklineTooltipPayload {
  cat: string;
  val: string;
  sub: string;
}

export interface SparklineTooltipController {
  show: (owner: Element | null, data: SparklineTooltipPayload, pointerEvent?: PointerEvent | MouseEvent) => void;
  hide: () => void;
}

export interface D3SparklinePoint {
  year: number;
  index: number;
  value: number;
  prevValue: number | null;
  yoyDelta: number | null;
  cagrFromStart: number;
}

export interface D3SparklineOptions {
  years?: number[];
  globalMax?: number;
  width?: number;
  height?: number;
  metricLabel?: string;
  tooltipController?: SparklineTooltipController | null;
}

const DEFAULT_YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

let sparklineGradientCounter = 0;

/**
 * Generates an interactive, high-fidelity D3 SVG sparkline for a MarketRecord row
 * in Section 10B ('Market Table'), complete with:
 * - Monotone cubic interpolation (`d3.line` + `d3.area` with `d3.curveMonotoneX`)
 * - Theme-aware area gradient, min/max reference band, and average dashed reference line
 * - Discrete historical data point vertices (2021–2026) with peak/latest emphasis
 * - Mouse-over / pointer bisecting crosshair, active node halo, live inline year readout pill,
 *   and synchronized floating tooltip with YoY delta & multi-year CAGR
 * - Full keyboard navigation (Left/Right arrow keys to scrub historical years)
 */
export function createD3MarketSparkline(
  record: MarketRecord,
  options: D3SparklineOptions = {}
): HTMLElement {
  const rawTrend = Array.isArray(record.trend) && record.trend.length > 0 ? record.trend : [0, 0, 0, 0, 0, 0];
  const years =
    options.years && options.years.length === rawTrend.length
      ? options.years
      : rawTrend.map((_, idx) => DEFAULT_YEARS[idx] ?? 2021 + idx);

  const width = options.width ?? 168;
  const height = options.height ?? 40;
  const padLeft = 6;
  const padRight = 8;
  const padTop = 6;
  const padBottom = 6;

  const points: D3SparklinePoint[] = rawTrend.map((val, idx) => {
    const cleanVal = Number.isFinite(val) ? Number(val) : 0;
    const prev = idx > 0 && Number.isFinite(rawTrend[idx - 1]) ? Number(rawTrend[idx - 1]) : null;
    const yoyDelta = prev !== null ? Number((cleanVal - prev).toFixed(1)) : null;
    const startVal = Number.isFinite(rawTrend[0]) && rawTrend[0] > 0 ? Number(rawTrend[0]) : 1;
    const elapsed = Math.max(1, idx);
    const cagrFromStart =
      idx > 0 && cleanVal > 0 && startVal > 0
        ? Number(((Math.pow(cleanVal / startVal, 1 / elapsed) - 1) * 100).toFixed(1))
        : 0;
    return {
      year: years[idx],
      index: idx,
      value: cleanVal,
      prevValue: prev,
      yoyDelta,
      cagrFromStart
    };
  });

  const values = points.map(p => p.value);
  const localMin = d3.min(values) ?? 0;
  const localMax = d3.max(values) ?? 25;
  const meanVal = d3.mean(values) ?? 0;
  const domainMin = 0;
  const domainMax = Math.max(options.globalMax ?? 26, localMax * 1.12, 10);

  const xScale = d3
    .scaleLinear()
    .domain([0, Math.max(1, points.length - 1)])
    .range([padLeft, width - padRight]);

  const yScale = d3
    .scaleLinear()
    .domain([domainMin, domainMax])
    .range([height - padBottom, padTop])
    .clamp(true);

  // Determine peak index and start/end indices
  let peakIndex = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].value >= points[peakIndex].value) {
      peakIndex = i;
    }
  }
  const lastIndex = points.length - 1;
  const firstPoint = points[0];
  const lastPoint = points[lastIndex];
  const totalChangePp = Number((lastPoint.value - firstPoint.value).toFixed(1));

  // Container element holding SVG + compact live readout badge
  const wrapper = document.createElement('div');
  wrapper.className = 'd3-sparkline-cell';
  wrapper.setAttribute('tabindex', '0');
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute(
    'aria-label',
    `${record.market} historical trend (${firstPoint.year}–${lastPoint.year}): ${points
      .map(p => `${p.year}: ${p.value.toFixed(1)}%`)
      .join(', ')}. Use Left and Right arrow keys or hover to inspect yearly data points.`
  );

  const headerBar = document.createElement('div');
  headerBar.className = 'd3-sparkline-meta';

  const rangeSpan = document.createElement('span');
  rangeSpan.className = 'd3-sparkline-range num';
  rangeSpan.textContent = `${firstPoint.value.toFixed(1)}% → ${lastPoint.value.toFixed(1)}%`;

  const activePill = document.createElement('span');
  activePill.className = 'd3-sparkline-readout num';
  activePill.textContent = `${lastPoint.year}: ${lastPoint.value.toFixed(1)}%`;

  headerBar.appendChild(rangeSpan);
  headerBar.appendChild(activePill);

  const svgHost = document.createElement('div');
  svgHost.className = 'd3-sparkline-svg-wrap';

  sparklineGradientCounter += 1;
  const gradId = `d3-spark-grad-${sparklineGradientCounter}`;
  const clipId = `d3-spark-clip-${sparklineGradientCounter}`;

  const svgSelection = d3
    .select(svgHost)
    .append('svg')
    .attr('class', 'd3-sparkline-svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('aria-hidden', 'true')
    .style('display', 'block')
    .style('overflow', 'visible');

  const defs = svgSelection.append('defs');
  const gradient = defs
    .append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');

  gradient
    .append('stop')
    .attr('offset', '0%')
    .attr('stop-color', 'var(--violet)')
    .attr('stop-opacity', 0.28);

  gradient
    .append('stop')
    .attr('offset', '100%')
    .attr('stop-color', 'var(--violet)')
    .attr('stop-opacity', 0.02);

  defs
    .append('clipPath')
    .attr('id', clipId)
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height);

  // Subtle historical min–max envelope band
  svgSelection
    .append('rect')
    .attr('class', 'd3-sparkline-band')
    .attr('x', padLeft)
    .attr('y', yScale(localMax))
    .attr('width', Math.max(0, width - padLeft - padRight))
    .attr('height', Math.max(1, yScale(localMin) - yScale(localMax)))
    .attr('fill', 'var(--neutral-data)')
    .attr('opacity', 0.32)
    .attr('rx', 1);

  // Mean reference line (dashed)
  svgSelection
    .append('line')
    .attr('class', 'd3-sparkline-mean')
    .attr('x1', padLeft)
    .attr('x2', width - padRight)
    .attr('y1', yScale(meanVal))
    .attr('y2', yScale(meanVal))
    .attr('stroke', 'var(--rule)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '2,2');

  // D3 Area generator with smooth monotone X interpolation
  const areaGenerator = d3
    .area<D3SparklinePoint>()
    .x(d => xScale(d.index))
    .y0(height - padBottom)
    .y1(d => yScale(d.value))
    .curve(d3.curveMonotoneX);

  // D3 Line generator with smooth monotone X interpolation
  const lineGenerator = d3
    .line<D3SparklinePoint>()
    .x(d => xScale(d.index))
    .y(d => yScale(d.value))
    .curve(d3.curveMonotoneX);

  const areaPath = svgSelection
    .append('path')
    .datum(points)
    .attr('class', 'd3-sparkline-area')
    .attr('fill', `url(#${gradId})`)
    .attr('d', areaGenerator);

  const linePath = svgSelection
    .append('path')
    .datum(points)
    .attr('class', 'd3-sparkline-line')
    .attr('fill', 'none')
    .attr('stroke', 'var(--violet)')
    .attr('stroke-width', 1.75)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('d', lineGenerator);

  const lineNode = linePath.node();
  if (lineNode && typeof lineNode.getTotalLength === 'function') {
    const totalLen = Math.max(1, lineNode.getTotalLength());
    linePath
      .style('--spark-len', `${totalLen}`)
      .style('stroke-dasharray', `${totalLen}`)
      .style('stroke-dashoffset', '0');
  }

  // Vertical crosshair line (shown on hover / focus)
  const crosshairLine = svgSelection
    .append('line')
    .attr('class', 'd3-sparkline-crosshair')
    .attr('y1', 2)
    .attr('y2', height - 2)
    .attr('stroke', 'var(--vermilion)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '2,2')
    .style('opacity', 0)
    .style('pointer-events', 'none');

  // Horizontal value guide line (shown on hover / focus)
  const horizGuideLine = svgSelection
    .append('line')
    .attr('class', 'd3-sparkline-hguide')
    .attr('x1', padLeft)
    .attr('x2', width - padRight)
    .attr('stroke', 'var(--vermilion)')
    .attr('stroke-width', 0.75)
    .attr('stroke-dasharray', '1.5,2.5')
    .style('opacity', 0)
    .style('pointer-events', 'none');

  // Historical data point dots for every year
  const dotsGroup = svgSelection.append('g').attr('class', 'd3-sparkline-dots');

  const dotNodes = dotsGroup
    .selectAll<SVGCircleElement, D3SparklinePoint>('circle.d3-sparkline-dot')
    .data(points)
    .enter()
    .append('circle')
    .attr('class', d =>
      `d3-sparkline-dot ${d.index === lastIndex ? 'is-latest' : ''} ${d.index === peakIndex ? 'is-peak' : ''}`.trim()
    )
    .attr('cx', d => xScale(d.index))
    .attr('cy', d => yScale(d.value))
    .attr('r', d => (d.index === lastIndex ? 2.8 : d.index === 0 ? 2.1 : 1.7))
    .attr('fill', d => (d.index === lastIndex ? 'var(--violet)' : 'var(--paper)'))
    .attr('stroke', 'var(--violet)')
    .attr('stroke-width', d => (d.index === lastIndex ? 1.5 : 1.25));

  // Outer halo & active hover marker
  const activeHalo = svgSelection
    .append('circle')
    .attr('class', 'd3-sparkline-halo')
    .attr('r', 6)
    .attr('fill', 'var(--vermilion)')
    .attr('opacity', 0)
    .style('pointer-events', 'none');

  const activeMarker = svgSelection
    .append('circle')
    .attr('class', 'd3-sparkline-active-dot')
    .attr('r', 3.4)
    .attr('fill', 'var(--paper)')
    .attr('stroke', 'var(--vermilion)')
    .attr('stroke-width', 2)
    .attr('opacity', 0)
    .style('pointer-events', 'none');

  let activeIndex: number | null = null;
  let activePayload: SparklineTooltipPayload | null = null;

  function formatTooltipPayload(pt: D3SparklinePoint): SparklineTooltipPayload {
    const yoyText =
      pt.yoyDelta !== null
        ? `${pt.yoyDelta >= 0 ? '+' : ''}${pt.yoyDelta.toFixed(1)} pp YoY vs ${pt.year - 1}`
        : `Baseline year (${firstPoint.year})`;

    const rankAmongYears =
      [...points].sort((a, b) => b.value - a.value).findIndex(x => x.year === pt.year) + 1;

    const historyStrip = points
      .map(p => (p.year === pt.year ? `[${String(p.year).slice(-2)}:${p.value.toFixed(1)}%]` : `${String(p.year).slice(-2)}:${p.value.toFixed(1)}%`))
      .join(' · ');

    return {
      cat: `${record.market} · ${record.region} · ${pt.year}`,
      val: `${pt.value.toFixed(1)} % adoption (${yoyText})`,
      sub: `6-yr Δ +${totalChangePp.toFixed(1)} pp (avg ${meanVal.toFixed(1)}%, yr rank #${rankAmongYears}/6) · ${historyStrip}`
    };
  }

  function highlightPoint(idx: number, pointerEvent?: PointerEvent | MouseEvent) {
    const clampedIdx = Math.max(0, Math.min(points.length - 1, idx));
    const pt = points[clampedIdx];

    if (activeIndex !== clampedIdx || !activePayload) {
      activeIndex = clampedIdx;
      activePayload = formatTooltipPayload(pt);
      const cx = xScale(pt.index);
      const cy = yScale(pt.value);

      wrapper.classList.add('is-active');
      crosshairLine.attr('x1', cx).attr('x2', cx).style('opacity', 0.85);
      horizGuideLine.attr('y1', cy).attr('y2', cy).style('opacity', 0.55);

      activeHalo.attr('cx', cx).attr('cy', cy).attr('opacity', 0.22);
      activeMarker.attr('cx', cx).attr('cy', cy).attr('opacity', 1);

      dotNodes
        .attr('r', d => (d.index === clampedIdx ? 3.2 : d.index === lastIndex ? 2.4 : 1.7))
        .attr('fill', d =>
          d.index === clampedIdx
            ? 'var(--vermilion)'
            : d.index === lastIndex
              ? 'var(--violet)'
              : 'var(--paper)'
        );

      const deltaSign = pt.yoyDelta !== null ? (pt.yoyDelta >= 0 ? `+${pt.yoyDelta.toFixed(1)}` : pt.yoyDelta.toFixed(1)) : 'base';
      activePill.textContent = `${pt.year}: ${pt.value.toFixed(1)}% (${deltaSign})`;
      activePill.classList.add('is-scrubbing');
    }

    const tt = options.tooltipController ?? window.FolioApp?.getTooltipController?.();
    if (tt && activePayload) {
      tt.show(wrapper, activePayload, pointerEvent);
    }
  }

  function clearHighlight() {
    activeIndex = null;
    activePayload = null;
    wrapper.classList.remove('is-active');
    crosshairLine.style('opacity', 0);
    horizGuideLine.style('opacity', 0);
    activeHalo.attr('opacity', 0);
    activeMarker.attr('opacity', 0);

    dotNodes
      .attr('r', d => (d.index === lastIndex ? 2.8 : d.index === 0 ? 2.1 : 1.7))
      .attr('fill', d => (d.index === lastIndex ? 'var(--violet)' : 'var(--paper)'));

    activePill.textContent = `${lastPoint.year}: ${lastPoint.value.toFixed(1)}%`;
    activePill.classList.remove('is-scrubbing');

    const tt = options.tooltipController ?? window.FolioApp?.getTooltipController?.();
    if (tt) {
      tt.hide();
    }
  }

  // Interactive transparent overlay utilizing d3.pointer & nearest-index bisection
  svgSelection
    .append('rect')
    .attr('class', 'd3-sparkline-overlay')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('pointerenter pointermove', function (event: PointerEvent) {
      const [mx] = d3.pointer(event, this);
      const rawIdx = xScale.invert(mx);
      const nearestIdx = Math.round(Math.max(0, Math.min(points.length - 1, rawIdx)));
      highlightPoint(nearestIdx, event);
    })
    .on('pointerleave', () => {
      clearHighlight();
    });

  // Keyboard accessibility: focus shows latest point, Left/Right arrows scrub historical years
  wrapper.addEventListener('focus', () => {
    highlightPoint(activeIndex ?? lastIndex);
  });

  wrapper.addEventListener('blur', () => {
    clearHighlight();
  });

  wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const current = activeIndex ?? lastIndex;
      highlightPoint(Math.max(0, current - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const current = activeIndex ?? 0;
      highlightPoint(Math.min(lastIndex, current + 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      highlightPoint(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      highlightPoint(lastIndex);
    } else if (e.key === 'Escape') {
      clearHighlight();
    }
  });

  wrapper.appendChild(svgHost);
  wrapper.appendChild(headerBar);

  return wrapper;
}
