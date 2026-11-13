import { useState } from 'react';
import type { Status } from '../data/status';
import { useElementWidth } from '../hooks/useElementWidth';
import { formatDateLong, formatMonthYear, formatNumber } from '../lib/format';
import {
  bandSpans,
  dateToTime,
  isYearScale,
  labelPlacements,
  monthTicks,
  timeDomain,
  timeTicks,
  yTicks,
} from './chartMath';
import styles from './TrendChart.module.css';

export type ChartPoint = {
  date: string;
  value: number;
  refLow?: number;
  refHigh?: number;
  status: Status;
  /** Значення з бланка, якщо точку перераховано з інших одиниць (напр. «656,4 mIU/L»). */
  original?: string;
  /** Як показник підписаний у бланку, якщо відрізняється від основної назви. */
  nameOriginal?: string;
};

type Props = { name: string; unit: string | undefined; points: ChartPoint[] };

const MARGIN = { top: 34, right: 16, bottom: 30, left: 44 };
const STATUS_WORDS: Partial<Record<Status, string>> = {
  high: 'вище норми',
  low: 'нижче норми',
};
const LABEL_CHAR_WIDTH = 7;

/**
 * Графік динаміки (SPEC §6.4): рівномірна вісь часу з поділками місяців, Y від нуля,
 * лінія по точках зі значеннями над ними; точки в нормі — кола, поза нормою — ромби;
 * перераховані з інших одиниць — порожні всередині. Дотик або наведення показує дату.
 */
export function TrendChart({ name, unit, points }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const height = width >= 560 ? 320 : 260;
  const hasConverted = points.some((p) => p.original);

  const label =
    `Графік: ${name}${unit ? `, ${unit}` : ''}. ` +
    points
      .map((p) => {
        const words = STATUS_WORDS[p.status];
        return `${formatDateLong(p.date)}: ${formatNumber(p.value)}${words ? ` (${words})` : ''}`;
      })
      .join('; ');

  return (
    <figure className={styles.figure}>
      <div ref={ref} className={styles.canvas}>
        {width > 0 && (
          <Plot width={width} height={height} points={points} unit={unit} label={label} />
        )}
      </div>
      <figcaption>
        <ul className={styles.legend}>
          <li>
            <svg width="16" height="16" aria-hidden>
              <circle cx="8" cy="8" r="5" className={styles.pointNormal} />
            </svg>
            в нормі
          </li>
          <li>
            <svg width="16" height="16" aria-hidden>
              <path d="M8 1 L15 8 L8 15 L1 8 Z" className={styles.pointHigh} />
            </svg>
            <svg width="16" height="16" aria-hidden>
              <path d="M8 1 L15 8 L8 15 L1 8 Z" className={styles.pointLow} />
            </svg>
            поза нормою
          </li>
          <li>
            <svg width="22" height="14" aria-hidden>
              <rect x="0" y="1" width="22" height="12" rx="3" className={styles.band} />
            </svg>
            референс (норма)
          </li>
          {hasConverted && (
            <li>
              <svg width="16" height="16" aria-hidden>
                <circle cx="8" cy="8" r="5" className={`${styles.pointNormal} ${styles.hollow}`} />
              </svg>
              перераховано з інших одиниць
            </li>
          )}
        </ul>
        <p className={styles.hint} data-print="hide">
          Торкніться точки, щоб побачити дату.
        </p>
      </figcaption>
    </figure>
  );
}

function Plot({
  width,
  height,
  points,
  unit,
  label,
}: {
  width: number;
  height: number;
  points: ChartPoint[];
  unit: string | undefined;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const top = MARGIN.top;
  const bottom = height - MARGIN.bottom;

  const domain = timeDomain(points.map((p) => dateToTime(p.date)));
  const yearly = isYearScale(domain);
  const xTicks = timeTicks(domain, Math.max(2, Math.floor((right - left) / (yearly ? 48 : 72))));
  const minorTicks = monthTicks(domain, right - left);
  const maxValue = Math.max(...points.map((p) => Math.max(p.value, p.refHigh ?? 0)));
  const ticks = yTicks(maxValue * 1.08);
  const yMax = ticks[ticks.length - 1] ?? 1;

  const x = (date: string) =>
    left + ((dateToTime(date) - domain[0]) / (domain[1] - domain[0])) * (right - left);
  const y = (v: number) => bottom - (Math.min(v, yMax) / yMax) * (bottom - top);

  const xs = points.map((p) => x(p.date));
  const ys = points.map((p) => y(p.value));
  const texts = points.map((p) => formatNumber(p.value));
  const placements = labelPlacements(
    points.map((_, i) => ({
      x: xs[i] ?? 0,
      y: ys[i] ?? 0,
      width: (texts[i]?.length ?? 0) * LABEL_CHAR_WIDTH,
    })),
  );
  const spans = bandSpans(xs, left, right);
  const line = points.map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i]} ${ys[i]}`).join(' ');

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={styles.svg}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setActive(null);
      }}
    >
      {unit && (
        <text x={0} y={14} className={styles.unit}>
          {unit}
        </text>
      )}

      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={y(t)} y2={y(t)} className={styles.grid} />
          <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" className={styles.tick}>
            {formatNumber(t)}
          </text>
        </g>
      ))}

      {minorTicks.map((d) => (
        <line
          key={d}
          x1={x(d)}
          x2={x(d)}
          y1={bottom}
          y2={bottom + (d.endsWith('-01-01') ? 7 : 4)}
          className={styles.axisTick}
        />
      ))}

      {xTicks.map((d) => (
        <text key={d} x={x(d)} y={bottom + 20} textAnchor="middle" className={styles.tick}>
          {yearly ? d.slice(0, 4) : formatMonthYear(d)}
        </text>
      ))}

      {points.map((p, i) => {
        if (p.refLow === undefined && p.refHigh === undefined) return null;
        const span = spans[i];
        if (!span) return null;
        const yTop = y(p.refHigh ?? yMax);
        const yBottom = y(p.refLow ?? 0);
        return (
          <rect
            key={`band-${i}`}
            x={span.x0}
            width={Math.max(0, span.x1 - span.x0)}
            y={yTop}
            height={Math.max(0, yBottom - yTop)}
            className={styles.band}
          />
        );
      })}

      <path d={line} className={styles.line} />

      {points.map((p, i) => {
        const cx = xs[i] ?? 0;
        const cy = ys[i] ?? 0;
        const hollow = p.original ? ` ${styles.hollow}` : '';
        const out = p.status === 'high' || p.status === 'low';
        const markClass =
          (p.status === 'high'
            ? styles.pointHigh
            : p.status === 'low'
              ? styles.pointLow
              : styles.pointNormal) + hollow;
        const r = 7;
        return (
          <g key={`pt-${i}`}>
            {out ? (
              <path
                d={`M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`}
                className={markClass}
              />
            ) : (
              <circle cx={cx} cy={cy} r={5.5} className={markClass} />
            )}
            <text
              x={cx}
              y={placements[i] === 'above' ? cy - 12 : cy + 20}
              textAnchor="middle"
              className={out ? `${styles.valueLabel} ${styles.valueLabelOut}` : styles.valueLabel}
            >
              {texts[i]}
            </text>
            {/* Невидима велика ціль для дотику пальцем. */}
            <circle
              cx={cx}
              cy={cy}
              r={18}
              className={styles.hit}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') setActive(i);
              }}
              onClick={() => setActive(active === i ? null : i)}
            />
          </g>
        );
      })}

      {active !== null && points[active] && (
        <Tooltip
          point={points[active]}
          unit={unit}
          x={xs[active] ?? 0}
          y={ys[active] ?? 0}
          width={width}
        />
      )}
    </svg>
  );
}

function Tooltip({
  point,
  unit,
  x,
  y,
  width,
}: {
  point: ChartPoint;
  unit: string | undefined;
  x: number;
  y: number;
  width: number;
}) {
  const lines = [
    formatDateLong(point.date),
    `${formatNumber(point.value)}${unit ? ` ${unit}` : ''}`,
    ...(point.original ? [`у бланку: ${point.original}`] : []),
    ...(point.nameOriginal ? [`як в аналізі: ${point.nameOriginal}`] : []),
  ];
  const boxWidth = Math.max(...lines.map((l) => l.length)) * 7 + 20;
  const boxHeight = lines.length * 17 + 12;
  const bx = Math.min(Math.max(x - boxWidth / 2, 2), width - boxWidth - 2);
  // Над точкою, а якщо зверху не вміщається — під нею.
  const by = y - boxHeight - 14 >= 0 ? y - boxHeight - 14 : y + 14;
  return (
    <g className={styles.tooltip} pointerEvents="none">
      <rect x={bx} y={by} width={boxWidth} height={boxHeight} rx={10} />
      {lines.map((l, i) => (
        <text
          key={l}
          x={bx + 10}
          y={by + 20 + i * 17}
          className={i === 0 ? styles.tipTitle : undefined}
        >
          {l}
        </text>
      ))}
    </g>
  );
}
