import type { LucideIcon } from 'lucide-react';
import styles from './IconTile.module.css';

export function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className={styles.tile} aria-hidden>
      <Icon size={24} strokeWidth={1.8} />
    </span>
  );
}
