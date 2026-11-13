import { useState } from 'react';
import { downloadFile } from '../lib/download';
import { useDb } from './dbContext';

/** Шифрує дані й віддає data.enc на завантаження; після цього зміни вважаються збереженими. */
export function useSaveEncrypted() {
  const { exportEncrypted } = useDb();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(undefined);
    try {
      const { text, markSaved } = await exportEncrypted();
      downloadFile('data.enc', text, 'application/octet-stream');
      markSaved();
      return true;
    } catch {
      setError('Не вдалося зашифрувати дані. Спробуйте ще раз.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { save, saving, error };
}
