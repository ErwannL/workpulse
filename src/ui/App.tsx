import { useEffect } from 'react';
import { useStore } from '@/state/store';
import { useRoute } from '@/ui/router';
import { TabBar } from '@/ui/components/TabBar';
import { Dashboard } from '@/ui/screens/Dashboard';
import { WeekScreen } from '@/ui/screens/WeekScreen';
import { CalendarScreen } from '@/ui/screens/CalendarScreen';
import { StatsScreen } from '@/ui/screens/StatsScreen';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';

export function App() {
  const [route, navigate] = useRoute();
  const { ready, toast } = useStore();

  // Chaque changement d'onglet repart du haut de la page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  if (!ready) {
    return (
      <div className="app">
        <div className="empty" style={{ paddingTop: '35vh' }}>
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {route === 'pulse' && <Dashboard />}
      {route === 'semaine' && <WeekScreen />}
      {route === 'calendrier' && <CalendarScreen />}
      {route === 'stats' && <StatsScreen />}
      {route === 'reglages' && <SettingsScreen />}
      <TabBar route={route} onNavigate={navigate} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
