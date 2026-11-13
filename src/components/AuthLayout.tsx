import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconTile } from './IconTile';
import styles from './AuthLayout.module.css';

type Props = {
  icon: LucideIcon;
  title: string;
  lead: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/** Каркас екранів розблокування й першого запуску. */
export function AuthLayout({ icon, title, lead, children, footer }: Props) {
  return (
    <main className={styles.screen}>
      <div className={styles.column}>
        <header className={styles.header}>
          <IconTile icon={icon} />
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </header>
        <div className={styles.card}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </main>
  );
}
