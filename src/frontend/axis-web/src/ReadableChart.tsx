import { type CSSProperties, useMemo, useState } from 'react';

export type ReadableChartDatum = {
  id: string;
  label: string;
  values: Record<string, number | null | undefined>;
  detail?: string;
};

export type ReadableChartSeries = {
  key: string;
  label: string;
  color: string;
};

export type ReadableChartReference = {
  label: string;
  value: number;
  color?: string;
};

type Props = {
  data: ReadableChartDatum[];
  series: ReadableChartSeries[];
  mode?: 'line' | 'bars';
  references?: ReadableChartReference[];
  min?: number;
  max?: number;
  formatValue?: (value: number) => string;
  emptyText?: string;
  ariaLabel: string;
  onSelect?: (datum: ReadableChartDatum) => void;
};

const width = 1000;
const height = 320;
const plot = { left: 82, right: 976, top: 22, bottom: 262 };

export function ReadableChart({
  data,
  series,
  mode = 'line',
  references = [],
  min,
  max,
  formatValue = (value) => Number(value.toFixed(2)).toLocaleString(),
  emptyText = 'No data in this range.',
  ariaLabel,
  onSelect
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const chart = useMemo(() => {
    const values = data.flatMap((datum) => series.map((item) => datum.values[item.key])).filter((value): value is number => Number.isFinite(value));
    const referenceValues = references.map((item) => item.value).filter(Number.isFinite);
    const rawMin = min ?? Math.min(...values, ...referenceValues, 0);
    const rawMax = max ?? Math.max(...values, ...referenceValues, 1);
    const rawRange = Math.max(1, rawMax - rawMin);
    const lower = min ?? rawMin - rawRange * .08;
    const upper = max ?? rawMax + rawRange * .08;
    const range = Math.max(1e-9, upper - lower);
    const x = (index: number) => data.length <= 1 ? (plot.left + plot.right) / 2 : plot.left + index / (data.length - 1) * (plot.right - plot.left);
    const y = (value: number) => plot.bottom - (value - lower) / range * (plot.bottom - plot.top);
    const ticks = Array.from({ length: 5 }, (_, index) => upper - index / 4 * range);
    return { lower, upper, x, y, ticks };
  }, [data, series, references, min, max]);

  if (!data.length || !data.some((datum) => series.some((item) => Number.isFinite(datum.values[item.key])))) {
    return <div className="readable-chart empty"><span>{emptyText}</span></div>;
  }

  const labelIndexes = new Set(Array.from({ length: Math.min(5, data.length) }, (_, index) => Math.round(index * (data.length - 1) / Math.max(1, Math.min(5, data.length) - 1))));
  const active = hovered === null ? null : data[hovered];
  const barBand = (plot.right - plot.left) / Math.max(1, data.length);
  const barWidth = Math.max(3, Math.min(24, barBand * .7 / Math.max(1, series.length)));

  return (
    <div className="readable-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id="axis-chart-surface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart-fill-top)" />
            <stop offset="1" stopColor="var(--chart-fill-bottom)" />
          </linearGradient>
          <filter id="axis-chart-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect className="readable-chart-surface" x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} />
        {chart.ticks.map((tick) => (
          <g key={tick} className="readable-chart-grid">
            <line x1={plot.left} x2={plot.right} y1={chart.y(tick)} y2={chart.y(tick)} />
            <text x={plot.left - 14} y={chart.y(tick) + 5} textAnchor="end">{formatValue(tick)}</text>
          </g>
        ))}
        {references.map((reference) => (
          <g key={`${reference.label}-${reference.value}`} className="readable-chart-reference" style={{ '--reference-color': reference.color ?? '#f5c451' } as CSSProperties}>
            <line x1={plot.left} x2={plot.right} y1={chart.y(reference.value)} y2={chart.y(reference.value)} />
            <text x={plot.right - 8} y={Math.max(plot.top + 14, chart.y(reference.value) - 8)} textAnchor="end">{reference.label} · {formatValue(reference.value)}</text>
          </g>
        ))}
        {mode === 'line' && series.map((item) => {
          const segments: string[] = [];
          let started = false;
          data.forEach((datum, index) => {
            const value = datum.values[item.key];
            if (!Number.isFinite(value)) { started = false; return; }
            segments.push(`${started ? 'L' : 'M'} ${chart.x(index)} ${chart.y(value as number)}`);
            started = true;
          });
          return <path key={item.key} className="readable-chart-line" style={{ '--series-color': item.color } as CSSProperties} d={segments.join(' ')} />;
        })}
        {mode === 'bars' && data.flatMap((datum, index) => series.map((item, seriesIndex) => {
          const value = datum.values[item.key];
          if (!Number.isFinite(value)) return null;
          const zeroY = chart.y(Math.max(chart.lower, Math.min(chart.upper, 0)));
          const valueY = chart.y(value as number);
          const centerOffset = (seriesIndex - (series.length - 1) / 2) * barWidth;
          return <rect key={`${datum.id}-${item.key}`} className="readable-chart-bar" style={{ '--series-color': item.color } as CSSProperties} x={chart.x(index) + centerOffset - barWidth * .42} y={Math.min(valueY, zeroY)} width={barWidth * .84} height={Math.max(2, Math.abs(zeroY - valueY))} rx="3" />;
        }))}
        {data.map((datum, index) => (
          <g key={datum.id} className={`readable-chart-hit ${hovered === index ? 'active' : ''}`} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} onClick={() => onSelect?.(datum)} tabIndex={onSelect ? 0 : -1} role={onSelect ? 'button' : undefined}>
            <rect x={chart.x(index) - Math.max(8, barBand / 2)} y={plot.top} width={Math.max(16, barBand)} height={plot.bottom - plot.top} />
            {mode === 'line' && series.map((item) => {
              const value = datum.values[item.key];
              return Number.isFinite(value) ? <circle key={item.key} style={{ '--series-color': item.color } as CSSProperties} cx={chart.x(index)} cy={chart.y(value as number)} r={hovered === index ? 7 : 4.5} /> : null;
            })}
            {labelIndexes.has(index) && <text className="readable-chart-x-label" x={chart.x(index)} y={294} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}>{datum.label}</text>}
          </g>
        ))}
        {hovered !== null && <line className="readable-chart-crosshair" x1={chart.x(hovered)} x2={chart.x(hovered)} y1={plot.top} y2={plot.bottom} />}
      </svg>
      <div className="readable-chart-legend" aria-label="Chart legend">
        {series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}
        {references.map((item) => <span key={item.label}><i className="reference" style={{ background: item.color ?? '#f5c451' }} />{item.label}</span>)}
      </div>
      {active && <div className="readable-chart-tooltip"><strong>{active.label}</strong>{series.map((item) => Number.isFinite(active.values[item.key]) && <span key={item.key}><i style={{ background: item.color }} />{item.label}<b>{formatValue(active.values[item.key] as number)}</b></span>)}{active.detail && <small>{active.detail}</small>}</div>}
    </div>
  );
}
