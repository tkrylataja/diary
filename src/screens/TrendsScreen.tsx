import { ChartSpline, Info, Plus, SearchX, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
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
  parsePeriod,
  periodStart,
  unitSummary,
  type Period,
} from '../data/selectors';
import { resultStatus } from '../data/status';
import type { Analyte } from '../data/types';
import { formatDateLong, formatRef, formatValue, todayIso } from '../lib/format';
import { useDb } from '../state/dbContext';
import styles from './TrendsScreen.module.css';

/** Динаміка показника — екран для лікаря №2 (SPEC §6.3). */
export function TrendsScreen() {
  const { analyteId } = useParams();
  const { db } = useDb();
  const navigate = useNavigate();
  const analyte = db.analytes.find((a) => a.id === analyteId);

  function select(a: Analyte) {
    navigate(`/trends/${encodeURIComponent(a.id)}`, { replace: analyteId !== undefined });
  }

  return (
    <Screen>
      <PrintHeader
        title={analyte?.name}
        details={
          analyte && analyte.synonyms.length > 0
            ? `Також: ${analyte.synonyms.join(' · ')}`
            : undefined
        }
      />
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
            {analyte && analyte.synonyms.length > 0 && (
              <p className={styles.synonyms}>Також: {analyte.synonyms.join(' · ')}</p>
            )}
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
  const units = useMemo(() => unitSummary(series, analyte.defaultUnit), [series, analyte]);
  const start = periodStart(period, todayIso());

  const numeric = series.filter(
    (p) =>
      p.result.value !== undefined && (units.consistent || p.result.unit?.trim() === units.main),
  );
  const chartPoints: ChartPoint[] = numeric
    .filter((p) => !start || p.panel.date >= start)
    .map(({ panel, result }) => ({
      date: panel.date,
      value: result.value ?? 0,
      refLow: result.refLow,
      refHigh: result.refHigh,
      status: resultStatus(result),
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

  function setPeriod(p: Period) {
    setParams(p === 'all' ? {} : { period: p }, { replace: true });
  }

  return (
    <>
      <div className={styles.periods} role="group" aria-label="Період" data-print="hide">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.period}
            aria-pressed={period === p.id}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="print-only">
        Період: {PERIODS.find((p) => p.id === period)?.label.toLowerCase()}
      </p>

      {chartPoints.length > 0 ? (
        <TrendChart name={analyte.name} unit={units.main} points={chartPoints} />
      ) : (
        <p className={styles.noChart}>
          {numeric.length === 0
            ? 'Немає числових значень для графіка.'
            : 'За цей період записів немає. Оберіть «Усе», щоб побачити всі значення.'}
        </p>
      )}

      {units.units.length > 0 &&
        (units.consistent ? (
          <p className={styles.unitsInfo}>
            <Info aria-hidden size={20} strokeWidth={1.8} />
            <span>Одиниці однакові в усіх записах: {units.main}</span>
          </p>
        ) : (
          <p className={styles.unitsWarning} role="note">
            <TriangleAlert aria-hidden size={20} strokeWidth={1.8} />
            <span>
              <strong>Одиниці різняться: перевірте значення.</strong> На графіку лише записи в{' '}
              {units.main}.
            </span>
          </p>
        ))}

      <section className={styles.values} aria-labelledby="all-values">
        <h2 id="all-values" className={styles.valuesTitle}>
          Усі значення
        </h2>
        <ol className={styles.list}>
          {[...series].reverse().map(({ panel, result }, i) => {
            const status = resultStatus(result);
            const ref = formatRef(result);
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
                      value={formatValue(result)}
                      unit={result.unit}
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
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
