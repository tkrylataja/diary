import { CircleCheck, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { emptyDb } from '../data/types';
import { ANALYTE_FORMS, RECORD_FORMS, countLabel } from '../lib/format';
import { useDb } from '../state/dbContext';
import { Button } from './Button';
import { TextField } from './Field';
import styles from './DeleteAllCard.module.css';

const CONFIRM_WORD = 'видалити';

/** «Видалити всі дані» — щоб імпортувати все з нуля. Потребує ввести слово «видалити». */
export function DeleteAllCard() {
  const { db, updateDb } = useDb();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const empty = db.panels.length === 0 && db.analytes.length === 0;

  return (
    <section className={styles.card} aria-labelledby="delete-all-title">
      <h2 id="delete-all-title" className={styles.title}>
        Видалити всі дані
      </h2>
      <p className={styles.muted}>
        Стирає всі записи й показники в цій вкладці, щоб можна було імпортувати все з нуля. Поки ви
        не завантажите новий data.enc, на сайті лишаються старі дані.
      </p>
      <Button
        variant="danger"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
        disabled={empty}
      >
        <Trash2 aria-hidden size={20} strokeWidth={1.8} /> Видалити всі дані
      </Button>
      {done && (
        <p className={styles.success} role="status">
          <CircleCheck aria-hidden size={20} strokeWidth={1.8} />
          Усі дані видалено. Тепер можна імпортувати файл.
        </p>
      )}
      {open && (
        <ConfirmDialog
          summary={`${countLabel(db.panels.length, RECORD_FORMS)} і ${countLabel(db.analytes.length, ANALYTE_FORMS)}`}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            updateDb(() => emptyDb());
            setOpen(false);
            setDone(true);
          }}
        />
      )}
    </section>
  );
}

function ConfirmDialog({
  summary,
  onCancel,
  onConfirm,
}: {
  summary: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [word, setWord] = useState('');
  const matches = word.trim().toLowerCase() === CONFIRM_WORD;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (matches) onConfirm();
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="delete-all-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form className={styles.form} onSubmit={submit}>
        <h2 id="delete-all-dialog-title" className={styles.dialogTitle}>
          Видалити всі дані?
        </h2>
        <p className={styles.muted}>
          Буде стерто {summary}. Дані на сайті не зміняться, доки ви не завантажите новий data.enc;
          тут їх можна повернути з резервної копії JSON.
        </p>
        <TextField
          label={`Щоб підтвердити, введіть слово «${CONFIRM_WORD}»`}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoFocus
        />
        <Button type="submit" variant="danger" disabled={!matches}>
          <Trash2 aria-hidden size={20} strokeWidth={1.8} /> Видалити все
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Скасувати
        </Button>
      </form>
    </dialog>
  );
}
