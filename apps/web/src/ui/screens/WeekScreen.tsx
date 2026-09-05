import { useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '@/state/context';
import { TREND_TOLERANCE, carryInFor, summarizeWeek } from '@workpulse/core';
import type { DaySummary } from '@workpulse/core';
import {
  addDays,
  clock,
  dayShort,
  formatClockish,
  formatDuration,
  formatSigned,
  fromISO,
  isoWeekNumber,
  monthName,
  startOfWeek,
  todayISO,
} from '@workpulse/core';
import { Card, Empty, Row } from '@/ui/components/primitives';
import { ProgressBar } from '@/ui/components/ProgressRing';
import { DayEditor } from '@/ui/components/DayEditor';
import { IconChevronLeft, IconChevronRight } from '@/ui/icons';

function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const a = fromISO(monday).getDate();
  const b = fromISO(sunday).getDate();
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  return sameMonth
    ? `${a} – ${b} ${monthName(monday)}`
    : `${a} ${monthName(monday).slice(0, 4)}. – ${b} ${monthName(sunday).slice(0, 4)}.`;
}

function DayRow({ day, onOpen }: { day: DaySummary; onOpen: () => void }) {
  const c = day.computation;
  const off = day.planned === 0 && day.worked === 0;

  return (
    <button type="button" className="row row--tappable" onClick={onOpen}>
      <span className="row__label">
        <strong style={{ color: 'var(--text)', width: 34, display: 'inline-block' }}>
          {dayShort(day.date)}
        </strong>
        {off ? (
          <span className="small">
            {day.holiday ? `🎉 ${day.holiday}` : day.status === 'WORK' ? '—' : statusText(day)}
          </span>
        ) : (
          <span className="small num">
            {c.firstIn ? clock(c.firstIn) : '—'}
            {c.breaks > 0 && ` · pause ${formatClockish(c.breaks)}`}
            {c.lastOut && ` · ${clock(c.lastOut)}`}
          </span>
        )}
      </span>
      <span className="row__value">
        {off ? (
          <span className="value-muted small">{day.planned === 0 ? '0h00' : ''}</span>
        ) : (
          <>
            <span>{formatClockish(day.worked)}</span>{' '}
            <span className={day.balance >= 0 ? 'value-pos small' : 'value-neg small'}>
              {formatSigned(day.balance)}
            </span>
          </>
        )}
      </span>
    </button>
  );
}

function statusText(day: DaySummary): string {
  switch (day.status) {
    case 'LEAVE':
      return '🌴 Congé';
    case 'RTT':
      return '🌴 RTT';
    case 'SICK':
      return '🤒 Maladie';
    case 'SPECIAL':
      return '📌 Exceptionnel';
    case 'REMOTE':
      return '🏡 Télétravail';
    case 'HOLIDAY':
      return '🎉 Jour férié';
    default:
      return '—';
  }
}

export function WeekScreen() {
  const store = useStore();
  const [monday, setMonday] = useState(() => startOfWeek(todayISO(store.now)));
  const [editing, setEditing] = useState<string | null>(null);

  const week = useMemo(
    () => summarizeWeek(store.source, monday, carryInFor(store.source, monday)),
    [store.source, monday],
  );

  // Les barres partagent une échelle commune, avec un repère à la journée type.
  const maxWorked = Math.max(...week.days.map((d) => d.worked), store.settings.dailyMinutes);
  const targetRatio = store.settings.dailyMinutes / maxWorked;
  const isCurrent = monday === startOfWeek(todayISO(store.now));

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title">Semaine {isoWeekNumber(monday)}</h1>
          <p className="topbar__sub">{weekLabel(monday)}</p>
        </div>
        <div className="topbar__slot">
          <button
            type="button"
            className="icon-btn"
            aria-label="Semaine précédente"
            onClick={() => setMonday(addDays(monday, -7))}
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Semaine suivante"
            onClick={() => setMonday(addDays(monday, 7))}
          >
            <IconChevronRight />
          </button>
        </div>
      </header>

      <main className="app__main">
        {!isCurrent && (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setMonday(startOfWeek(todayISO(store.now)))}
          >
            Revenir à la semaine en cours
          </button>
        )}

        <Card title="Compteur">
          <div className="rows">
            <Row label="Objectif" value={formatClockish(week.planned)} />
            <Row label="Réalisé" value={formatClockish(week.worked)} />
            <Row
              label="Différence"
              value={formatSigned(week.difference)}
              tone={week.difference >= 0 ? 'pos' : 'neg'}
            />
            <Row
              label="Report entrant"
              value={formatSigned(week.carryIn)}
              tone={week.carryIn >= 0 ? 'pos' : 'neg'}
            />
            <Row
              label="Solde reporté"
              value={formatSigned(week.carryOut)}
              tone={week.carryOut >= 0 ? 'pos' : 'neg'}
            />
            <Row
              label="Heures supplémentaires"
              value={`${formatSigned(week.overtime)} / ${formatSigned(week.overtimeCap)}`}
              tone={week.overtimeExceeded ? 'over' : week.overtime > 0 ? 'pos' : 'muted'}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <ProgressBar value={week.worked} target={week.planned} cap={week.overtimeCap} />
            <div className="bar__legend">
              <span>{formatClockish(week.worked)}</span>
              <span className="faint">
                {week.remainingToTarget > 0
                  ? `reste ${formatDuration(week.remainingToTarget)}`
                  : 'objectif atteint ✓'}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Répartition">
          <div className="spark spark--ruled" style={{ '--target': targetRatio } as CSSProperties}>
            {week.days.map((d) => {
              const height = maxWorked > 0 ? Math.max(3, (d.worked / maxWorked) * 100) : 3;
              // Le moteur tolère dix minutes autour de l'objectif avant de parler
              // d'avance ou de retard. La barre suit la même règle : deux minutes
              // de trop ne sont pas un dépassement, et les peindre en rouge
              // contredirait le « objectif atteint » affiché juste au-dessus.
              const over = d.planned > 0 && d.worked - d.planned > TREND_TOLERANCE;
              const off = d.planned === 0;
              return (
                <div className="spark__col" key={d.date}>
                  <div
                    className={`spark__bar${over ? ' spark__bar--over' : ''}${off && d.worked === 0 ? ' spark__bar--off' : ''}`}
                    style={{ height: `${d.worked === 0 ? 3 : height}%` }}
                    title={`${dayShort(d.date)} — ${formatClockish(d.worked)}`}
                  />
                  <span className="spark__label">{dayShort(d.date)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Journées">
          {week.days.every((d) => !d.hasActivity && d.planned === 0) ? (
            <Empty>Rien à afficher sur cette semaine.</Empty>
          ) : (
            <div className="rows">
              {week.days
                // Un jour férié n'a ni objectif ni pointage : sans cette condition
                // il disparaîtrait purement et simplement de la semaine.
                .filter((d) => d.planned > 0 || d.hasActivity || d.day || d.holiday)
                .map((d) => (
                  <DayRow key={d.date} day={d} onOpen={() => setEditing(d.date)} />
                ))}
            </div>
          )}
        </Card>
      </main>

      {editing && <DayEditor date={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
