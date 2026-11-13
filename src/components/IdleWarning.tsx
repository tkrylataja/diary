import { TimerReset } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { IconTile } from './IconTile';
import styles from './IdleWarning.module.css';

/** Модальне попередження перед автоблокуванням, коли є незбережені зміни. */
export function IdleWarning({
  secondsLeft,
  onContinue,
}: {
  secondsLeft: number;
  onContinue: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="idle-title"
      aria-describedby="idle-text"
      onCancel={(e) => {
        // Escape = «продовжити роботу».
        e.preventDefault();
        onContinue();
      }}
    >
      <IconTile icon={TimerReset} />
      <h2 id="idle-title" className={styles.title}>
        Застосунок скоро заблокується
      </h2>
      <p id="idle-text" className={styles.text}>
        Ви не користувалися застосунком 10 хвилин. Через <strong>{secondsLeft} с</strong> дані буде
        стерто з пам’яті, а незбережені зміни втрачено.
      </p>
      <Button onClick={onContinue} autoFocus>
        Продовжити роботу
      </Button>
    </dialog>
  );
}
