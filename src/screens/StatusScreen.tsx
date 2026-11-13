import { CloudOff, LoaderCircle } from 'lucide-react';
import { IconTile } from '../components/IconTile';
import { Button } from '../components/Button';
import styles from './StatusScreen.module.css';

export function LoadingScreen() {
  return (
    <main className={styles.screen} aria-busy="true">
      <IconTile icon={LoaderCircle} />
      <p className={styles.text}>Завантаження…</p>
    </main>
  );
}

export function LoadErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className={styles.screen}>
      <IconTile icon={CloudOff} />
      <h1 className={styles.title}>Не вдалося завантажити дані</h1>
      <p className={styles.text}>Перевірте з'єднання з інтернетом і спробуйте ще раз.</p>
      <div className={styles.action}>
        <Button onClick={onRetry}>Спробувати ще раз</Button>
      </div>
    </main>
  );
}
