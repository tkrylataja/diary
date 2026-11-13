import type { ReactNode } from 'react';
import styles from './Screen.module.css';

/** Колонка екрана: до 480 px на телефоні, до 720 px на планшеті. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className={styles.screen}>
      <div className={styles.column}>{children}</div>
    </main>
  );
}
