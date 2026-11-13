import { Plus, SearchX } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchField } from '../components/SearchField';
import { analyteMap, groupPanelsByYear, panelMatches, sortPanelsDesc } from '../data/selectors';
import { outOfRangeCount, resultStatus } from '../data/status';
import type { Panel } from '../data/types';
import { ANALYTE_FORMS, RECORD_FORMS, countLabel, formatDayMonth, formatDate } from '../lib/format';
import { useDb } from '../state/dbContext';
import styles from './PanelsScreen.module.css';

/** Головна: записи за датами, згруповані по роках (SPEC §6.1). */
export function PanelsScreen() {
  const { db } = useDb();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';

  const analytes = useMemo(() => analyteMap(db.analytes), [db.analytes]);
  const sorted = useMemo(() => sortPanelsDesc(db.panels), [db.panels]);
  const groups = useMemo(
    () => groupPanelsByYear(sorted.filter((p) => panelMatches(p, query, analytes))),
    [sorted, query, analytes],
  );
  const firstYear = sorted[sorted.length - 1]?.date.slice(0, 4);

  function setQuery(q: string) {
    setParams(q ? { q } : {}, { replace: true });
  }

  return (
    <Screen>
      <ScreenHeader
        title="Аналізи"
        subtitle={
          sorted.length > 0
            ? `${countLabel(sorted.length, RECORD_FORMS)} · з ${firstYear} року`
            : undefined
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Додайте перший аналіз"
          text="Внесіть результати з бланка, і вони з’являться тут, згруповані за датами."
          action={<ButtonLink to="/add">Додати аналіз</ButtonLink>}
        />
      ) : (
        <>
          <SearchField
            label="Пошук записів"
            placeholder="Показник або лабораторія"
            value={query}
            onChange={setQuery}
          />
          <p className="visually-hidden" role="status">
            {query &&
              `Знайдено: ${countLabel(
                groups.reduce((n, g) => n + g.panels.length, 0),
                RECORD_FORMS,
              )}`}
          </p>
          {groups.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Нічого не знайдено"
              text="Спробуйте іншу назву показника, синонім (напр. PRL) або назву лабораторії."
            />
          ) : (
            groups.map(({ year, panels }) => (
              <section key={year} className={styles.year} aria-labelledby={`year-${year}`}>
                <h2 id={`year-${year}`} className={styles.yearTitle}>
                  {year}
                </h2>
                <ul className={styles.list}>
                  {panels.map((panel) => (
                    <li key={panel.id}>
                      <PanelCard panel={panel} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function PanelCard({ panel }: { panel: Panel }) {
  const outside = outOfRangeCount(panel);
  const hasNormal = panel.results.some((r) => resultStatus(r) === 'normal');
  return (
    <Link to={`/panel/${encodeURIComponent(panel.id)}`} className={styles.card}>
      <span className="visually-hidden">{formatDate(panel.date)}</span>
      <span className={styles.date} aria-hidden>
        <span className={styles.day}>{formatDayMonth(panel.date)}</span>
      </span>
      <span className={styles.info}>
        {panel.lab && <span className={styles.lab}>{panel.lab}</span>}
        <span className={styles.count}>{countLabel(panel.results.length, ANALYTE_FORMS)}</span>
      </span>
      {outside > 0 ? (
        <span className={`${styles.badge} ${styles.badgeWarm}`}>{outside} поза нормою</span>
      ) : (
        hasNormal && <span className={styles.badge}>усе в нормі</span>
      )}
    </Link>
  );
}
