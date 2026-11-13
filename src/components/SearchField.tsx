import { Search, X } from 'lucide-react';
import { useId } from 'react';
import styles from './SearchField.module.css';

type Props = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

export function SearchField({ label, placeholder, value, onChange }: Props) {
  const id = useId();
  return (
    <div className={styles.field} data-print="hide">
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <Search aria-hidden size={20} strokeWidth={1.8} className={styles.icon} />
      <input
        id={id}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange('')}
          aria-label="Очистити пошук"
        >
          <X aria-hidden size={20} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
