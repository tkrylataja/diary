import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import styles from './Field.module.css';

type Common = { label: string; hint?: ReactNode; error?: string };

function describedBy(hintId: string, errorId: string, hint: unknown, error: unknown) {
  return [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
}

function Messages({
  hintId,
  errorId,
  hint,
  error,
}: { hintId: string; errorId: string } & Omit<Common, 'label'>) {
  return (
    <>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}

export function TextField({
  label,
  hint,
  error,
  id: idProp,
  className,
  ...input
}: Common & ComponentPropsWithRef<'input'>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
        {...input}
      />
      <Messages hintId={hintId} errorId={errorId} hint={hint} error={error} />
    </div>
  );
}

export function TextArea({
  label,
  hint,
  error,
  ...textarea
}: Common & ComponentPropsWithRef<'textarea'>) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <textarea
        id={id}
        className={`${styles.input} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
        {...textarea}
      />
      <Messages hintId={hintId} errorId={errorId} hint={hint} error={error} />
    </div>
  );
}
