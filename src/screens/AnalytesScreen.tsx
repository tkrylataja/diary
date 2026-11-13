import { ChevronRight, ListX, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchField } from '../components/SearchField';
import { analyteMatches } from '../data/analytes';
import { usageCount } from '../data/mutations';
import { OTHER_GROUP } from '../data/selectors';
import type { Analyte } from '../data/types';
import { ANALYTE_FORMS, RECORD_FORMS, countLabel } from '../lib/format';
import { useDb } from '../state/dbContext';
import styles from './AnalytesScreen.module.css';

/** Список показників із синонімами, згрупований за групами (SPEC §6.6). */
export function AnalytesScreen() {
  const { db } = useDb();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const byGroup = new Map<string, Analyte[]>();
    for (const a of db.analytes) {
      if (!analyteMatches(a, query)) continue;
      const g = a.group?.trim() || OTHER_GROUP;
      byGroup.set(g, [...(byGroup.get(g) ?? []), a]);
    }
    return [...byGroup]
      .sort(([a], [b]) =>
        a === OTHER_GROUP ? 1 : b === OTHER_GROUP ? -1 : a.localeCompare(b, 'uk'),
      )
      .map(([group, list]) => ({
        group,
        list: list.sort((a, b) => a.name.localeCompare(b.name, 'uk')),
      }));
  }, [db.analytes, query]);

  return (
    <Screen>
      <ScreenHeader
        title="Показники та синоніми"
        subtitle={countLabel(db.analytes.length, ANALYTE_FORMS)}
        back
      />
      {db.analytes.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Показників ще немає"
          text="Вони з’являються, коли ви додаєте аналізи."
          action={<ButtonLink to="/add">Додати аналіз</ButtonLink>}
        />
      ) : (
        <>
          <SearchField
            label="Пошук показника"
            placeholder="Назва або синонім"
            value={query}
            onChange={setQuery}
          />
          <p className="visually-hidden" role="status">
            {query &&
              `Знайдено: ${countLabel(
                groups.reduce((n, g) => n + g.list.length, 0),
                ANALYTE_FORMS,
              )}`}
          </p>
          {groups.length === 0 && (
            <EmptyState
              icon={ListX}
              title="Нічого не знайдено"
              text="Спробуйте іншу назву або синонім."
            />
          )}
          {groups.map(({ group, list }) => (
            <section key={group} className={styles.group} aria-label={group}>
              <h2 className={styles.groupTitle}>{group}</h2>
              <ul className={styles.list}>
                {list.map((a) => (
                  <li key={a.id}>
                    <Link to={`/data/analytes/${encodeURIComponent(a.id)}`} className={styles.row}>
                      <span className={styles.info}>
                        <span className={styles.name}>{a.name}</span>
                        {a.synonyms.length > 0 && (
                          <span className={styles.synonyms}>{a.synonyms.join(' · ')}</span>
                        )}
                      </span>
                      <span className={styles.count}>
                        {countLabel(usageCount(db, a.id), RECORD_FORMS)}
                      </span>
                      <ChevronRight aria-hidden size={18} strokeWidth={1.8} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </Screen>
  );
}
