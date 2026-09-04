import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { buildWeeks, periodStats } from '@/core/ledger';
import {
  addDays,
  endOfWeek,
  formatClockish,
  formatSigned,
  isoWeekNumber,
  monthDays,
  monthName,
  startOfWeek,
  todayISO,
} from '@/core/time';
import { Card, Empty, Row } from '@/ui/components/primitives';

type Period = 'week' | 'month' | 'all';

export function StatsScreen() {
  const store = useStore();
  const [period, setPeriod] = useState<Period>('month');
  const today = todayISO(store.now);

  const [from, to, label] = useMemo<[string, string, string]>(() => {
    if (period === 'week') {
      const monday = startOfWeek(today);
      return [monday, endOfWeek(monday), `Semaine ${isoWeekNumber(today)}`];
    }
    if (period === 'month') {
      const days = monthDays(today);
      return [days[0], days[days.length - 1], monthName(today)];
    }
    return [store.settings.trackingStart, today, 'Depuis le début du suivi'];
  }, [period, today, store.settings.trackingStart]);

  const stats = useMemo(() => periodStats(store.source, from, to), [store.source, from, to]);

  // Les douze dernières semaines, pour lire la tendance du solde.
  const weeks = useMemo(() => {
    const first = startOfWeek(addDays(today, -7 * 11));
    const start = first < store.settings.trackingStart ? store.settings.trackingStart : first;
    return buildWeeks(store.source, start, today);
  }, [store.source, today, store.settings.trackingStart]);

  const maxAbs = Math.max(30, ...weeks.map((w) => Math.abs(w.difference)));

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title">Statistiques</h1>
          <p className="topbar__sub" style={{ textTransform: 'capitalize' }}>
            {label}
          </p>
        </div>
      </header>

      <main className="app__main">
        <div className="segmented" role="group">
          {(
            [
              ['week', 'Semaine'],
              ['month', 'Mois'],
              ['all', 'Total'],
            ] as [Period, string][]
          ).map(([p, l]) => (
            <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {l}
            </button>
          ))}
        </div>

        <div className="grid2">
          <div className="metric">
            <div className="metric__value">{formatClockish(stats.workedMinutes)}</div>
            <div className="metric__label">Heures travaillées</div>
          </div>
          <div className="metric">
            <div className="metric__value">{formatClockish(stats.plannedMinutesElapsed)}</div>
            <div className="metric__label">Heures théoriques à ce jour</div>
          </div>
          <div className="metric">
            <div className={`metric__value ${stats.balance >= 0 ? 'value-pos' : 'value-neg'}`}>
              {formatSigned(stats.balance)}
            </div>
            <div className="metric__label">Solde de la période</div>
          </div>
          <div className="metric">
            <div className="metric__value">{stats.workedDays}</div>
            <div className="metric__label">Jours travaillés</div>
          </div>
        </div>

        <Card title="Compteur de jours">
          <div className="rows">
            <Row label="Jours ouvrés" value={stats.plannedDays} />
            <Row label="Jours travaillés" value={stats.workedDays} />
            <Row label="Congés et RTT" value={stats.leaveDays} />
            <Row label="Jours fériés" value={stats.holidayDays} />
            <Row label="Absences" value={stats.absenceDays} />
          </div>
        </Card>

        <Card title="Solde par semaine">
          {weeks.length === 0 ? (
            <Empty>Pas encore assez d’historique.</Empty>
          ) : (
            <>
              <div className="spark" style={{ height: 96, alignItems: 'center' }}>
                {weeks.map((w) => {
                  const h = (Math.abs(w.difference) / maxAbs) * 42;
                  const positive = w.difference >= 0;
                  return (
                    <div
                      className="spark__col"
                      key={w.key}
                      style={{ justifyContent: 'center', gap: 2 }}
                      title={`${w.key} — ${formatSigned(w.difference)}`}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: Math.max(2, positive ? h : 0),
                          alignSelf: 'flex-end',
                          borderRadius: '4px 4px 0 0',
                          background: 'linear-gradient(180deg, var(--mint), var(--mint-dim))',
                          opacity: positive ? 1 : 0,
                        }}
                      />
                      <div style={{ height: 1, width: '100%', background: 'var(--hairline-strong)' }} />
                      <div
                        style={{
                          width: '100%',
                          height: Math.max(2, positive ? 0 : h),
                          borderRadius: '0 0 4px 4px',
                          background: 'linear-gradient(180deg, var(--amber), var(--coral))',
                          opacity: positive ? 0 : 1,
                        }}
                      />
                      <span className="spark__label">{isoWeekNumber(w.monday)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="small muted center" style={{ marginTop: 10 }}>
                Solde cumulé actuel :{' '}
                <strong className={weeks[weeks.length - 1].carryOut >= 0 ? 'value-pos' : 'value-neg'}>
                  {formatSigned(weeks[weeks.length - 1].carryOut)}
                </strong>
              </p>
            </>
          )}
        </Card>
      </main>
    </>
  );
}
