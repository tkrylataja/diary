import { ArrowRight } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Стрілка → справа; за замовчуванням є лише в головній кнопці. */
  arrow?: boolean;
};

function classes(variant: Variant, className?: string) {
  return [styles.button, styles[variant], className].filter(Boolean).join(' ');
}

export function Button({
  variant = 'primary',
  arrow = variant === 'primary',
  className,
  children,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button type={type} className={classes(variant, className)} {...rest}>
      <span>{children}</span>
      {arrow && <ArrowRight aria-hidden size={22} strokeWidth={2} />}
    </button>
  );
}

/** Посилання, що виглядає як кнопка (перехід на інший екран). */
export function ButtonLink({
  to,
  variant = 'primary',
  arrow = variant === 'primary',
  children,
}: {
  to: string;
  variant?: Variant;
  arrow?: boolean;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={classes(variant)}>
      <span>{children}</span>
      {arrow && <ArrowRight aria-hidden size={22} strokeWidth={2} />}
    </Link>
  );
}
