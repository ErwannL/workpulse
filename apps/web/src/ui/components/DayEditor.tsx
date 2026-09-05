import { useMemo, useState } from 'react';
import type { DateISO, DayPattern, DayStatus, EntryType } from '@workpulse/core';
import { DAY_PATTERN_LABEL, DAY_STATUS_LABEL, scheduleForDate } from '@workpulse/core';
import { summarizeDay } from '@workpulse/core';
import { atTimeOn, clock, formatClockish, formatLongDate, formatSigned } from '@workpulse/core';
import { useStore } from '@/state/context';
import { Row, Sheet } from './primitives';
import { IconPlus, IconTrash } from '@/ui/icons';

const ENTRY_LABEL: Record<EntryType, string> = {
  CLOCK_IN: 'Arrivée',
  BREAK_START: 'Début pause',
  BREAK_END: 'Retour de pause',
  CLOCK_OUT: 'Départ',
};

const ENTRY_ORDER: EntryType[] = ['CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT'];

const PATTERN_CHOICES: DayPattern[] = ['FULL', 'MORNING', 'AFTERNOON', 'OFF'];

const STATUS_CHOICES: DayStatus[] = [
  'WORK',
  'REMOTE',
  'LEAVE',
  'RTT',
  'SICK',
  'HOLIDAY',
  'SPECIAL',
  'OTHER',
];

function dotClass(type: EntryType): string {
  if (type === 'CLOCK_IN') return 'tl__dot tl__dot--in';
  if (type === 'CLOCK_OUT') return 'tl__dot tl__dot--out';
  return 'tl__dot tl__dot--break';
}

/**
 * Feuille d'édition d'une journée : correction des pointages, statut,
 * demi-journée et notes. C'est le seul endroit où l'on écrit à la main.
 */
export function DayEditor({ date, onClose }: { date: DateISO; onClose: () => void }) {
  const store = useStore();
  const [addType, setAddType] = useState<EntryType | null>(null);

  const summary = useMemo(() => summarizeDay(store.source, date), [store.source, date]);
  const entries = useMemo(
    () => [...(store.entries.get(date) ?? [])].sort((a, b) => a.at - b.at),
    [store.entries, date],
  );
  const day = store.days.get(date);
  const status = summary.status;
  const schedule = useMemo(
    () => scheduleForDate(date, day, store.settings),
    [date, day, store.settings],
  );
  const weekPattern = useMemo(
    () => scheduleForDate(date, undefined, store.settings).pattern,
    [date, store.settings],
  );

  const setStatus = async (next: DayStatus) => {
    if (next === 'WORK' && !summary.holiday) {
      await store.resetDay(date);
      return;
    }
    await store.setDay(date, { status: next, worksOnHoliday: false });
  };

  return (
    <Sheet
      title={formatLongDate(date)}
      subtitle={summary.holiday ? `🎉 ${summary.holiday}` : undefined}
      onClose={onClose}
    >
      <div className="stack">
        <div>
          <h3 className="card__title">Forme de cette journée</h3>
          <div className="chip-row">
            {PATTERN_CHOICES.map((p) => (
              <button
                key={p}
                type="button"
                className={`chip${schedule.pattern === p ? ' chip--accent' : ''}`}
                onClick={() =>
                  p === weekPattern
                    ? store.setDay(date, { pattern: undefined })
                    : store.setDay(date, { pattern: p })
                }
              >
                {DAY_PATTERN_LABEL[p]}
              </button>
            ))}
          </div>
          <p className="small faint" style={{ marginTop: 8 }}>
            {day?.pattern === undefined
              ? 'Suit la semaine type.'
              : `Exception pour ce jour — la semaine type prévoit « ${DAY_PATTERN_LABEL[weekPattern]} ».`}
          </p>
        </div>

        <div>
          <h3 className="card__title">Statut de la journée</h3>
          <div className="chip-row">
            {STATUS_CHOICES.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip${s === status ? ' chip--accent' : ''}`}
                onClick={() => setStatus(s)}
              >
                {DAY_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {summary.holiday && (
          <div className="field">
            <div>
              <div className="field__label">Je travaille ce jour férié</div>
              <div className="field__hint">Les heures sont alors comptées normalement.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(day?.worksOnHoliday)}
              aria-label="Travailler ce jour férié"
              className="switch"
              onClick={() =>
                store.setDay(date, { status: 'HOLIDAY', worksOnHoliday: !day?.worksOnHoliday })
              }
            />
          </div>
        )}

        <div className="rows">
          <Row label="Temps théorique" value={formatClockish(summary.planned)} />
          <Row label="Temps travaillé" value={formatClockish(summary.worked)} />
          <Row
            label="Solde du jour"
            value={formatSigned(summary.balance)}
            tone={summary.balance >= 0 ? 'pos' : 'neg'}
          />
          {summary.computation.breaks > 0 && (
            <Row label="Pause" value={formatClockish(summary.computation.breaks)} tone="muted" />
          )}
        </div>

        <div>
          <h3 className="card__title">
            <span>Pointages</span>
            {entries.length > 0 && <span className="faint">{entries.length}</span>}
          </h3>

          {entries.length === 0 && <p className="empty">Aucun pointage sur cette journée.</p>}

          <div className="timeline">
            {entries.map((e) => (
              <div className="tl" key={e.id}>
                <input
                  className="input"
                  style={{ minWidth: 0, width: 74, textAlign: 'center' }}
                  type="time"
                  value={clock(e.at)}
                  onChange={(ev) => {
                    if (ev.target.value) store.editEntry(e.id, atTimeOn(date, ev.target.value));
                  }}
                  aria-label={`Heure — ${ENTRY_LABEL[e.type]}`}
                />
                <span className="tl__rail">
                  <span className={dotClass(e.type)} />
                </span>
                <span>
                  <span className="tl__label">{ENTRY_LABEL[e.type]}</span>
                  {e.editedAt && e.originalAt && (
                    <span className="tl__meta"> · corrigé, initialement {clock(e.originalAt)}</span>
                  )}
                  {e.manual && !e.editedAt && <span className="tl__meta"> · saisi à la main</span>}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Supprimer ${ENTRY_LABEL[e.type]}`}
                  onClick={() => store.removeEntry(e.id)}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>

          {summary.computation.anomalies.length > 0 && (
            <p className="small faint" style={{ marginTop: 8 }}>
              ⚠️ {summary.computation.anomalies.join(' · ')}
            </p>
          )}

          <div className="chip-row" style={{ marginTop: 12 }}>
            {ENTRY_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip${addType === t ? ' chip--accent' : ''}`}
                onClick={() => setAddType(addType === t ? null : t)}
              >
                <IconPlus width={13} height={13} />
                {ENTRY_LABEL[t]}
              </button>
            ))}
          </div>

          {addType && (
            <div className="split" style={{ marginTop: 12 }}>
              <span className="small muted">Heure du pointage « {ENTRY_LABEL[addType]} »</span>
              <input
                className="input"
                type="time"
                autoFocus
                aria-label="Heure à ajouter"
                onChange={async (ev) => {
                  if (!ev.target.value) return;
                  await store.addEntry(date, addType, atTimeOn(date, ev.target.value));
                  setAddType(null);
                }}
              />
            </div>
          )}
        </div>

        <div>
          <h3 className="card__title">Note</h3>
          <input
            className="input input--wide"
            placeholder="Réunion tardive, déplacement…"
            defaultValue={day?.notes ?? ''}
            onBlur={(e) => store.setDay(date, { notes: e.target.value || undefined })}
          />
        </div>

        <div className="sheet__actions">
          <button type="button" className="btn btn--block" onClick={onClose}>
            Fermer
          </button>
          {(day || entries.length > 0) && (
            <button
              type="button"
              className="btn btn--block btn--danger"
              onClick={async () => {
                await store.resetDay(date);
                for (const e of entries) await store.removeEntry(e.id);
                store.notify('Journée réinitialisée.');
                onClose();
              }}
            >
              Réinitialiser la journée
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
