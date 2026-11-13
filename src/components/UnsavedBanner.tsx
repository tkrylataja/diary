import { CircleAlert, CircleCheck, Download, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatDateTime, plural } from '../lib/format';
import { useDb } from '../state/dbContext';
import { useSaveEncrypted } from '../state/useSaveEncrypted';
import styles from './UnsavedBanner.module.css';

/**
 * Плашка на всіх екранах: дані живуть лише в пам'яті, тож після будь-якої зміни
 * потрібно завантажити data.enc і замінити його в репозиторії.
 */
export function UnsavedBanner() {
  const { dirty, dirtySince, newRecords } = useDb();
  const { save, saving, error } = useSaveEncrypted();
  const [justSaved, setJustSaved] = useState(false);

  if (dirty && dirtySince) {
    return (
      <div className={styles.banner} role="status" data-print="hide">
        <div className={styles.head}>
          <CircleAlert aria-hidden size={22} strokeWidth={1.8} />
          <div className={styles.text}>
            <strong>Є незбережені зміни</strong>
            <span className={styles.sub}>
              {newRecords > 0
                ? `${newRecords} ${plural(newRecords, ['новий запис', 'нові записи', 'нових записів'])} від ${formatDateTime(dirtySince)}`
                : `Зміни від ${formatDateTime(dirtySince)}`}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.action}
          onClick={() => void save().then((ok) => setJustSaved(ok))}
          disabled={saving}
          aria-busy={saving}
        >
          <Download aria-hidden size={20} strokeWidth={1.8} />
          {saving ? 'Шифрую…' : 'Завантажити data.enc'}
        </button>
        <p className={styles.note}>
          Замініть файл у <code>public/</code> репозиторію й зробіть коміт, інакше зміни зникнуть
          після перезавантаження сторінки. <Link to="/data">Як оновити сайт</Link>
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (justSaved) {
    return (
      <div className={`${styles.banner} ${styles.saved}`} role="status" data-print="hide">
        <div className={styles.head}>
          <CircleCheck aria-hidden size={22} strokeWidth={1.8} />
          <div className={styles.text}>
            <strong>data.enc завантажено</strong>
            <span className={styles.sub}>
              Тепер замініть ним <code>public/data.enc</code> і зробіть коміт (або{' '}
              <code>npm run deploy-data</code>).
            </span>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={() => setJustSaved(false)}
            aria-label="Закрити"
          >
            <X aria-hidden size={20} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
