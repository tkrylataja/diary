import type { LucideIcon } from 'lucide-react';
import { useId, type ChangeEvent } from 'react';
import styles from './FileButton.module.css';

type Props = {
  label: string;
  icon: LucideIcon;
  accept: string;
  onFile: (file: File) => void;
};

/** Кнопка вибору файлу: справжній <input type="file">, прихований за підписом-кнопкою. */
export function FileButton({ label, icon: Icon, accept, onFile }: Props) {
  const id = useId();

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Скидаємо значення, щоб той самий файл можна було обрати ще раз.
    e.target.value = '';
    if (file) onFile(file);
  }

  return (
    <>
      <label htmlFor={id} className={styles.button}>
        <Icon aria-hidden size={20} strokeWidth={1.8} />
        {label}
      </label>
      <input id={id} type="file" accept={accept} className="visually-hidden" onChange={onChange} />
    </>
  );
}
