import { useState } from 'react';
import {
  DAY_PATTERN_LABEL,
  formatClockish,
  hasBreak,
  parseHHMM,
  scheduleFromPattern,
  type DayPattern,
  type DaySchedule,
} from '@workpulse/core';
import { Field, Sheet } from './primitives';

const PATTERNS: DayPattern[] = ['FULL', 'MORNING', 'AFTERNOON', 'OFF'];

const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Amplitude couverte par les horaires, pause déduite. */
function spanOf(schedule: DaySchedule): number {
  const span = parseHHMM(schedule.end) - parseHHMM(schedule.start);
  const pause = hasBreak(schedule)
    ? parseHHMM(schedule.breakEnd!) - parseHHMM(schedule.breakStart!)
    : 0;
  return Math.max(0, span - pause);
}

/**
 * Édition de l'horaire d'une journée.
 *
 * Durée due et horaires de référence sont deux choses distinctes : on peut
 * devoir sept heures tout en ayant des horaires 08:00–17:00. L'écran ne force
 * donc pas l'une à partir de l'autre, mais signale l'écart quand il existe.
 */
export function ScheduleSheet({
  weekday,
  schedule,
  dailyMinutes,
  onChange,
  onClose,
}: {
  weekday: number;
  schedule: DaySchedule;
  dailyMinutes: number;
  onChange: (schedule: DaySchedule) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DaySchedule>(schedule);

  const apply = (next: DaySchedule) => {
    setDraft(next);
    onChange(next);
  };

  const setPattern = (pattern: DayPattern) => apply(scheduleFromPattern(pattern, dailyMinutes));

  const setTime = (field: 'start' | 'end' | 'breakStart' | 'breakEnd', value: string) => {
    if (!value) return;
    apply({ ...draft, [field]: value, pattern: 'CUSTOM' });
  };

  const toggleBreak = () => {
    if (hasBreak(draft)) {
      const { breakStart: _s, breakEnd: _e, ...rest } = draft;
      apply({ ...rest, pattern: 'CUSTOM' });
    } else {
      apply({ ...draft, breakStart: '12:00', breakEnd: '13:00', pattern: 'CUSTOM' });
    }
  };

  const span = spanOf(draft);
  // L'écart n'est signalé que sur des horaires saisis à la main : sur un
  // préréglage, il est voulu — une matinée va de 08:00 à midi même si seules
  // trois heures et demie sont dues.
  const ecart =
    draft.pattern === 'CUSTOM' && draft.minutes > 0 && Math.abs(span - draft.minutes) > 1;

  return (
    <Sheet
      title={DAY_NAMES[weekday - 1]}
      subtitle={
        draft.minutes === 0
          ? 'Journée non travaillée'
          : `${formatClockish(draft.minutes)} de travail dû`
      }
      onClose={onClose}
    >
      <div className="stack">
        <div>
          <h3 className="card__title">Forme de la journée</h3>
          <div className="chip-row">
            {PATTERNS.map((p) => (
              <button
                key={p}
                type="button"
                className={`chip${draft.pattern === p ? ' chip--accent' : ''}`}
                onClick={() => setPattern(p)}
              >
                {DAY_PATTERN_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        {draft.minutes > 0 && (
          <>
            <div>
              <h3 className="card__title">Temps dû</h3>
              <Field label="Durée" hint="Ce qui compte dans le solde">
                <input
                  className="input"
                  aria-label="Durée due"
                  type="number"
                  inputMode="decimal"
                  step={0.25}
                  min={0.25}
                  max={16}
                  value={Number((draft.minutes / 60).toFixed(2))}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v > 0) {
                      apply({ ...draft, minutes: Math.round(v * 60), pattern: 'CUSTOM' });
                    }
                  }}
                  style={{ minWidth: 82 }}
                />
              </Field>
            </div>

            <div>
              <h3 className="card__title">Horaires de référence</h3>
              <p className="small faint" style={{ marginBottom: 8 }}>
                Ils ne contraignent pas le pointage : ils indiquent seulement quand l’application
                doit se manifester.
              </p>
              <Field label="Début">
                <input
                  className="input"
                  type="time"
                  aria-label="Début de la journée"
                  value={draft.start}
                  onChange={(e) => setTime('start', e.target.value)}
                />
              </Field>
              <Field label="Fin">
                <input
                  className="input"
                  type="time"
                  aria-label="Fin de la journée"
                  value={draft.end}
                  onChange={(e) => setTime('end', e.target.value)}
                />
              </Field>
              <Field
                label="Pause déjeuner"
                hint={hasBreak(draft) ? 'La journée comporte une coupure' : 'Aucune coupure'}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasBreak(draft)}
                  aria-label="Pause déjeuner"
                  className="switch"
                  onClick={toggleBreak}
                />
              </Field>
              {hasBreak(draft) && (
                <>
                  <Field label="Début de pause">
                    <input
                      className="input"
                      type="time"
                      aria-label="Début de pause"
                      value={draft.breakStart}
                      onChange={(e) => setTime('breakStart', e.target.value)}
                    />
                  </Field>
                  <Field label="Fin de pause">
                    <input
                      className="input"
                      type="time"
                      aria-label="Fin de pause"
                      value={draft.breakEnd}
                      onChange={(e) => setTime('breakEnd', e.target.value)}
                    />
                  </Field>
                </>
              )}

              {ecart && (
                <p className="small muted" style={{ marginTop: 10 }}>
                  Ces horaires couvrent <strong>{formatClockish(span)}</strong> pour{' '}
                  <strong>{formatClockish(draft.minutes)}</strong> dues. C’est permis — le solde
                  suit la durée, pas l’amplitude.
                </p>
              )}
            </div>
          </>
        )}

        <button type="button" className="btn btn--block btn--primary" onClick={onClose}>
          Terminé
        </button>
      </div>
    </Sheet>
  );
}
