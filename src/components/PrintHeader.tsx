import { formatDateLong } from '../lib/format';
import styles from './PrintHeader.module.css';

/** Шапка, що з'являється лише на папері: що це й коли надруковано (SPEC §8). */
export function PrintHeader({ title, details }: { title?: string; details?: string }) {
  return (
    <div className={`print-only ${styles.header}`}>
      <p className={styles.app}>Щоденник аналізів · надруковано {formatDateLong(new Date())}</p>
      {title && <p className={styles.title}>{title}</p>}
      {details && <p className={styles.details}>{details}</p>}
    </div>
  );
}
