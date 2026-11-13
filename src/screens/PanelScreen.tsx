import { ChevronRight, FileText, FileQuestion, StickyNote, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { PrintHeader } from '../components/PrintHeader';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusValue } from '../components/StatusValue';
import { originalName } from '../data/analytes';
import { deleteResult } from '../data/mutations';
import { analyteMap, groupPanelResults } from '../data/selectors';
import { resultStatus } from '../data/status';
import type { Result } from '../data/types';
import { ANALYTE_FORMS, countLabel, formatDate, formatRef, formatValue } from '../lib/format';
import { useDb } from '../state/dbContext';
import styles from './PanelScreen.module.css';

const URL_RE = /^https?:\/\//i;

/** Пакет за датою — екран для лікаря №1 (SPEC §6.2). */
export function PanelScreen() {
  const { id } = useParams();
  const { db, updateDb } = useDb();
  const navigate = useNavigate();
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

  function removeResult(result: Result, name: string) {
    if (!panel) return;
    const index = panel.results.indexOf(result);
    const date = formatDate(panel.date);
    const value = [formatValue(result), result.unit].filter(Boolean).join(' ');
    const question =
      panel.results.length === 1
        ? `«${name}» — останній показник у цьому обстеженні. Видалити все обстеження за ${date}?`
        : `Видалити «${name}» (${value}) з обстеження за ${date}?`;
    if (!window.confirm(`${question}\n\nЩоб зміна потрапила на сайт, потім збережіть data.enc.`))
      return;
    const { db: next, panelDeleted } = deleteResult(db, panel.id, index);
    updateDb(() => next);
    if (panelDeleted) navigate('/', { replace: true });
  }
  const subtitle = [panel.lab, countLabel(panel.results.length, ANALYTE_FORMS)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen>
      <PrintHeader />
      <ScreenHeader
        title={formatDate(panel.date)}
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
                <li key={`${analyte.id}-${i}`} className={styles.item}>
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
                  <button
                    type="button"
                    className={styles.delete}
                    onClick={() => removeResult(result, analyte.name)}
                    aria-label={`Видалити «${analyte.name}» з цього обстеження`}
                    data-print="hide"
                  >
                    <Trash2 aria-hidden size={18} strokeWidth={1.8} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Screen>
  );
}
