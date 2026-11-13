import { CircleCheck, FileUp } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { analyteKey } from '../data/analytes';
import {
  applyImport,
  parseCsv,
  parseTable,
  unknownAnalyteNames,
  type Cell,
  type ImportStats,
  type NameMapping,
  type ParsedTable,
} from '../data/importTable';
import { formatDateLong, formatRef, formatValue } from '../lib/format';
import { useDb } from '../state/dbContext';
import { Button } from './Button';
import { FileButton } from './FileButton';
import styles from './ImportCard.module.css';

const PREVIEW_ROWS = 10;
const MAX_ISSUES = 20;

type Loaded = { fileName: string; parsed: ParsedTable };

async function readTable(file: File): Promise<Cell[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    // Бібліотека Excel завантажується лише тоді, коли вона потрібна.
    const { readSheet } = await import('read-excel-file/browser');
    return (await readSheet(file)) as Cell[][];
  }
  if (name.endsWith('.xls')) {
    throw new Error('Старий формат .xls не підтримується. Збережіть файл як .xlsx або .csv.');
  }
  return parseCsv(await file.text());
}

/** Картка «Імпорт з CSV або Excel»: перегляд і звіт про помилки до підтвердження. */
export function ImportCard() {
  const { db, updateDb } = useDb();
  const inputId = useId();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<NameMapping>({});
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<ImportStats | null>(null);

  const unknown = useMemo(
    () => (loaded ? unknownAnalyteNames(db.analytes, loaded.parsed.rows) : []),
    [db.analytes, loaded],
  );
  // Пробний прогін: та сама функція, що й при імпорті, лише без збереження.
  const preview = useMemo(
    () => (loaded ? applyImport(db, loaded.parsed.rows, mapping).stats : null),
    [db, loaded, mapping],
  );
  const sortedAnalytes = useMemo(
    () => [...db.analytes].sort((a, b) => a.name.localeCompare(b.name, 'uk')),
    [db.analytes],
  );

  async function onFile(file: File) {
    setError(undefined);
    setDone(null);
    setMapping({});
    try {
      const parsed = parseTable(await readTable(file));
      setLoaded({ fileName: file.name, parsed });
    } catch (err) {
      setLoaded(null);
      setError(
        err instanceof Error && err.message.startsWith('Старий формат')
          ? err.message
          : 'Не вдалося прочитати файл. Перевірте, що це CSV або Excel (.xlsx).',
      );
    }
  }

  function confirm() {
    if (!loaded) return;
    const { db: next, stats } = applyImport(db, loaded.parsed.rows, mapping);
    updateDb(() => next);
    setDone(stats);
    setLoaded(null);
  }

  const parsed = loaded?.parsed;

  return (
    <section className={styles.card} aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className={styles.title}>
        Імпорт з CSV або Excel
      </h2>
      <p className={styles.muted}>
        Перший рядок — заголовок із колонками{' '}
        <code>date, lab, analyte, value, unit, ref_low, ref_high</code>. Обов’язкові: date, analyte,
        value. Рядки з однаковими датою й лабораторією стануть одним записом.
      </p>

      <FileButton
        label="Обрати файл"
        icon={FileUp}
        accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onFile={(file) => void onFile(file)}
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {done && (
        <p className={styles.success} role="status">
          <CircleCheck aria-hidden size={20} strokeWidth={1.8} />
          <span>
            Імпортовано: нових записів {done.newPanels}, доповнено {done.updatedPanels}, результатів{' '}
            {done.results}
            {done.duplicates > 0 && `, пропущено дублів ${done.duplicates}`}. Не забудьте зберегти
            файл data.enc.
          </span>
        </p>
      )}

      {loaded && parsed && (
        <div className={styles.preview}>
          <p className={styles.fileName}>{loaded.fileName}</p>

          {parsed.missingColumns.length > 0 ? (
            <p className={styles.error} role="alert">
              У файлі немає обов’язкових колонок: {parsed.missingColumns.join(', ')}.
            </p>
          ) : (
            <>
              {parsed.issues.length > 0 && (
                <div className={styles.issues}>
                  <p className={styles.issuesTitle}>
                    Рядків із помилками: {parsed.issues.length}. Їх не буде імпортовано.
                  </p>
                  <ul>
                    {parsed.issues.slice(0, MAX_ISSUES).map((issue) => (
                      <li key={issue.line}>
                        Рядок {issue.line}: {issue.message}
                      </li>
                    ))}
                    {parsed.issues.length > MAX_ISSUES && (
                      <li>…і ще {parsed.issues.length - MAX_ISSUES}</li>
                    )}
                  </ul>
                </div>
              )}

              {unknown.length > 0 && (
                <fieldset className={styles.mapping}>
                  <legend className={styles.issuesTitle}>
                    Назви, яких немає в списку показників
                  </legend>
                  {unknown.map((name) => {
                    const key = analyteKey(name);
                    const current = mapping[key];
                    return (
                      <label key={key} className={styles.mapRow}>
                        <span className={styles.mapName}>«{name}»</span>
                        <select
                          className={styles.select}
                          value={current?.kind === 'existing' ? current.analyteId : ''}
                          onChange={(e) =>
                            setMapping({
                              ...mapping,
                              [key]: e.target.value
                                ? { kind: 'existing', analyteId: e.target.value }
                                : { kind: 'new' },
                            })
                          }
                        >
                          <option value="">Створити новий показник</option>
                          {sortedAnalytes.map((a) => (
                            <option key={a.id} value={a.id}>
                              Це {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                  <p className={styles.muted}>
                    Якщо обрати наявний показник, назва з файлу стане його синонімом.
                  </p>
                </fieldset>
              )}

              {parsed.rows.length > 0 && (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className="visually-hidden">Перші рядки імпорту</caption>
                    <thead>
                      <tr>
                        <th scope="col">Дата</th>
                        <th scope="col">Показник</th>
                        <th scope="col">Значення</th>
                        <th scope="col">Реф.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, PREVIEW_ROWS).map((r) => (
                        <tr key={r.line}>
                          <td>{formatDateLong(r.date)}</td>
                          <td>{r.analyte}</td>
                          <td>
                            {formatValue(r)} {r.unit}
                          </td>
                          <td>{formatRef(r)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rows.length > PREVIEW_ROWS && (
                    <p className={styles.muted}>…і ще {parsed.rows.length - PREVIEW_ROWS} рядків</p>
                  )}
                </div>
              )}

              {preview && (
                <p className={styles.summary}>
                  Буде додано: нових записів {preview.newPanels}, доповнено наявних{' '}
                  {preview.updatedPanels}, результатів {preview.results}, нових показників{' '}
                  {preview.newAnalytes}
                  {preview.duplicates > 0 && `. Пропущено дублів: ${preview.duplicates}`}.
                </p>
              )}

              <div className={styles.actions}>
                <Button onClick={confirm} disabled={!preview || preview.results === 0}>
                  Імпортувати
                </Button>
                <Button variant="secondary" onClick={() => setLoaded(null)}>
                  Скасувати
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
