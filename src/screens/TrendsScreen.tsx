import { ChartSpline, Info, Plus, SearchX, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { analyteKey, originalName } from '../data/analytes';
import { AnalytePicker } from '../components/AnalytePicker';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { PrintHeader } from '../components/PrintHeader';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusValue } from '../components/StatusValue';
import { TrendChart, type ChartPoint } from '../components/TrendChart';
import {
  PERIODS,
  analyteSeries,
  originalNamesOf,
  parsePeriod,
  periodStart,
  unitSummary,
} from '../data/selectors';
import { resultStatus } from '../data/status';
import type { Analyte } from '../data/types';
import { availableUnits, normSummary, sameUnit, showIn } from '../data/units';
import { formatDateLong, formatNumber, formatRef, formatValue, todayIso } from '../lib/format';
import { useDb } from '../state/dbContext';
import styles from './TrendsScreen.module.css';

/** Динаміка показника — екран для лікаря №2 (SPEC §6.3). */
export function TrendsScreen() {
  const { analyteId } = useParams();
  const { db } = useDb();
  const navigate = useNavigate();
  const analyte = db.analytes.find((a) => a.id === analyteId);

  const originals = analyte ? originalNamesOf(db, analyte) : [];
  // «Також» — синоніми без тих назв, що вже показані як «як в аналізах».
  const otherSynonyms = analyte
    ? analyte.synonyms.filter((s) => !originals.some((o) => analyteKey(o) === analyteKey(s)))
    : [];
  const namesLine = [
    originals.length > 0 ? `Як в аналізах: ${originals.join(' · ')}` : '',
    otherSynonyms.length > 0 ? `Також: ${otherSynonyms.join(' · ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  function select(a: Analyte) {
    navigate(`/trends/${encodeURIComponent(a.id)}`, { replace: analyteId !== undefined });
  }

  return (
    <Screen>
      <PrintHeader title={analyte?.name} details={namesLine || undefined} />
      <ScreenHeader
        title="Динаміка"
        pageTitle={analyte ? `Динаміка: ${analyte.name}` : undefined}
        print={analyte !== undefined}
      />

      {db.analytes.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Ще немає показників"
          text="Додайте перший аналіз, і тут з’явиться графік його значень за роки."
          action={<ButtonLink to="/add">Додати аналіз</ButtonLink>}
        />
      ) : (
        <>
          <div className={styles.picker} data-print="hide">
            <AnalytePicker
              label="Показник"
              analytes={db.analytes}
              value={analyte}
              onChange={select}
            />
            {analyte && namesLine && <p className={styles.synonyms}>{namesLine}</p>}
          </div>

          {analyte ? (
            <AnalyteTrend analyte={analyte} />
          ) : analyteId ? (
            <EmptyState
              icon={SearchX}
              title="Показник не знайдено"
              text="Можливо, його видалено або об’єднано з іншим. Оберіть показник зі списку."
            />
          ) : (
            <EmptyState
              icon={ChartSpline}
              title="Оберіть показник"
              text="Почніть вводити назву або синонім, наприклад «пролактин» чи «PRL»."
            />
          )}
        </>
      )}
    </Screen>
  );
}

function AnalyteTrend({ analyte }: { analyte: Analyte }) {
  const { db } = useDb();
  const [params, setParams] = useSearchParams();
  const period = parsePeriod(params.get('period'));

  const series = useMemo(() => analyteSeries(db, analyte.id), [db, analyte.id]);
  const units = useMemo(() => availableUnits(analyte, series), [analyte, series]);
  // Одиниці показу: обрані перемикачем, інакше основні показника, інакше найчастіші в записах.
  const requested = params.get('unit');
  const unit =
    units.find((u) => sameUnit(u, requested ?? undefined)) ??
    analyte.defaultUnit ??
    unitSummary(series).main;

  const shown = useMemo(
    () => series.map((p) => ({ ...p, shown: showIn(p.result, analyte, unit) })),
    [series, analyte, unit],
  );
  const norm = useMemo(() => normSummary(series, analyte, unit), [series, analyte, unit]);
  const start = periodStart(period, todayIso());

  const numeric = shown.filter((p) => p.shown.value !== undefined);
  const plottable = numeric.filter((p) => p.shown.convertible);
  const notConvertible = numeric.filter((p) => !p.shown.convertible);
  const otherUnits = [...new Set(notConvertible.map((p) => p.shown.unit ?? '—'))];
  const converted = plottable.filter((p) => p.shown.converted);

  const chartPoints: ChartPoint[] = plottable
    .filter((p) => !start || p.panel.date >= start)
    .map(({ panel, result, shown: s }) => ({
      date: panel.date,
      value: s.value ?? 0,
      refLow: s.refLow,
      refHigh: s.refHigh,
      status: resultStatus(result),
      original: s.original ? `${s.original.value} ${s.original.unit ?? ''}`.trim() : undefined,
      nameOriginal: originalName(result, analyte),
    }));

  if (series.length === 0) {
    return (
      <EmptyState
        icon={ChartSpline}
        title="Записів із цим показником ще немає"
        text="Графік з’явиться після першого аналізу з цим показником."
        action={<ButtonLink to="/add">Додати аналіз</ButtonLink>}
      />
    );
  }

  function setParam(key: 'period' | 'unit', value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  const editLink = `/data/analytes/${encodeURIComponent(analyte.id)}`;

  return (
    <>
      <div className={styles.periods} role="group" aria-label="Період" data-print="hide">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.period}
            aria-pressed={period === p.id}
            onClick={() => setParam('period', p.id === 'all' ? null : p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {units.length > 1 && (
        <div
          className={`${styles.periods} ${styles.units}`}
          role="group"
          aria-label="Показувати в одиницях"
          data-print="hide"
        >
          {units.map((u) => (
            <button
              key={u}
              type="button"
              className={styles.period}
              aria-pressed={sameUnit(u, unit)}
              onClick={() => setParam('unit', u)}
            >
              {u}
            </button>
          ))}
        </div>
      )}
      <p className="print-only">
        Період: {PERIODS.find((p) => p.id === period)?.label.toLowerCase()}
        {unit && ` · одиниці: ${unit}`}
      </p>

      {chartPoints.length > 0 ? (
        <TrendChart name={analyte.name} unit={unit} points={chartPoints} />
      ) : (
        <p className={styles.noChart}>
          {plottable.length === 0
            ? 'Немає числових значень для графіка в цих одиницях.'
            : 'За цей період записів немає. Оберіть «Усе», щоб побачити всі значення.'}
        </p>
      )}

      {notConvertible.length > 0 ? (
        <p className={styles.unitsWarning} role="note">
          <TriangleAlert aria-hidden size={20} strokeWidth={1.8} />
          <span>
            <strong>Одиниці різняться: перевірте значення.</strong> Записів у{' '}
            {otherUnits.join(', ')} немає на графіку, бо невідомо, як перерахувати їх у {unit}.{' '}
            <Link to={editLink} data-print="hide">
              Додати коефіцієнт
            </Link>
          </span>
        </p>
      ) : converted.length > 0 ? (
        <p className={styles.unitsInfo}>
          <Info aria-hidden size={20} strokeWidth={1.8} />
          <span>
            Записи в інших одиницях перераховано в {unit}
            {analyte.defaultUnit &&
              analyte.conversions?.map(
                (c) => ` · 1 ${analyte.defaultUnit} = ${formatNumber(c.factor)} ${c.unit}`,
              )}
            . Значення з бланка — під кожним записом.{' '}
            <Link to={editLink} data-print="hide">
              Змінити коефіцієнт
            </Link>
          </span>
        </p>
      ) : (
        unit && (
          <p className={styles.unitsInfo}>
            <Info aria-hidden size={20} strokeWidth={1.8} />
            <span>Одиниці однакові в усіх записах: {unit}</span>
          </p>
        )
      )}

      {norm.latest && (
        <div className={styles.norm}>
          <p className={styles.normMain}>
            Норма: {norm.latest.ref} {unit}
          </p>
          <p className={styles.normSub}>
            За останнім аналізом ({formatDateLong(norm.latest.date)}).
            {norm.others.length > 0 && ` В інших лабораторіях: ${norm.others.join(' · ')}`}
          </p>
        </div>
      )}

      <section className={styles.values} aria-labelledby="all-values">
        <h2 id="all-values" className={styles.valuesTitle}>
          Усі значення
        </h2>
        <ol className={styles.list}>
          {[...shown].reverse().map(({ panel, result, shown: s }, i) => {
            const status = resultStatus(result);
            const ref = formatRef(s);
            return (
              <li key={`${panel.id}-${i}`}>
                <Link
                  to={`/panel/${encodeURIComponent(panel.id)}`}
                  className={styles.row}
                  data-status={status}
                >
                  <span className={styles.rowMain}>
                    <span className={styles.date}>{formatDateLong(panel.date)}</span>
                    <StatusValue
                      value={formatValue(s)}
                      unit={s.unit}
                      status={status}
                      size="medium"
                    />
                  </span>
                  {(ref || panel.note) && (
                    <span className={styles.rowSub}>
                      {ref && <span>реф. {ref}</span>}
                      {panel.note && <span className={styles.note}>{panel.note}</span>}
                    </span>
                  )}
                  {originalName(result, analyte) && (
                    <span className={styles.original}>
                      як в аналізі: {originalName(result, analyte)}
                    </span>
                  )}
                  {s.original && (
                    <span className={styles.original}>
                      У бланку: {s.original.value} {s.original.unit}
                      {s.original.ref && `, реф. ${s.original.ref}`}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
