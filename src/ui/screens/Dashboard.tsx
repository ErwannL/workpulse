import { useState, type CSSProperties } from 'react';
import { useStore } from '@/state/store';
import {
  clock,
  formatClockish,
  formatDuration,
  formatLongDate,
  formatSigned,
} from '@/core/time';
import { Banner, Card, Empty, Row } from '@/ui/components/primitives';
import { ProgressBar, ProgressRing } from '@/ui/components/ProgressRing';
import { DayEditor } from '@/ui/components/DayEditor';
import { IconAlert, IconCoffee, IconEdit, IconHome, IconPlay, IconStop } from '@/ui/icons';
import type { EntryType } from '@/core/types';
import { stateTone } from '@/ui/tone';

const ENTRY_LABEL: Record<EntryType, string> = {
  CLOCK_IN: 'Arrivée',
  BREAK_START: 'Début pause',
  BREAK_END: 'Retour de pause',
  CLOCK_OUT: 'Départ',
};

function dotClass(type: EntryType): string {
  if (type === 'CLOCK_IN') return 'tl__dot tl__dot--in';
  if (type === 'CLOCK_OUT') return 'tl__dot tl__dot--out';
  return 'tl__dot tl__dot--break';
}

function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h < 6) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export function Dashboard() {
  const store = useStore();
  const { pulse, settings } = store;
  const [editing, setEditing] = useState(false);
  const [refusal, setRefusal] = useState<{ title: string; message: string } | null>(null);

  const entries = [...(store.entries.get(store.today) ?? [])].sort((a, b) => a.at - b.at);
  const { day, week, phase } = pulse;

  const tone = stateTone(pulse);

  const act = async (fn: () => Promise<{ ok: boolean; title?: string; message?: string }>) => {
    const result = await fn();
    if (!result.ok) {
      setRefusal({ title: result.title ?? 'Impossible', message: result.message ?? '' });
      window.setTimeout(() => setRefusal(null), 5000);
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title">
            {greeting(store.now)} {settings.userName} 👋
          </h1>
          <p className="topbar__sub">{formatLongDate(store.today)}</p>
        </div>
        <div className="topbar__slot">
          <span
            className={`chip ${pulse.standing >= 0 ? 'chip--accent' : 'chip--warn'}`}
            title="Solde courant, report inclus"
          >
            {formatSigned(pulse.standing)}
          </span>
        </div>
      </header>

      <main className="app__main">
        <section className="card card--accent" style={{ '--accent': tone } as CSSProperties}>
          <div className="pulse">
            <span className="pulse__emoji">{pulse.emoji}</span>
            <div>
              <p className="pulse__headline">{pulse.headline}</p>
              <p className="pulse__detail">{pulse.detail}</p>
            </div>
          </div>
        </section>

        {refusal && (
          <Banner tone="danger" icon={<IconAlert width={18} height={18} />}>
            <strong>{refusal.title}</strong>
            <br />
            {refusal.message}
          </Banner>
        )}

        <Card>
          <ProgressRing
            value={day.worked}
            target={day.planned || 1}
            color={tone}
            big={formatClockish(day.worked)}
            label={
              day.planned > 0
                ? `sur ${formatClockish(day.planned)} aujourd’hui`
                : 'journée non travaillée'
            }
            badge={
              day.planned > 0 ? (
                <>
                  <span className={day.balance >= 0 ? 'value-pos' : 'value-neg'}>
                    {formatSigned(day.balance)}
                  </span>
                  <span className="faint">sur la journée</span>
                </>
              ) : undefined
            }
          />

          <div className="punch">
            {phase === 'NOT_STARTED' && (
              <button
                type="button"
                className="btn btn--primary btn--lg btn--block"
                onClick={() => act(store.clockIn)}
              >
                <IconPlay width={18} height={18} />
                Pointer mon arrivée
              </button>
            )}

            {phase === 'WORKING' && (
              <>
                <button
                  type="button"
                  className="btn btn--lg btn--block"
                  onClick={() => act(store.startBreak)}
                >
                  <IconCoffee width={18} height={18} />
                  Commencer ma pause
                </button>
                <button
                  type="button"
                  className={`btn btn--lg btn--block${pulse.canLeave ? ' btn--primary' : ''}`}
                  onClick={() => act(store.clockOut)}
                >
                  <IconStop width={16} height={16} />
                  Pointer mon départ
                  {!pulse.canLeave && (
                    <span className="btn__hint">
                      encore {formatDuration(Math.ceil(pulse.remainingToday))}
                    </span>
                  )}
                </button>
              </>
            )}

            {phase === 'BREAK' && (
              <>
                <button
                  type="button"
                  className={`btn btn--lg btn--block${pulse.breakVerdict?.allowed ? ' btn--primary' : ''}`}
                  onClick={() => act(store.endBreak)}
                >
                  <IconPlay width={18} height={18} />
                  Reprendre le travail
                  {pulse.breakVerdict && !pulse.breakVerdict.allowed && (
                    <span className="btn__hint">
                      dispo dans {formatDuration(Math.ceil(pulse.breakVerdict.remaining))}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn--block btn--ghost"
                  onClick={() => act(store.clockOut)}
                >
                  Finir la journée maintenant
                </button>
              </>
            )}

            {phase === 'CLOCKED_OUT' && (
              <button
                type="button"
                className="btn btn--lg btn--block"
                onClick={() => act(store.clockIn)}
              >
                <IconPlay width={18} height={18} />
                Reprendre le travail
              </button>
            )}
          </div>

          {pulse.leaveAt !== null && !pulse.canLeave && (
            <p className="center small muted" style={{ marginTop: 14 }}>
              <IconHome width={14} height={14} style={{ verticalAlign: '-2px' }} /> Départ
              recommandé : <strong className="num">{clock(pulse.leaveAt)}</strong>
              {pulse.pendingBreak > 0 && (
                <> · pause de {formatDuration(pulse.pendingBreak)} comprise</>
              )}
            </p>
          )}
        </Card>

        <Card
          title="Aujourd’hui"
          action={
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => setEditing(true)}
            >
              <IconEdit width={15} height={15} />
              Modifier
            </button>
          }
        >
          {entries.length === 0 ? (
            <Empty>Aucun pointage. Le compteur démarre à ton arrivée.</Empty>
          ) : (
            <div className="timeline">
              {entries.map((e) => (
                <div className="tl" key={e.id}>
                  <span className="tl__time">{clock(e.at)}</span>
                  <span className="tl__rail">
                    <span className={dotClass(e.type)} />
                  </span>
                  <span className="tl__label">{ENTRY_LABEL[e.type]}</span>
                  <span className="tl__meta">{e.editedAt ? 'corrigé' : e.manual ? 'manuel' : ''}</span>
                </div>
              ))}
              {(phase === 'WORKING' || phase === 'BREAK') && (
                <div className="tl tl--live">
                  <span className="tl__time">{clock(store.now)}</span>
                  <span className="tl__rail">
                    <span className="tl__dot" style={{ background: 'var(--accent)' }} />
                  </span>
                  <span className="tl__label">
                    {phase === 'BREAK' ? 'En pause' : 'En cours'} —{' '}
                    {formatClockish(day.worked)} travaillées
                  </span>
                  <span />
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="Cette semaine">
          <div className="rows">
            <Row label="Objectif" value={formatClockish(week.planned)} />
            <Row label="Réalisé" value={formatClockish(week.worked)} />
            <Row
              label="Différence"
              value={formatSigned(week.difference)}
              tone={week.difference >= 0 ? 'pos' : 'neg'}
            />
            <Row
              label="Report de la semaine précédente"
              value={formatSigned(week.carryIn)}
              tone={week.carryIn >= 0 ? 'pos' : 'neg'}
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

          <p className="small muted" style={{ marginTop: 12 }}>
            {pulse.trend === 'AHEAD' && `Tu es en avance de ${formatDuration(pulse.standing)}.`}
            {pulse.trend === 'BEHIND' && `Tu es en retard de ${formatDuration(pulse.standing)}.`}
            {pulse.trend === 'ON_TARGET' && 'Tu es pile sur ton objectif.'}
          </p>
        </Card>
      </main>

      {editing && <DayEditor date={store.today} onClose={() => setEditing(false)} />}
    </>
  );
}
