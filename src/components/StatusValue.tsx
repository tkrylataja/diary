import { statusArrow, type Status } from '../data/status';
import styles from './StatusValue.module.css';

const STATUS_TEXT: Partial<Record<Status, string>> = {
  high: 'вище норми',
  low: 'нижче норми',
};

type Props = { value: string; unit?: string; status: Status; size?: 'large' | 'medium' };

/** Значення з одиницями; поза нормою — колір і стрілка ↑/↓ (колір не єдина ознака). */
export function StatusValue({ value, unit, status, size = 'large' }: Props) {
  const arrow = statusArrow(status);
  return (
    <span className={`${styles.value} ${styles[size]}`} data-status={status}>
      <span className={styles.number}>
        {value}
        {arrow && (
          <span className={styles.arrow} aria-hidden>
            {arrow}
          </span>
        )}
      </span>
      {unit && <span className={styles.unit}>{unit}</span>}
      {STATUS_TEXT[status] && <span className="visually-hidden">, {STATUS_TEXT[status]}</span>}
    </span>
  );
}
