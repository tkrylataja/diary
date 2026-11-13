import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { PanelForm } from '../components/PanelForm';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { emptyDraft } from '../data/panelDraft';
import { todayIso } from '../lib/format';

/** Новий запис (SPEC §6.5). */
export function AddScreen() {
  const navigate = useNavigate();
  const initial = useMemo(() => emptyDraft(todayIso()), []);
  return (
    <Screen>
      <ScreenHeader title="Новий запис" />
      <PanelForm
        initial={initial}
        submitLabel="Зберегти запис"
        onSaved={(id) => navigate(`/panel/${encodeURIComponent(id)}`, { replace: true })}
      />
    </Screen>
  );
}
