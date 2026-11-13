export type DataFileResult =
  | { status: 'missing' }
  | { status: 'found'; text: string; updatedAt: Date | null }
  | { status: 'error' };

export const DATA_FILE_URL = `${import.meta.env.BASE_URL}data.enc`;

/**
 * Завантажує зашифрований файл із того ж сайту. 404 або порожній файл — «немає бази»
 * (екран першого запуску). HTML у відповіді — це SPA-fallback dev-сервера, теж «немає».
 */
export async function fetchDataFile(url: string = DATA_FILE_URL): Promise<DataFileResult> {
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch {
    return { status: 'error' };
  }
  if (response.status === 404) return { status: 'missing' };
  if (!response.ok) return { status: 'error' };
  if (response.headers.get('content-type')?.includes('text/html')) return { status: 'missing' };

  const text = await response.text();
  if (text.trim() === '') return { status: 'missing' };

  const lastModified = response.headers.get('last-modified');
  const updatedAt = lastModified ? new Date(lastModified) : null;
  return {
    status: 'found',
    text,
    updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
  };
}
