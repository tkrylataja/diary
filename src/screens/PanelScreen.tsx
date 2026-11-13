import { ChevronRight, FileText, FileQuestion, StickyNote } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { PrintHeader } from '../components/PrintHeader';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusValue } from '../components/StatusValue';
import { originalName } from '../data/analytes';
import { analyteMap, groupPanelResults } from '../data/selectors';
import { resultStatus } from '../data/status';
import { ANALYTE_FORMS, countLabel, formatDateLong, formatRef, formatValue } from '../lib/format';
import { useDb } from '../state/dbContext';
import styles from './PanelScreen.module.css';

const URL_RE = /^https?:\/\//i;

/** Пакет за датою — екран для лікаря №1 (SPEC §6.2). */
export function PanelScreen() {
  const { id } = useParams();
  const { db } = useDb();
  const panel = db.panels.find((p) => p.id === id);
  const analytes = useMemo(() => analyteMap(db.analytes), [db.analytes]);

  if (!panel) {
    return (
      <Screen>
        <ScreenHeader title="Запис не знайдено" back />
        <EmptyState
          icon={FileQuestion}
          title="Такого запису немає"
          text="Можливо, його видалено. Поверніться до списку аналізів."
          action={<ButtonLink to="/">До списку</ButtonLink>}
        />
      </Screen>
    );
  }

  const groups = groupPanelResults(panel, analytes);
  const subtitle = [panel.lab, countLabel(panel.results.length, ANALYTE_FORMS)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen>
      <PrintHeader />
      <ScreenHeader
        title={formatDateLong(panel.date)}
        subtitle={subtitle}
        back
        editTo={`/panel/${encodeURIComponent(panel.id)}/edit`}
        print
      />

      {(panel.note || panel.fileRef) && (
        <div className={styles.meta}>
          {panel.note && (
            <p className={styles.metaRow}>
              <StickyNote aria-hidden size={20} strokeWidth={1.8} />
              <span>
                <span className="visually-hidden">Нотатка: </span>
                {panel.note}
              </span>
            </p>
          )}
          {panel.fileRef && (
            <p className={styles.metaRow}>
              <FileText aria-hidden size={20} strokeWidth={1.8} />
              <span>
                <span className="visually-hidden">Оригінал: </span>
                {URL_RE.test(panel.fileRef) ? (
                  <a href={panel.fileRef} target="_blank" rel="noopener noreferrer">
                    {panel.fileRef}
                  </a>
                ) : (
                  panel.fileRef
                )}
              </span>
            </p>
          )}
        </div>
      )}

      {groups.map(({ group, items }) => (
        <section key={group} className={styles.group} aria-label={group}>
          <h2 className={styles.groupTitle}>{group}</h2>
          <ul className={styles.list}>
            {items.map(({ result, analyte }, i) => {
              const status = resultStatus(result);
              const ref = formatRef(result);
              return (
                <li key={`${analyte.id}-${i}`}>
                  <Link
                    to={`/trends/${encodeURIComponent(analyte.id)}`}
                    className={styles.row}
                    data-status={status}
                  >
                    <span className={styles.name}>
                      <span className={styles.analyte}>{analyte.name}</span>
                      {originalName(result, analyte) && (
                        <span className={styles.ref}>
                          як в аналізі: {originalName(result, analyte)}
                        </span>
                      )}
                      {ref && <span className={styles.ref}>реф. {ref}</span>}
                    </span>
                    <StatusValue value={formatValue(result)} unit={result.unit} status={status} />
                    <ChevronRight
                      aria-hidden
                      size={18}
                      strokeWidth={1.8}
                      className={styles.chevron}
                      data-print="hide"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Screen>
  );
}
