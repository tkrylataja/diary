import { useCallback } from 'react';
import { useDb } from './dbContext';

/** «Заблокувати» з попередженням, якщо є незбережені зміни. */
export function useLockWithConfirm() {
  const { dirty, lock } = useDb();
  return useCallback(() => {
    if (
      dirty &&
      !window.confirm(
        'Є незбережені зміни. Після блокування їх буде втрачено. Спершу збережіть файл у розділі «Дані». Заблокувати все одно?',
      )
    ) {
      return;
    }
    lock();
  }, [dirty, lock]);
}
