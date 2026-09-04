import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { periodStats, summarizeDay, type DaySummary } from '@/core/ledger';
import type { DayStatus } from '@/core/types';
import { DAY_STATUS_LABEL } from '@/core/types';
import {
  addMonths,
  fromISO,
  isoWeekday,
  monthDays,
  monthName,
  rangeDays,
  todayISO,
} from '@/core/time';
import { Card, Sheet } from '@/ui/components/primitives';
import { DayEditor } from '@/ui/components/DayEditor';
import { IconChevronLeft, IconChevronRight } from '@/ui/icons';

/**
 * Couleur de la pastille d'une journée. Une journée sans rien à signaler —
 * un week-end, un jour à venir — n'en reçoit aucune.
 */
function dotColor(day: DaySummary): string | null {
  if (day.status === 'HOLIDAY') return 'var(--violet)';
  if (day.status === 'LEAVE' || day.status === 'RTT') return 'var(--sky)';
  if (day.day && (day.status === 'SICK' || day.status === 'SPECIAL' || day.status === 'OTHER')) {
    return 'var(--text-faint)';
  }
  if (day.worked === 0) return null;
  if (day.planned > 0 && day.worked > day.planned + 5) return 'var(--amber)';
  if (day.planned > 0 && day.worked < day.planned - 5) return 'var(--coral)';
  return 'var(--mint)';
}

const POSE_CHOICES: DayStatus[] = ['LEAVE', 'RTT', 'SICK', 'SPECIAL', 'REMOTE'];

export function CalendarScreen() {
  const store = useStore();
  const today = todayISO(store.now);
  const [cursor, setCursor] = useState(() => `${today.slice(0, 7)}-01`);
  const [editing, setEditing] = useState<string | null>(null);
  const [rangeMode, setRangeMode] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [posing, setPosing] = useState(false);

  const days = useMemo(() => monthDays(cursor), [cursor]);
  const summaries = useMemo(
    () => new Map(days.map((d) => [d, summarizeDay(store.source, d)] as const)),
    [days, store.source],
  );
  const stats = useMemo(
    () => periodStats(store.source, days[0], days[days.length - 1]),
    [store.source, days],
  );

  const leadingBlanks = isoWeekday(days[0]) - 1;
  const selection = anchor && target ? rangeDays(anchor, target) : anchor ? [anchor] : [];

  const onCellClick = (date: string) => {
    if (!rangeMode) {
      setEditing(date);
      return;
    }
    if (!anchor || (anchor && target)) {
      setAnchor(date);
      setTarget(null);
    } else {
      setTarget(date);
    }
  };

  const applyStatus = async (status: DayStatus) => {
    await store.setRange(selection, { status, worksOnHoliday: false });
    store.notify(
      `${selection.length} journée${selection.length > 1 ? 's' : ''} — ${DAY_STATUS_LABEL[status]}.`,
    );
    setPosing(false);
    setRangeMode(false);
    setAnchor(null);
    setTarget(null);
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title" style={{ textTransform: 'capitalize' }}>
            {monthName(cursor)}
          </h1>
          <p className="topbar__sub">{fromISO(cursor).getFullYear()}</p>
        </div>
        <div className="topbar__slot">
          <button
            type="button"
            className="icon-btn"
            aria-label="Mois précédent"
            onClick={() => setCursor(addMonths(cursor, -1))}
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Mois suivant"
            onClick={() => setCursor(addMonths(cursor, 1))}
          >
            <IconChevronRight />
          </button>
        </div>
      </header>

      <main className="app__main">
        <Card>
          <div className="cal__head">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <span className="cal__dow" key={i}>
                {d}
              </span>
            ))}
          </div>
          <div className="cal__grid">
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {days.map((date) => {
              const s = summaries.get(date)!;
              const color = dotColor(s);
              const weekend = isoWeekday(date) > 5;
              const selected = selection.includes(date);
              const classes = [
                'cal__cell',
                weekend && s.worked === 0 && !s.day ? 'cal__cell--muted' : '',
                date === today ? 'cal__cell--today' : '',
                selected ? 'cal__cell--range' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  type="button"
                  key={date}
                  className={classes}
                  onClick={() => onCellClick(date)}
                  aria-label={date}
                >
                  <span>{fromISO(date).getDate()}</span>
                  <span className="cal__dots">
                    {color && <span className="cal__dot" style={{ background: color }} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="chip-row" style={{ marginTop: 16 }}>
            <span className="chip">
              <span className="cal__dot" style={{ background: 'var(--mint)' }} /> Travaillé
            </span>
            <span className="chip">
              <span className="cal__dot" style={{ background: 'var(--amber)' }} /> Heures sup
            </span>
            <span className="chip">
              <span className="cal__dot" style={{ background: 'var(--coral)' }} /> Incomplet
            </span>
            <span className="chip">
              <span className="cal__dot" style={{ background: 'var(--sky)' }} /> Congé
            </span>
            <span className="chip">
              <span className="cal__dot" style={{ background: 'var(--violet)' }} /> Férié
            </span>
          </div>
        </Card>

        {rangeMode ? (
          <Card className="card--accent">
            <p className="small">
              {!anchor
                ? 'Touche la première journée de la période.'
                : !target
                  ? 'Touche maintenant la dernière journée.'
                  : `${selection.length} journée${selection.length > 1 ? 's' : ''} sélectionnée${selection.length > 1 ? 's' : ''}.`}
            </p>
            <div className="punch punch--split" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setRangeMode(false);
                  setAnchor(null);
                  setTarget(null);
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={selection.length === 0}
                onClick={() => setPosing(true)}
              >
                Déclarer…
              </button>
            </div>
            {selection.length > 0 && (
              <button
                type="button"
                className="btn btn--block btn--ghost btn--sm"
                style={{ marginTop: 10 }}
                onClick={async () => {
                  await store.clearRange(selection);
                  store.notify('Journées remises à leur état par défaut.');
                  setRangeMode(false);
                  setAnchor(null);
                  setTarget(null);
                }}
              >
                Retirer le statut de ces journées
              </button>
            )}
          </Card>
        ) : (
          <button
            type="button"
            className="btn btn--block"
            onClick={() => {
              setRangeMode(true);
              setAnchor(null);
              setTarget(null);
            }}
          >
            Poser des congés ou une absence
          </button>
        )}

        <Card title={`Le mois de ${monthName(cursor)}`}>
          <div className="grid2">
            <div className="metric">
              <div className="metric__value">{stats.plannedDays}</div>
              <div className="metric__label">Jours ouvrés</div>
            </div>
            <div className="metric">
              <div className="metric__value">{stats.workedDays}</div>
              <div className="metric__label">Jours travaillés</div>
            </div>
            <div className="metric">
              <div className="metric__value">{stats.leaveDays}</div>
              <div className="metric__label">Congés / RTT</div>
            </div>
            <div className="metric">
              <div className="metric__value">{stats.holidayDays}</div>
              <div className="metric__label">Jours fériés</div>
            </div>
          </div>
        </Card>
      </main>

      {editing && <DayEditor date={editing} onClose={() => setEditing(null)} />}

      {posing && (
        <Sheet
          title="Déclarer ces journées"
          subtitle={`${selection.length} journée${selection.length > 1 ? 's' : ''}, du ${selection[0]} au ${selection[selection.length - 1]}`}
          onClose={() => setPosing(false)}
        >
          <div className="sheet__actions">
            {POSE_CHOICES.map((s) => (
              <button key={s} type="button" className="btn btn--block" onClick={() => applyStatus(s)}>
                {DAY_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
