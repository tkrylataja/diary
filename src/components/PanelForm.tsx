import { CircleAlert, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { analyteMap } from '../data/selectors';
import { knownGroups, latestPanel, recentLabs } from '../data/mutations';
import {
  applyDraft,
  emptyRow,
  hasErrors,
  isRowBlank,
  rowForAnalyte,
  rowHasAnalyte,
  validateDraft,
  type DraftErrors,
  type PanelDraft,
  type ResultDraft,
  type RowErrors,
} from '../data/panelDraft';
import type { Analyte, Db, Panel } from '../data/types';
import { ANALYTE_FORMS, countLabel, formatRef, parseDecimal } from '../lib/format';
import { useDb } from '../state/dbContext';
import { AnalytePicker } from './AnalytePicker';
import { Button } from './Button';
import { TextArea, TextField } from './Field';
import styles from './PanelForm.module.css';

type Props = {
  initial: PanelDraft;
  /** Запис, що редагується (для нового — немає). */
  existing?: Panel;
  submitLabel: string;
  onSaved: (panelId: string) => void;
  /** Додатковий вміст під формою (напр. кнопка видалення). */
  footer?: ReactNode;
};

/** Форма запису (SPEC §6.5): дата, лабораторія, оригінал, нотатка й рядки результатів. */
export function PanelForm({ initial, existing, submitLabel, onSaved, footer }: Props) {
  const { db, updateDb } = useDb();
  const [draft, setDraft] = useState(initial);
  // У новому записі єдиний порожній рядок одразу розгорнутий.
  const [activeKey, setActiveKey] = useState<string | null>(() => {
    const [only, ...rest] = initial.results;
    return only && rest.length === 0 && isRowBlank(only) ? only.key : null;
  });
  const [errors, setErrors] = useState<DraftErrors | null>(null);
  // Рядок, який користувач щойно відкрив: у ньому ставимо фокус (але не при відкритті форми).
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const analytes = useMemo(() => analyteMap(db.analytes), [db.analytes]);
  const labs = useMemo(() => recentLabs(db), [db]);
  const groups = useMemo(() => knownGroups(db), [db]);
  const previous = useMemo(() => latestPanel(db, existing?.id), [db, existing?.id]);

  const filledCount = draft.results.filter(rowHasAnalyte).length;

  function update(next: PanelDraft) {
    setDraft(next);
    // Після першої спроби зберегти помилки оновлюються під час введення.
    if (errors) setErrors(validateDraft(next));
  }

  function setField<K extends 'date' | 'lab' | 'fileRef' | 'note'>(key: K, value: string) {
    update({ ...draft, [key]: value });
  }

  function setRow(row: ResultDraft) {
    update({ ...draft, results: draft.results.map((r) => (r.key === row.key ? row : r)) });
  }

  /** Згортає активний рядок; порожній рядок при цьому прибирається. */
  function collapsed(results: ResultDraft[]): ResultDraft[] {
    return results.filter((r) => r.key !== activeKey || !isRowBlank(r));
  }

  function addRow() {
    const row = emptyRow();
    update({ ...draft, results: [...collapsed(draft.results), row] });
    setActiveKey(row.key);
    setFocusKey(row.key);
  }

  function removeRow(key: string) {
    const results = draft.results.filter((r) => r.key !== key);
    update({ ...draft, results });
    if (activeKey === key) setActiveKey(null);
  }

  function copyPrevious() {
    if (!previous) return;
    const present = new Set(draft.results.map((r) => r.analyteId).filter(Boolean));
    const added = previous.results
      .map((r) => analytes.get(r.analyteId))
      .filter((a): a is Analyte => a !== undefined && !present.has(a.id))
      .filter((a, i, list) => list.findIndex((x) => x.id === a.id) === i)
      .map((a) => rowForAnalyte(db, a, existing?.id));
    const kept = draft.results.filter((r) => !isRowBlank(r));
    update({ ...draft, results: [...kept, ...added] });
    setActiveKey(added[0]?.key ?? null);
    setFocusKey(added[0]?.key ?? null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateDraft(draft);
    setErrors(found);
    if (hasErrors(found)) {
      if (found.date) dateRef.current?.focus();
      else {
        const firstBad = draft.results.find((r) => found.rows[r.key]);
        if (firstBad) {
          setActiveKey(firstBad.key);
          setFocusKey(firstBad.key);
        }
      }
      return;
    }
    const { db: next, panelId } = applyDraft(db, draft, existing);
    updateDb(() => next);
    onSaved(panelId);
  }

  return (
    <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.card}>
        <TextField
          ref={dateRef}
          label="Дата"
          type="date"
          required
          value={draft.date}
          onChange={(e) => setField('date', e.target.value)}
          error={errors?.date}
        />

        <div className={styles.labField}>
          <TextField
            label="Лабораторія"
            hint="Необов’язково"
            value={draft.lab}
            onChange={(e) => setField('lab', e.target.value)}
            autoComplete="off"
          />
          {labs.length > 0 && (
            <div className={styles.chips} role="group" aria-label="Останні лабораторії">
              {labs.map((lab) => (
                <button
                  key={lab}
                  type="button"
                  className={styles.chip}
                  aria-pressed={draft.lab === lab}
                  onClick={() => setField('lab', draft.lab === lab ? '' : lab)}
                >
                  {lab}
                </button>
              ))}
            </div>
          )}
        </div>

        <TextField
          label="Оригінал"
          placeholder="Назва файлу або посилання"
          hint="Сам файл у застосунок не завантажується"
          value={draft.fileRef}
          onChange={(e) => setField('fileRef', e.target.value)}
          autoComplete="off"
        />

        <TextArea
          label="Нотатка"
          placeholder="Напр. натще, вранці"
          rows={2}
          value={draft.note}
          onChange={(e) => setField('note', e.target.value)}
        />
      </div>

      <section className={styles.results} aria-labelledby={`${formId}-results`}>
        <h2 id={`${formId}-results`} className={styles.sectionTitle}>
          Результати
        </h2>
        {errors?.results && (
          <p className={styles.formError} role="alert">
            {errors.results}
          </p>
        )}

        {draft.results.map((row) =>
          row.key === activeKey ? (
            <RowEditor
              key={row.key}
              autoFocus={row.key === focusKey}
              db={db}
              row={row}
              errors={errors?.rows[row.key]}
              groups={groups}
              excludePanelId={existing?.id}
              onChange={setRow}
              onDone={() => {
                if (isRowBlank(row)) removeRow(row.key);
                else setActiveKey(null);
              }}
            />
          ) : (
            <RowCard
              key={row.key}
              row={row}
              analyte={row.analyteId ? analytes.get(row.analyteId) : undefined}
              errors={errors?.rows[row.key]}
              onEdit={() => {
                if (activeKey) update({ ...draft, results: collapsed(draft.results) });
                setActiveKey(row.key);
                setFocusKey(row.key);
              }}
              onRemove={() => removeRow(row.key)}
            />
          ),
        )}

        <div className={styles.rowActions}>
          <Button variant="secondary" onClick={addRow}>
            <Plus aria-hidden size={20} strokeWidth={1.8} /> Додати рядок
          </Button>
          {previous && (
            <Button variant="secondary" onClick={copyPrevious}>
              <Copy aria-hidden size={20} strokeWidth={1.8} /> Взяти з попереднього запису
            </Button>
          )}
        </div>
      </section>

      {footer}

      <div className={styles.saveBar}>
        <div className={styles.saveInner}>
          {errors && hasErrors(errors) && (
            <p className={styles.saveError} role="alert">
              <CircleAlert aria-hidden size={18} strokeWidth={1.8} /> Перевірте виділені поля
            </p>
          )}
          <Button type="submit">
            {submitLabel} · {countLabel(filledCount, ANALYTE_FORMS)}
          </Button>
          <p className={styles.saveHint}>
            Після збереження не забудьте зберегти зашифрований файл у розділі «Дані»
          </p>
        </div>
      </div>
    </form>
  );
}

function RowCard({
  row,
  analyte,
  errors,
  onEdit,
  onRemove,
}: {
  row: ResultDraft;
  analyte: Analyte | undefined;
  errors: RowErrors | undefined;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const name = analyte?.name ?? row.newName ?? 'Показник не обрано';
  const value = [row.value.trim(), row.unit.trim()].filter(Boolean).join(' ');
  const low = parseDecimal(row.refLow);
  const high = parseDecimal(row.refHigh);
  const ref = formatRef({ refLow: low, refHigh: high, refText: row.refText });
  const firstError = errors && Object.values(errors)[0];

  return (
    <div className={styles.rowCard} data-invalid={firstError ? true : undefined}>
      <button type="button" className={styles.rowCardMain} onClick={onEdit}>
        <span className={styles.rowCardTitle}>
          {name}
          {value && <> · {value}</>}
        </span>
        {ref && <span className={styles.rowCardSub}>реф. {ref}</span>}
        {firstError && <span className={styles.rowCardError}>{firstError}</span>}
        <span className="visually-hidden">, змінити</span>
      </button>
      <span className={styles.rowCardIcons}>
        <Pencil aria-hidden size={18} strokeWidth={1.8} className={styles.muted} />
        <button
          type="button"
          className={styles.iconButton}
          onClick={onRemove}
          aria-label={`Видалити рядок «${name}»`}
        >
          <Trash2 aria-hidden size={20} strokeWidth={1.8} />
        </button>
      </span>
    </div>
  );
}

function RowEditor({
  autoFocus,
  db,
  row,
  errors,
  groups,
  excludePanelId,
  onChange,
  onDone,
}: {
  autoFocus: boolean;
  db: Db;
  row: ResultDraft;
  errors: RowErrors | undefined;
  groups: string[];
  excludePanelId?: string;
  onChange: (row: ResultDraft) => void;
  onDone: () => void;
}) {
  const id = useId();
  const valueRef = useRef<HTMLInputElement>(null);
  const analyte = row.analyteId ? db.analytes.find((a) => a.id === row.analyteId) : undefined;
  const value = analyte ?? (row.newName ? { name: row.newName } : undefined);

  // Одиниці, що вже траплялися для цього показника, — як підказки.
  const units = useMemo(() => {
    const set = new Set<string>();
    if (analyte?.defaultUnit) set.add(analyte.defaultUnit);
    for (const p of db.panels) {
      for (const r of p.results) {
        if (r.analyteId === row.analyteId && r.unit) set.add(r.unit);
      }
    }
    return [...set];
  }, [db.panels, analyte, row.analyteId]);

  function pick(a: Analyte) {
    const untouched = !row.unit.trim() && !row.refLow.trim() && !row.refHigh.trim();
    if (untouched) {
      const filled = rowForAnalyte(db, a, excludePanelId);
      onChange({ ...filled, key: row.key, value: row.value });
    } else {
      onChange({ ...row, analyteId: a.id, newName: undefined, newGroup: undefined });
    }
    // Після вибору показника одразу вводимо значення.
    requestAnimationFrame(() => valueRef.current?.focus());
  }

  return (
    <div className={styles.rowEditor}>
      <AnalytePicker
        label="Показник"
        analytes={db.analytes}
        value={value}
        onChange={pick}
        onCreate={(name) => {
          onChange({ ...row, analyteId: undefined, newName: name });
          requestAnimationFrame(() => valueRef.current?.focus());
        }}
        error={errors?.analyte}
        autoFocus={autoFocus && !value}
      />
      {row.newName && (
        <>
          <TextField
            label="Група (необов’язково)"
            list={`${id}-groups`}
            value={row.newGroup ?? ''}
            onChange={(e) => onChange({ ...row, newGroup: e.target.value })}
            autoComplete="off"
            hint="Новий показник буде додано до списку"
          />
          <datalist id={`${id}-groups`}>
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </>
      )}
      <div className={styles.pair}>
        <TextField
          label="Значення"
          value={row.value}
          onChange={(e) => onChange({ ...row, value: e.target.value })}
          placeholder="15,4 або <0,5"
          error={errors?.value}
          autoComplete="off"
          ref={valueRef}
          autoFocus={autoFocus && !!value}
        />
        <TextField
          label="Одиниці"
          list={`${id}-units`}
          value={row.unit}
          onChange={(e) => onChange({ ...row, unit: e.target.value })}
          autoComplete="off"
        />
        <datalist id={`${id}-units`}>
          {units.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
      <div className={styles.pair}>
        <TextField
          label="Реф. від"
          inputMode="decimal"
          value={row.refLow}
          onChange={(e) => onChange({ ...row, refLow: e.target.value })}
          error={errors?.refLow}
          autoComplete="off"
        />
        <TextField
          label="Реф. до"
          inputMode="decimal"
          value={row.refHigh}
          onChange={(e) => onChange({ ...row, refHigh: e.target.value })}
          error={errors?.refHigh}
          autoComplete="off"
        />
      </div>
      {row.refText && !row.refLow.trim() && !row.refHigh.trim() && (
        <p className={styles.muted}>Референс у бланку: {row.refText}</p>
      )}
      <Button variant="secondary" onClick={onDone}>
        Готово
      </Button>
    </div>
  );
}
