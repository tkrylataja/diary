import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileJson,
  FileUp,
  Lock,
  ShieldCheck,
  Tags,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { FileButton } from '../components/FileButton';
import { IconTile } from '../components/IconTile';
import { ImportCard } from '../components/ImportCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import type { Db } from '../data/types';
import { DbFormatError, parseDb } from '../data/validate';
import { downloadFile } from '../lib/download';
import { RECORD_FORMS, countLabel, formatDateLong, plural, todayIso } from '../lib/format';
import { useDb } from '../state/dbContext';
import { useLockWithConfirm } from '../state/useLockWithConfirm';
import styles from './DataScreen.module.css';

function formatDateTime(d: Date): string {
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${formatDateLong(d)}, ${time}`;
}

/** Дані: збереження файлу, імпорт, показники, резервна копія, інструкція (SPEC §6.6). */
export function DataScreen() {
  const { db, dirty, dirtySince, newRecords, exportEncrypted, updateDb } = useDb();
  const lock = useLockWithConfirm();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [restoreError, setRestoreError] = useState<string>();
  const [restored, setRestored] = useState<number | null>(null);

  async function saveEncrypted() {
    setSaving(true);
    setSaveError(undefined);
    try {
      const { text, markSaved } = await exportEncrypted();
      downloadFile('data.enc', text, 'application/octet-stream');
      markSaved();
      setSaved(true);
    } catch {
      setSaveError('Не вдалося зашифрувати дані. Спробуйте ще раз.');
    } finally {
      setSaving(false);
    }
  }

  function saveJson() {
    downloadFile(
      `backup-${todayIso()}.json`,
      JSON.stringify(db, null, 2) + '\n',
      'application/json',
    );
  }

  async function restoreJson(file: File) {
    setRestoreError(undefined);
    setRestored(null);
    let backup: Db;
    try {
      backup = parseDb(JSON.parse(await file.text()));
    } catch (err) {
      setRestoreError(
        err instanceof DbFormatError
          ? err.message
          : 'Це не схоже на резервну копію щоденника. Оберіть файл backup-….json.',
      );
      return;
    }
    const ok = window.confirm(
      `Замінити поточні дані (${countLabel(db.panels.length, RECORD_FORMS)}) копією з файлу «${file.name}» ` +
        `(${countLabel(backup.panels.length, RECORD_FORMS)})? Щоб зміни потрапили на сайт, ` +
        'потім збережіть файл data.enc.',
    );
    if (!ok) return;
    updateDb(() => backup);
    setRestored(backup.panels.length);
  }

  return (
    <Screen>
      <ScreenHeader title="Дані" />

      {dirty && dirtySince && (
        <div className={styles.dirty} role="status">
          <CircleAlert aria-hidden size={22} strokeWidth={1.8} />
          <span>
            <strong>Є незбережені зміни</strong>
            <span className={styles.dirtySub}>
              {newRecords > 0
                ? `${newRecords} ${plural(newRecords, ['новий запис', 'нові записи', 'нових записів'])} від ${formatDateTime(dirtySince)}`
                : `Зміни від ${formatDateTime(dirtySince)}`}
            </span>
          </span>
        </div>
      )}

      <section className={styles.card} aria-labelledby="save-title">
        <div className={styles.cardHead}>
          <IconTile icon={ShieldCheck} />
          <h2 id="save-title" className={styles.cardTitle}>
            Зберегти зашифрований файл
          </h2>
        </div>
        <p className={styles.muted}>
          Файл шифрується вашим паролем у цьому браузері. Щоб зміни з’явилися на сайті, замініть ним{' '}
          <code>public/data.enc</code> у репозиторії (інструкція внизу).
        </p>
        <Button onClick={() => void saveEncrypted()} disabled={saving} aria-busy={saving}>
          {saving ? 'Шифрую…' : 'Завантажити data.enc'}
        </Button>
        {saveError && (
          <p className={styles.error} role="alert">
            {saveError}
          </p>
        )}
        {saved && !dirty && (
          <p className={styles.success} role="status">
            <CircleCheck aria-hidden size={20} strokeWidth={1.8} />
            Файл data.enc завантажено. Тепер замініть ним старий у репозиторії.
          </p>
        )}
      </section>

      <ImportCard />

      <Link to="/data/analytes" className={styles.row}>
        <IconTile icon={Tags} />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>Показники та синоніми</span>
          <span className={styles.muted}>Назви, групи, об’єднання дублів</span>
        </span>
        <ChevronRight aria-hidden size={20} strokeWidth={1.8} />
      </Link>

      <section className={styles.card} aria-labelledby="backup-title">
        <div className={styles.cardHead}>
          <IconTile icon={FileJson} />
          <h2 id="backup-title" className={styles.cardTitle}>
            Резервна копія без шифрування (JSON)
          </h2>
        </div>
        <p className={styles.warning}>
          <TriangleAlert aria-hidden size={20} strokeWidth={1.8} />
          JSON читається без пароля. Тримайте лише на своєму пристрої, не додавайте в репозиторій.
        </p>
        <Button variant="secondary" onClick={saveJson}>
          Завантажити JSON
        </Button>
        <FileButton
          label="Відновити з JSON"
          icon={FileUp}
          accept=".json,application/json"
          onFile={(file) => void restoreJson(file)}
        />
        {restoreError && (
          <p className={styles.error} role="alert">
            {restoreError}
          </p>
        )}
        {restored !== null && (
          <p className={styles.success} role="status">
            <CircleCheck aria-hidden size={20} strokeWidth={1.8} />
            Відновлено: {countLabel(restored, RECORD_FORMS)}. Не забудьте зберегти файл data.enc.
          </p>
        )}
      </section>

      <Button variant="secondary" onClick={lock}>
        <Lock aria-hidden size={20} strokeWidth={1.8} /> Заблокувати
      </Button>

      <section className={styles.card} aria-labelledby="howto-title">
        <h2 id="howto-title" className={styles.cardTitle}>
          Як оновити сайт: покроково
        </h2>
        <ol className={styles.steps}>
          <li>
            <strong>Завантажте файл.</strong> Натисніть «Завантажити data.enc». Браузер збереже його
            в папку «Завантаження». Якщо назва стане «data (1).enc», перейменуйте на data.enc.
          </li>
          <li>
            <strong>Замініть файл у репозиторії.</strong> Скопіюйте data.enc із «Завантажень» у
            підпапку <code>public</code> проєкту й погодьтеся замінити старий.
          </li>
          <li>
            <strong>Перевірте, що змінився лише він:</strong> <code>git status</code> (має бути
            тільки <code>public/data.enc</code>).
          </li>
          <li>
            <strong>Коміт і відправка:</strong> <code>git add public/data.enc</code>,{' '}
            <code>git commit -m "Аналізи &lt;дата&gt;"</code>, <code>git push</code>.
          </li>
          <li>
            <strong>Зачекайте й перевірте.</strong> Через 1–2 хвилини відкрийте сайт, оновіть
            сторінку (Ctrl+Shift+R), введіть пароль і переконайтеся, що новий запис є. Стару вкладку
            закривайте тільки після цього.
          </li>
        </ol>
        <p className={styles.muted}>
          Запасний варіант без терміналу: github.com → папка <code>public</code> → Add file → Upload
          files → перетягнути <code>data.enc</code> → Commit changes.
        </p>
      </section>
    </Screen>
  );
}
