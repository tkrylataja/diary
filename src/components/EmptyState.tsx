import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconTile } from './IconTile';
import styles from './EmptyState.module.css';

type Props = { icon: LucideIcon; title: string; text?: ReactNode; action?: ReactNode };

export function EmptyState({ icon, title, text, action }: Props) {
  return (
    <div className={styles.empty}>
      <IconTile icon={icon} />
      <p className={styles.title}>{title}</p>
      {text && <p className={styles.text}>{text}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
