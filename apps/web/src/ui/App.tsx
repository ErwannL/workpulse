import { useEffect, useState } from 'react';
import { useStore } from '@/state/context';
import { useRoute } from '@/ui/router';
import { TabBar } from '@/ui/components/TabBar';
import { AlertBar } from '@/ui/components/AlertBar';
import { WhatsNew } from '@/ui/components/WhatsNew';
import { pendingRelease, readLastSeenVersion, writeLastSeenVersion } from '@/changelog';
import { Dashboard } from '@/ui/screens/Dashboard';
import { WeekScreen } from '@/ui/screens/WeekScreen';
import { CalendarScreen } from '@/ui/screens/CalendarScreen';
import { StatsScreen } from '@/ui/screens/StatsScreen';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';

export function App() {
  const [route, navigate] = useRoute();
  const { ready, toast } = useStore();
  const [news, setNews] = useState(() => pendingRelease());

  // Première installation : on retient la version sans rien afficher. Personne
  // n'a envie d'ouvrir une application par la liste de ses correctifs.
  useEffect(() => {
    if (readLastSeenVersion() === null) writeLastSeenVersion();
  }, []);

  // Chaque changement d'onglet repart du haut de la page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  if (!ready) {
    return (
      <div className="app">
        <div className="loader" role="status">
          <span className="loader__pulse" aria-hidden="true" />
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* La clé force le remontage : chaque écran rejoue son entrée, ce qui
          indique visuellement qu'on a changé de contexte. */}
      <div className="screen" key={route}>
        {route === 'pulse' && <Dashboard />}
        {route === 'semaine' && <WeekScreen />}
        {route === 'calendrier' && <CalendarScreen />}
        {route === 'stats' && <StatsScreen />}
        {route === 'reglages' && <SettingsScreen />}
      </div>
      <AlertBar />
      <TabBar route={route} onNavigate={navigate} />
      {toast && <div className="toast">{toast}</div>}
      {news.length > 0 && (
        <WhatsNew
          releases={news}
          onClose={() => {
            writeLastSeenVersion();
            setNews([]);
          }}
        />
      )}
    </div>
  );
}
