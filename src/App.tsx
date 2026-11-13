import { HashRouter, Route, Routes } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { AddScreen } from './screens/AddScreen';
import { AnalyteEditScreen } from './screens/AnalyteEditScreen';
import { AnalytesScreen } from './screens/AnalytesScreen';
import { EditPanelScreen } from './screens/EditPanelScreen';
import { PanelScreen } from './screens/PanelScreen';
import { PanelsScreen } from './screens/PanelsScreen';
import { DataScreen } from './screens/DataScreen';
import { TrendsScreen } from './screens/TrendsScreen';
import { SessionGate } from './state/SessionGate';

export function App() {
  return (
    <SessionGate>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<PanelsScreen />} />
            <Route path="panel/:id" element={<PanelScreen />} />
            <Route path="panel/:id/edit" element={<EditPanelScreen />} />
            <Route path="trends" element={<TrendsScreen />} />
            <Route path="trends/:analyteId" element={<TrendsScreen />} />
            <Route path="add" element={<AddScreen />} />
            <Route path="data" element={<DataScreen />} />
            <Route path="data/analytes" element={<AnalytesScreen />} />
            <Route path="data/analytes/:id" element={<AnalyteEditScreen />} />
            <Route path="*" element={<PanelsScreen />} />
          </Route>
        </Routes>
      </HashRouter>
    </SessionGate>
  );
}
