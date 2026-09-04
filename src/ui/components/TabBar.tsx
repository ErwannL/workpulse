import { IconCalendar, IconPulse, IconSettings, IconStats, IconWeek } from '@/ui/icons';
import type { Route } from '@/ui/router';

const TABS: { route: Route; label: string; Icon: typeof IconPulse }[] = [
  { route: 'pulse', label: 'Aujourd’hui', Icon: IconPulse },
  { route: 'semaine', label: 'Semaine', Icon: IconWeek },
  { route: 'calendrier', label: 'Calendrier', Icon: IconCalendar },
  { route: 'stats', label: 'Stats', Icon: IconStats },
  { route: 'reglages', label: 'Réglages', Icon: IconSettings },
];

export function TabBar({ route, onNavigate }: { route: Route; onNavigate: (r: Route) => void }) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map(({ route: r, label, Icon }) => (
        <button
          key={r}
          type="button"
          className="tab"
          aria-current={r === route ? 'page' : undefined}
          onClick={() => onNavigate(r)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
