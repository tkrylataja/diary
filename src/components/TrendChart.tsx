import { formatDateLong, formatMonthYear, formatNumber } from '../lib/format';
import type { Status } from '../data/status';
import { useElementWidth } from '../hooks/useElementWidth';
import { bandSpans, dateToTime, isYearScale, timeDomain, timeTicks, yTicks } from './chartMath';
import styles from './TrendChart.module.css';

export type ChartPoint = {
  date: string;
  value: number;
  refLow?: number;
  refHigh?: number;
  status: Status;
};

type Props = { name: string; unit: string | undefined; points: ChartPoint[] };

const MARGIN = { top: 28, right: 14, bottom: 30, left: 44 };
const STATUS_WORDS: Partial<Record<Status, string>> = {
  high: 'вище норми',
  low: 'нижче норми',
};

/**
 * Графік динаміки (SPEC §6.4): рівномірна вісь часу, Y від нуля, лінія по точках,
 * точки в нормі — кола, поза нормою — ромби; референсна смуга окремо для кожної точки.
 */
export function TrendChart({ name, unit, points }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const height = width >= 560 ? 300 : 240;

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
        </ul>
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
  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const top = MARGIN.top;
  const bottom = height - MARGIN.bottom;

  const domain = timeDomain(points.map((p) => dateToTime(p.date)));
  const yearly = isYearScale(domain);
  const xTicks = timeTicks(domain, Math.max(2, Math.floor((right - left) / (yearly ? 48 : 72))));
  const maxValue = Math.max(...points.map((p) => Math.max(p.value, p.refHigh ?? 0)));
  const ticks = yTicks(maxValue * 1.08);
  const yMax = ticks[ticks.length - 1] ?? 1;

  const x = (date: string) =>
    left + ((dateToTime(date) - domain[0]) / (domain[1] - domain[0])) * (right - left);
  const y = (v: number) => bottom - (Math.min(v, yMax) / yMax) * (bottom - top);

  const xs = points.map((p) => x(p.date));
  const spans = bandSpans(xs, left, right);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs[i]} ${y(p.value)}`).join(' ');

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={styles.svg}
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
        const cy = y(p.value);
        if (p.status === 'high' || p.status === 'low') {
          const r = 7;
          return (
            <path
              key={`pt-${i}`}
              d={`M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`}
              className={p.status === 'high' ? styles.pointHigh : styles.pointLow}
            />
          );
        }
        return <circle key={`pt-${i}`} cx={cx} cy={cy} r={5.5} className={styles.pointNormal} />;
      })}
    </svg>
  );
}
