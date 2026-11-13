import { Combine, SearchX, Trash2, X } from 'lucide-react';
import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { AnalytePicker } from '../components/AnalytePicker';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { TextField } from '../components/Field';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  cleanSynonyms,
  deleteAnalyte,
  findNameConflict,
  knownGroups,
  mergeAnalytes,
  upsertAnalyte,
  usageCount,
} from '../data/mutations';
import type { Analyte } from '../data/types';
import { RECORD_FORMS, countLabel } from '../lib/format';
import { useDb } from '../state/dbContext';
import styles from './AnalyteEditScreen.module.css';

export function AnalyteEditScreen() {
  const { id } = useParams();
  const { db } = useDb();
  const analyte = db.analytes.find((a) => a.id === id);

  if (!analyte) {
    return (
      <Screen>
        <ScreenHeader title="Показник не знайдено" back />
        <EmptyState
          icon={SearchX}
          title="Такого показника немає"
          text="Можливо, його об’єднано з іншим або видалено."
        />
      </Screen>
    );
  }
  // key: при переході на інший показник (після об'єднання) форма починається заново.
  return <AnalyteEditor key={analyte.id} analyte={analyte} />;
}

/** Назва, синоніми, група, одиниці; об'єднання дублів і видалення (SPEC §6.6). */
function AnalyteEditor({ analyte }: { analyte: Analyte }) {
  const { db, updateDb } = useDb();
  const navigate = useNavigate();
  const location = useLocation();
  const formId = useId();

  const [name, setName] = useState(analyte.name);
  const [synonyms, setSynonyms] = useState(analyte.synonyms);
  const [newSynonym, setNewSynonym] = useState('');
  const [group, setGroup] = useState(analyte.group ?? '');
  const [unit, setUnit] = useState(analyte.defaultUnit ?? '');
  const [error, setError] = useState<string>();
  const [mergeTarget, setMergeTarget] = useState<Analyte>();

  const groups = useMemo(() => knownGroups(db), [db]);
  const used = usageCount(db, analyte.id);

  function goBack() {
    if (location.key === 'default') navigate('/data/analytes', { replace: true });
    else navigate(-1);
  }

  function addSynonym() {
    const s = newSynonym.trim();
    if (!s) return;
    setSynonyms(cleanSynonyms(name, [...synonyms, s]));
    setNewSynonym('');
  }

  function onSynonymKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSynonym();
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Вкажіть назву');
      return;
    }
    const pending = newSynonym.trim() ? [...synonyms, newSynonym] : synonyms;
    const next: Analyte = {
      id: analyte.id,
      name: trimmedName,
      synonyms: cleanSynonyms(trimmedName, pending),
    };
    if (group.trim()) next.group = group.trim();
    if (unit.trim()) next.defaultUnit = unit.trim();

    const conflict = findNameConflict(db.analytes, next);
    if (conflict) {
      const [taken, owner] = conflict;
      setError(
        `«${taken}» вже є в показника «${owner.name}». Якщо це той самий показник, об’єднайте їх нижче.`,
      );
      return;
    }
    updateDb((current) => upsertAnalyte(current, next));
    goBack();
  }

  function merge() {
    if (!mergeTarget) return;
    const ok = window.confirm(
      `Об’єднати «${analyte.name}» з «${mergeTarget.name}»? ` +
        `${countLabel(used, RECORD_FORMS)} перейде до «${mergeTarget.name}», ` +
        `а назва «${analyte.name}» і її синоніми стануть його синонімами.`,
    );
    if (!ok) return;
    updateDb((current) => mergeAnalytes(current, analyte.id, mergeTarget.id));
    navigate(`/data/analytes/${encodeURIComponent(mergeTarget.id)}`, { replace: true });
  }

  function remove() {
    if (!window.confirm(`Видалити показник «${analyte.name}»?`)) return;
    updateDb((current) => deleteAnalyte(current, analyte.id));
    goBack();
  }

  return (
    <Screen>
      <ScreenHeader title={analyte.name} subtitle={countLabel(used, RECORD_FORMS)} back />

      <form className={styles.card} onSubmit={save} noValidate aria-label="Показник">
        <TextField
          label="Назва"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          autoComplete="off"
        />

        <div className={styles.synonyms}>
          <span className={styles.label} id={`${formId}-syn`}>
            Синоніми
          </span>
          {synonyms.length > 0 && (
            <ul className={styles.chips} aria-labelledby={`${formId}-syn`}>
              {synonyms.map((s) => (
                <li key={s} className={styles.chip}>
                  {s}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={`Прибрати синонім «${s}»`}
                    onClick={() => {
                      setSynonyms(synonyms.filter((x) => x !== s));
                      setError(undefined);
                    }}
                  >
                    <X aria-hidden size={16} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.addSynonym}>
            <TextField
              label="Новий синонім"
              placeholder="Напр. PRL або назва польською"
              value={newSynonym}
              onChange={(e) => {
                setNewSynonym(e.target.value);
                setError(undefined);
              }}
              onKeyDown={onSynonymKey}
              autoComplete="off"
            />
            <Button variant="secondary" onClick={addSynonym} disabled={!newSynonym.trim()}>
              Додати
            </Button>
          </div>
        </div>

        <TextField
          label="Група"
          list={`${formId}-groups`}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          hint="Напр. «Гормони». Показники без групи потрапляють в «Інше»."
          autoComplete="off"
        />
        <datalist id={`${formId}-groups`}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>

        <TextField
          label="Одиниці за замовчуванням"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          hint="Підставляються в нові записи, якщо цей показник ще не траплявся."
          autoComplete="off"
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit">Зберегти</Button>
      </form>

      <section className={styles.card} aria-labelledby={`${formId}-merge`}>
        <h2 id={`${formId}-merge`} className={styles.sectionTitle}>
          Об’єднати дубль
        </h2>
        <p className={styles.muted}>
          Якщо це той самий показник під іншою назвою (напр. HGB = Гемоглобін), оберіть основний.
          Усі записи перейдуть до нього, а ця назва стане синонімом.
        </p>
        <AnalytePicker
          label="Основний показник"
          analytes={db.analytes}
          excludeIds={[analyte.id]}
          value={mergeTarget}
          onChange={setMergeTarget}
        />
        <Button variant="secondary" onClick={merge} disabled={!mergeTarget}>
          <Combine aria-hidden size={20} strokeWidth={1.8} /> Об’єднати
        </Button>
      </section>

      {used === 0 ? (
        <Button variant="danger" onClick={remove}>
          <Trash2 aria-hidden size={20} strokeWidth={1.8} /> Видалити показник
        </Button>
      ) : (
        <p className={styles.muted}>
          Показник використовується в записах, тому його не можна видалити. Якщо це дубль,
          об’єднайте його з основним.
        </p>
      )}
    </Screen>
  );
}
