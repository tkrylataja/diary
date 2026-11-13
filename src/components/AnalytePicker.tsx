import { ChevronDown, Plus } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { analyteKey, analyteNames, searchAnalytes } from '../data/analytes';
import type { Analyte } from '../data/types';
import styles from './AnalytePicker.module.css';

type Props = {
  label: string;
  analytes: Analyte[];
  /** Обраний показник (або назва нового, ще не збереженого). */
  value: { name: string } | undefined;
  onChange: (analyte: Analyte) => void;
  /** Дозволити створення нового показника з введеної назви. */
  onCreate?: (name: string) => void;
  /** Показники, яких не треба пропонувати. */
  excludeIds?: string[];
  error?: string;
  autoFocus?: boolean;
};

type Option = { kind: 'analyte'; analyte: Analyte } | { kind: 'create'; name: string };

/** Поле з пошуком показника за назвою й синонімами (ARIA combobox). */
export function AnalytePicker({
  label,
  analytes,
  value,
  onChange,
  onCreate,
  excludeIds,
  error,
  autoFocus,
}: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const options = useMemo<Option[]>(() => {
    const pool = excludeIds ? analytes.filter((a) => !excludeIds.includes(a.id)) : analytes;
    const found: Option[] = searchAnalytes(pool, query).map((analyte) => ({
      kind: 'analyte',
      analyte,
    }));
    const name = query.trim();
    const exact = analytes.some((a) =>
      analyteNames(a).some((n) => analyteKey(n) === analyteKey(name)),
    );
    if (onCreate && name && !exact) found.push({ kind: 'create', name });
    return found;
  }, [analytes, excludeIds, query, onCreate]);

  function choose(option: Option) {
    if (option.kind === 'analyte') onChange(option.analyte);
    else onCreate?.(option.name);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (options.length ? (i + delta + options.length) % options.length : 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      const option = options[active];
      if (option) choose(option);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  const activeId = open && options[active] ? `${id}-opt-${active}` : undefined;

  return (
    <div className={styles.picker}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          className={styles.input}
          placeholder={value ? value.name : 'Почніть вводити назву'}
          value={open ? query : (value?.name ?? '')}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setActive(0);
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <ChevronDown aria-hidden size={20} strokeWidth={1.8} className={styles.chevron} />
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className={styles.list}>
          {options.length === 0 ? (
            <li className={styles.none}>Нічого не знайдено</li>
          ) : (
            options.map((option, i) => (
              <li
                key={option.kind === 'analyte' ? option.analyte.id : 'create'}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={styles.option}
                data-active={i === active || undefined}
                // mousedown, а не click: інакше blur поля закриє список раніше.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {option.kind === 'analyte' ? (
                  <>
                    <span className={styles.optionName}>{option.analyte.name}</span>
                    {option.analyte.synonyms.length > 0 && (
                      <span className={styles.optionSyn}>
                        {option.analyte.synonyms.join(' · ')}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={styles.optionCreate}>
                    <Plus aria-hidden size={18} strokeWidth={1.8} />
                    Новий показник «{option.name}»
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
