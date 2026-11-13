export const MIN_PASSWORD_LENGTH = 12;

export type StrengthLevel = 0 | 1 | 2 | 3;

export type PasswordStrength = {
  /** 0 — закороткий, 1 — слабкий, 2 — середній, 3 — надійний */
  level: StrengthLevel;
  label: string;
  acceptable: boolean;
};

const COMMON = ['password', 'qwerty', '12345', 'пароль', 'йцукен', 'admin', 'letmein'];

function poolSize(password: string): number {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[а-яіїєґё']/.test(password)) pool += 33;
  if (/[А-ЯІЇЄҐЁ]/.test(password)) pool += 33;
  if (/\d/.test(password)) pool += 10;
  if (/\s/.test(password)) pool += 1;
  if (/[^a-zA-Zа-яА-ЯіїєґёІЇЄҐЁ'\d\s]/u.test(password)) pool += 33;
  return Math.max(pool, 1);
}

/**
 * Груба оцінка надійності без зовнішніх бібліотек. Повтори символів знижують оцінку,
 * поширені шаблони не можуть бути кращими за «слабкий».
 */
export function estimateStrength(password: string): PasswordStrength {
  const chars = [...password];
  if (chars.length < MIN_PASSWORD_LENGTH) {
    return {
      level: 0,
      label: `Закороткий: щонайменше ${MIN_PASSWORD_LENGTH} символів`,
      acceptable: false,
    };
  }
  const unique = new Set(chars.map((c) => c.toLowerCase())).size;
  const effectiveLength = Math.min(chars.length, unique * 2);
  const bits = effectiveLength * Math.log2(poolSize(password));
  const lower = password.toLowerCase();
  const common = COMMON.some((p) => lower.includes(p));

  if (common || bits < 50) return { level: 1, label: 'Слабкий', acceptable: false };
  if (bits < 75) return { level: 2, label: 'Середній', acceptable: true };
  return { level: 3, label: 'Надійний', acceptable: true };
}
