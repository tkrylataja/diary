import { Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { PasswordField } from '../components/PasswordField';
import { DECRYPT_ERROR_MESSAGE, decrypt, type SessionKey } from '../crypto/crypto';
import { DbFormatError, parseDb } from '../data/validate';
import type { Db } from '../data/types';
import { formatDate } from '../lib/format';

type Props = {
  fileText: string;
  updatedAt: Date | null;
  onUnlocked: (db: Db, session: SessionKey) => void;
};

export function UnlockScreen({ fileText, updatedAt, onUnlocked }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const { data, session } = await decrypt(fileText, password);
      const db = parseDb(data);
      setPassword('');
      onUnlocked(db, session);
    } catch (err) {
      // Пароль правильний, але вміст не відповідає моделі — кажемо про це прямо.
      setError(err instanceof DbFormatError ? err.message : DECRYPT_ERROR_MESSAGE);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      icon={Lock}
      title="Щоденник аналізів"
      lead="Введіть пароль, щоб розшифрувати дані. Усе відбувається в цьому браузері, пароль нікуди не надсилається."
      footer={
        <>
          <p>Файл data.enc{updatedAt && ` · оновлено ${formatDate(updatedAt)}`}</p>
          <p>Якщо пароль втрачено, дані відновити неможливо.</p>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="stack">
          <PasswordField
            label="Пароль"
            name="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(undefined);
            }}
            error={error}
          />
          <Button type="submit" disabled={busy || !password} aria-busy={busy}>
            {busy ? 'Розшифровую…' : 'Відкрити'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
