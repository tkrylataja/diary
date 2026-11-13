import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { BottomNav } from './BottomNav';
import styles from './AppLayout.module.css';

/** Перший сегмент шляху: /trends/prolactin → trends. */
function section(pathname: string): string {
  return pathname.split('/')[1] ?? '';
}

export function AppLayout() {
  const { pathname } = useLocation();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const prev = previous.current;
    previous.current = pathname;
    // Новий екран відкривається з початку, а не з місця прокрутки попереднього.
    window.scrollTo(0, 0);
    // Фокус на заголовок нового екрана, щоб програма читання екрана його оголосила.
    // Зміна показника в «Динаміці» — той самий екран, фокус лишається в полі вибору.
    if (prev !== null && section(prev) === 'trends' && section(pathname) === 'trends') return;
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <Outlet />
      <BottomNav />
    </div>
  );
}
