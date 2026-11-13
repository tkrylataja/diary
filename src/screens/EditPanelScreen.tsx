import { FileQuestion, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Button, ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PanelForm } from '../components/PanelForm';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { deletePanel } from '../data/mutations';
import { draftFromPanel } from '../data/panelDraft';
import { formatDate } from '../lib/format';
import { useDb } from '../state/dbContext';

/** Редагування й видалення запису. */
export function EditPanelScreen() {
  const { id } = useParams();
  const { db, updateDb } = useDb();
  const navigate = useNavigate();
  const location = useLocation();
  const panel = db.panels.find((p) => p.id === id);
  // Чернетка береться один раз при відкритті, далі живе у формі.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => (panel ? draftFromPanel(panel) : undefined), [panel?.id]);

  if (!panel || !initial) {
    return (
      <Screen>
        <ScreenHeader title="Запис не знайдено" back />
        <EmptyState
          icon={FileQuestion}
          title="Такого запису немає"
          text="Можливо, його видалено. Поверніться до списку аналізів."
          action={<ButtonLink to="/">До списку</ButtonLink>}
        />
      </Screen>
    );
  }

  function remove() {
    if (!panel) return;
    const ok = window.confirm(
      `Видалити запис за ${formatDate(panel.date)}? Після збереження файлу data.enc його не можна буде відновити.`,
    );
    if (!ok) return;
    updateDb((current) => deletePanel(current, panel.id));
    navigate('/', { replace: true });
  }

  return (
    <Screen>
      <ScreenHeader title="Редагувати запис" subtitle={formatDate(panel.date)} back />
      <PanelForm
        initial={initial}
        existing={panel}
        submitLabel="Зберегти зміни"
        onSaved={(savedId) =>
          // Повертаємося на екран запису, з якого прийшли; за прямим посиланням — відкриваємо його.
          location.key === 'default'
            ? navigate(`/panel/${encodeURIComponent(savedId)}`, { replace: true })
            : navigate(-1)
        }
        footer={
          <Button variant="danger" onClick={remove}>
            <Trash2 aria-hidden size={20} strokeWidth={1.8} /> Видалити запис
          </Button>
        }
      />
    </Screen>
  );
}
