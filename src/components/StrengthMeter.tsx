import { estimateStrength } from '../lib/passwordStrength';
import styles from './StrengthMeter.module.css';

export function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { level, label } = estimateStrength(password);
  return (
    <div className={styles.meter} data-level={level}>
      <div className={styles.bars} aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={styles.bar} data-on={level >= n ? true : undefined} />
        ))}
      </div>
      <p className={styles.label} aria-live="polite">
        Надійність: {label}
      </p>
    </div>
  );
}
