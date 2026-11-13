import { ArrowLeft, Pencil, Printer } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import styles from './ScreenHeader.module.css';

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** Показати кнопку «Назад» (на попередній екран або на головну). */
  back?: boolean;
  /** Посилання «Редагувати». */
  editTo?: string;
  /** Показати кнопку друку. */
  print?: boolean;
  /** Назва вкладки браузера (і файлу PDF при друці), якщо відрізняється від title. */
  pageTitle?: string;
};

export function ScreenHeader({ title, subtitle, back, editTo, print, pageTitle }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const documentTitle = `${pageTitle ?? title} · Щоденник аналізів`;

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <header className={styles.header}>
      {(back || editTo || print) && (
        <div className={styles.toolbar} data-print="hide">
          {back && (
            <button
              type="button"
              className={styles.iconButton}
              // Якщо екран відкрито за прямим посиланням, історії немає — ведемо на головну.
              onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))}
            >
              <ArrowLeft aria-hidden size={22} strokeWidth={1.8} />
              <span>Назад</span>
            </button>
          )}
          <span className={styles.push} />
          {editTo && (
            <Link to={editTo} className={styles.iconButton}>
              <Pencil aria-hidden size={20} strokeWidth={1.8} />
              <span>Редагувати</span>
            </Link>
          )}
          {print && (
            <button type="button" className={styles.iconButton} onClick={() => window.print()}>
              <Printer aria-hidden size={22} strokeWidth={1.8} />
              <span>Друк</span>
            </button>
          )}
        </div>
      )}
      {/* tabIndex -1: сюди переводиться фокус при переході на екран (AppLayout). */}
      <h1 className={styles.title} tabIndex={-1}>
        {title}
      </h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  );
}
