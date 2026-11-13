/** Віддає файл браузеру на збереження (у папку «Завантаження»). */
export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Даємо браузеру час почати завантаження, перш ніж звільнити посилання.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
