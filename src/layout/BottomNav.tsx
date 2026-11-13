import { ChartSpline, Database, ListChecks, Plus, type LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import styles from './BottomNav.module.css';

type Tab = { to: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const TABS: Tab[] = [
  {
    to: '/',
    label: 'Аналізи',
    icon: ListChecks,
    match: (p) => p === '/' || p.startsWith('/panel'),
  },
  { to: '/trends', label: 'Динаміка', icon: ChartSpline, match: (p) => p.startsWith('/trends') },
  { to: '/add', label: 'Додати', icon: Plus, match: (p) => p.startsWith('/add') },
  { to: '/data', label: 'Дані', icon: Database, match: (p) => p.startsWith('/data') },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className={styles.nav} aria-label="Розділи" data-print="hide">
      <ul className={styles.list}>
        {TABS.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to}>
              <NavLink
                to={to}
                className={styles.tab}
                data-active={active || undefined}
                aria-current={active ? 'page' : undefined}
              >
                <span className={styles.tile}>
                  <Icon aria-hidden size={22} strokeWidth={1.8} />
                </span>
                <span className={styles.label}>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
