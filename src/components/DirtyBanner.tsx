import { CircleAlert } from 'lucide-react';
import { Link } from 'react-router';
import styles from './DirtyBanner.module.css';

/** Нагадування, що зміни ще не збережено в data.enc. */
export function DirtyBanner() {
  return (
    <Link to="/data" className={styles.banner} data-print="hide">
      <CircleAlert aria-hidden size={22} strokeWidth={1.8} />
      <span>
        <strong>Є незбережені зміни.</strong> Збережіть зашифрований файл у розділі «Дані».
      </span>
    </Link>
  );
}
