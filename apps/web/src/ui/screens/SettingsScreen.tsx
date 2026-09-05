import { useEffect, useRef, useState } from 'react';
import {
  DAY_PATTERN_LABEL,
  formatClockish,
  formatLongDate,
  formatSigned,
  scheduleForWeekday,
  weeklyMinutes,
  type DaySchedule,
} from '@workpulse/core';
import { useStore } from '@/state/context';
import { exportBackup, importBackup, wipeAll } from '@/db/repo';
import { Card, Field, Sheet, Switch } from '@/ui/components/primitives';
import { ScheduleSheet } from '@/ui/components/ScheduleSheet';
import { IconChevronRight, IconDownload, IconUpload } from '@/ui/icons';
import { AdminPanel } from '@/ui/components/AdminPanel';
import { notifications } from '@/platform/notifications';

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Champ de durée saisi en heures décimales et stocké en minutes. */
function HoursInput({
  label,
  minutes,
  onChange,
  step = 0.25,
  max = 80,
}: {
  label: string;
  minutes: number;
  onChange: (minutes: number) => void;
  step?: number;
  max?: number;
}) {
  return (
    <input
      className="input"
      aria-label={label}
      type="number"
      inputMode="decimal"
      step={step}
      min={0}
      max={max}
      value={Number((minutes / 60).toFixed(2))}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onChange(Math.round(v * 60));
      }}
      style={{ minWidth: 82 }}
    />
  );
}

export function SettingsScreen() {
  const store = useStore();
  const { settings } = store;
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [editingWeekday, setEditingWeekday] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = store.updateSettings;
  const setNotif = (patch: Partial<typeof settings.notifications>) =>
    set({ notifications: { ...settings.notifications, ...patch } });
  const setWeekday = (weekday: number, schedule: DaySchedule) =>
    set({ week: { ...settings.week, [weekday]: schedule } });

  const doExport = async () => {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workpulse-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    store.notify('Sauvegarde exportée.');
  };

  const doImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      await importBackup(parsed);
      store.notify('Sauvegarde restaurée.');
    } catch (err) {
      store.notify(err instanceof Error ? err.message : 'Import impossible.');
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title">Réglages</h1>
          <p className="topbar__sub">Tout reste sur cet appareil.</p>
        </div>
      </header>

      <main className="app__main">
        <Card title="Identité">
          <Field label="Prénom">
            <input
              className="input"
              aria-label="Prénom"
              value={settings.userName}
              onChange={(e) => set({ userName: e.target.value })}
            />
          </Field>
        </Card>

        <Card title="Semaine type">
          <p className="small muted" style={{ marginBottom: 12 }}>
            Objectif hebdomadaire :{' '}
            <strong className="num">{formatClockish(weeklyMinutes(settings))}</strong>. Chaque
            journée se règle séparément — matin seul, après-midi seul ou horaires libres.
          </p>
          <div className="rows">
            {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
              const schedule = scheduleForWeekday(weekday, settings);
              return (
                <button
                  key={weekday}
                  type="button"
                  className="row row--tappable"
                  onClick={() => setEditingWeekday(weekday)}
                >
                  <span className="row__label">
                    <strong style={{ color: 'var(--text)', width: 78, display: 'inline-block' }}>
                      {DAY_NAMES[weekday - 1]}
                    </strong>
                    <span className="small">
                      {schedule.minutes === 0
                        ? DAY_PATTERN_LABEL.OFF
                        : `${schedule.start} – ${schedule.end}`}
                    </span>
                  </span>
                  <span className="row__value">
                    {schedule.minutes === 0 ? (
                      <span className="value-muted small">—</span>
                    ) : (
                      formatClockish(schedule.minutes)
                    )}
                    <IconChevronRight
                      width={15}
                      height={15}
                      style={{ verticalAlign: '-2px', opacity: 0.5, marginLeft: 4 }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="Temps de travail">
          <Field label="Journée complète" hint="Gabarit appliqué aux journées entières">
            <HoursInput
              label="Durée d’une journée complète"
              minutes={settings.dailyMinutes}
              onChange={(m) => set({ dailyMinutes: m })}
              max={16}
            />
          </Field>
          <Field
            label="Plafond d’heures supplémentaires"
            hint={`${formatSigned(settings.overtimeCapMinutes)} par semaine`}
          >
            <HoursInput
              label="Plafond d’heures supplémentaires"
              minutes={settings.overtimeCapMinutes}
              onChange={(m) => set({ overtimeCapMinutes: m })}
              max={20}
            />
          </Field>
        </Card>

        <Card title="Pause déjeuner">
          <Field label="Pause minimale" hint="En dessous, la reprise est refusée.">
            <input
              className="input"
              aria-label="Pause minimale en minutes"
              type="number"
              min={0}
              max={180}
              step={5}
              value={settings.minBreakMinutes}
              onChange={(e) => set({ minBreakMinutes: Number(e.target.value) || 0 })}
              style={{ minWidth: 82 }}
            />
          </Field>
          <Field
            label="Bloquer la reprise anticipée"
            hint={`Minimum légal de ${settings.minBreakMinutes} minutes`}
          >
            <Switch
              checked={settings.enforceMinBreak}
              onChange={(v) => set({ enforceMinBreak: v })}
              label="Bloquer la reprise anticipée"
            />
          </Field>
        </Card>

        <Card title="Notifications">
          <SystemNotificationField />
          <Field label="Activer les alertes">
            <Switch
              checked={settings.notifications.enabled}
              onChange={(v) => setNotif({ enabled: v })}
              label="Activer les alertes"
            />
          </Field>
          <Field label="Début de journée" hint="À l’heure de début propre au jour">
            <Switch
              checked={settings.notifications.dayStart}
              onChange={(v) => setNotif({ dayStart: v })}
              label="Alerte de début de journée"
            />
          </Field>
          <Field label="Déjeuner" hint="Seulement les journées avec coupure">
            <Switch
              checked={settings.notifications.lunchStart}
              onChange={(v) => setNotif({ lunchStart: v })}
              label="Alerte déjeuner"
            />
          </Field>
          <Field label="Reprise" hint="Une fois la pause minimale écoulée">
            <Switch
              checked={settings.notifications.lunchEnd}
              onChange={(v) => setNotif({ lunchEnd: v })}
              label="Alerte de reprise"
            />
          </Field>
          <Field label="Fin de journée" hint="À l’heure de fin propre au jour">
            <Switch
              checked={settings.notifications.dayEnd}
              onChange={(v) => setNotif({ dayEnd: v })}
              label="Alerte de fin de journée"
            />
          </Field>
          <Field label="Répétition" hint="Minutes entre deux rappels">
            <input
              className="input"
              aria-label="Répétition des alertes en minutes"
              type="number"
              min={1}
              max={60}
              value={settings.notifications.repeatMinutes}
              onChange={(e) => setNotif({ repeatMinutes: Number(e.target.value) || 5 })}
              style={{ minWidth: 82 }}
            />
          </Field>
        </Card>

        <Card title="Suivi">
          <Field label="Début du suivi" hint={formatLongDate(settings.trackingStart)}>
            <input
              className="input"
              aria-label="Début du suivi"
              type="date"
              value={settings.trackingStart}
              onChange={(e) => e.target.value && set({ trackingStart: e.target.value })}
            />
          </Field>
          <Field label="Solde initial" hint="Heures acquises avant le suivi">
            <HoursInput
              label="Solde initial"
              minutes={settings.initialBalance}
              onChange={(m) => set({ initialBalance: m })}
              max={500}
            />
          </Field>
          <Field label="Jours fériés" hint="France métropolitaine">
            <span className="chip">FR</span>
          </Field>
        </Card>

        <Card title="Données">
          <div className="punch punch--split">
            <button type="button" className="btn" onClick={doExport}>
              <IconDownload width={17} height={17} />
              Exporter
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <IconUpload width={17} height={17} />
              Importer
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) doImport(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn btn--block btn--danger"
            style={{ marginTop: 12 }}
            onClick={() => setConfirmWipe(true)}
          >
            Effacer toutes les données
          </button>
        </Card>

        <AdminPanel />
      </main>

      {editingWeekday !== null && (
        <ScheduleSheet
          weekday={editingWeekday}
          schedule={scheduleForWeekday(editingWeekday, settings)}
          dailyMinutes={settings.dailyMinutes}
          onChange={(schedule) => setWeekday(editingWeekday, schedule)}
          onClose={() => setEditingWeekday(null)}
        />
      )}

      {confirmWipe && (
        <Sheet
          title="Tout effacer ?"
          subtitle="Pointages, journées et réglages seront supprimés de cet appareil. Cette action est définitive."
          onClose={() => setConfirmWipe(false)}
        >
          <div className="sheet__actions">
            <button
              type="button"
              className="btn btn--block btn--danger"
              onClick={async () => {
                await wipeAll();
                setConfirmWipe(false);
                store.notify('Données effacées.');
              }}
            >
              Oui, tout effacer
            </button>
            <button type="button" className="btn btn--block" onClick={() => setConfirmWipe(false)}>
              Annuler
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

/**
 * Les notifications système exigent une autorisation explicite. Le message
 * dit aussi ce que l'autorisation permet réellement : dans un navigateur, une
 * alerte ne part que si l'application tourne.
 */
function SystemNotificationField() {
  const port = notifications();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'inconnu'>(
    'inconnu',
  );

  useEffect(() => {
    let annule = false;
    void port.permission().then((etat) => {
      if (!annule) setPermission(etat);
    });
    return () => {
      annule = true;
    };
  }, [port]);

  const hint =
    permission === 'granted'
      ? port.canSchedule
        ? 'Rappels programmés, même application fermée'
        : 'Autorisées — seulement quand l’application est ouverte'
      : permission === 'denied'
        ? 'Refusées — à réactiver dans les réglages du système'
        : 'Les alertes restent visibles dans l’application';

  return (
    <Field label="Notifications système" hint={hint}>
      {permission === 'default' ? (
        <button
          type="button"
          className="btn btn--sm"
          onClick={async () => setPermission(await port.request())}
        >
          Autoriser
        </button>
      ) : (
        <span className={`chip${permission === 'granted' ? ' chip--accent' : ''}`}>
          {permission === 'granted' ? 'Actives' : 'Inactives'}
        </span>
      )}
    </Field>
  );
}
