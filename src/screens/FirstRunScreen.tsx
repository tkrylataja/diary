import { DatabaseZap } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { PasswordField } from '../components/PasswordField';
import { StrengthMeter } from '../components/StrengthMeter';
import { deriveKey, type SessionKey } from '../crypto/crypto';
import { emptyDb, type Db } from '../data/types';
import { estimateStrength } from '../lib/passwordStrength';

type Props = {
  onCreated: (db: Db, session: SessionKey) => void;
};

export function FirstRunScreen({ onCreated }: Props) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [repeatError, setRepeatError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const strength = estimateStrength(password);
    const nextPasswordError = strength.acceptable
      ? undefined
      : `Пароль надто простий (${strength.label.toLowerCase()}). Додайте ще слів.`;
    const nextRepeatError = repeat !== password ? 'Паролі не збігаються' : undefined;
    setPasswordError(nextPasswordError);
    setRepeatError(nextRepeatError);
    if (nextPasswordError || nextRepeatError) return;

    setBusy(true);
    const session = await deriveKey(password);
    setPassword('');
    setRepeat('');
    onCreated(emptyDb(), session);
  }

  return (
    <AuthLayout
      icon={DatabaseZap}
      title="Створити нову базу"
      lead="Файл data.enc не знайдено. Задайте пароль, яким буде зашифровано ваші дані."
      footer={<p>Якщо пароль втрачено, дані відновити неможливо.</p>}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="stack">
          <PasswordField
            label="Пароль"
            name="new-password"
            autoComplete="new-password"
            autoFocus
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(undefined);
            }}
            error={passwordError}
            hint={
              <div className="stack-sm">
                <p>
                  Використайте фразу з 4–5 слів. Файл буде публічним у зашифрованому вигляді, тому
                  пароль має бути довгим.
                </p>
                <StrengthMeter password={password} />
              </div>
            }
          />
          <PasswordField
            label="Повторіть пароль"
            name="repeat-password"
            autoComplete="new-password"
            required
            value={repeat}
            onChange={(e) => {
              setRepeat(e.target.value);
              setRepeatError(undefined);
            }}
            error={repeatError}
          />
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? 'Створюю…' : 'Створити'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
