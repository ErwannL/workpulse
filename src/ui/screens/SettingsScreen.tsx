import { useRef, useState } from 'react';
import { useStore } from '@/state/store';
import { formatClockish, formatLongDate, formatSigned } from '@/core/time';
import { exportBackup, importBackup, wipeAll } from '@/db/repo';
import { Card, Field, Sheet, Switch } from '@/ui/components/primitives';
import { IconDownload, IconUpload } from '@/ui/icons';

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Champ de durée saisi en heures décimales et stocké en minutes. */
function HoursInput({
  minutes,
  onChange,
  step = 0.25,
  max = 80,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
  step?: number;
  max?: number;
}) {
  return (
    <input
      className="input"
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
  const fileRef = useRef<HTMLInputElement>(null);

  const set = store.updateSettings;
  const setNotif = (patch: Partial<typeof settings.notifications>) =>
    set({ notifications: { ...settings.notifications, ...patch } });

  const toggleWorkDay = (d: number) => {
    const next = settings.workDays.includes(d)
      ? settings.workDays.filter((x) => x !== d)
      : [...settings.workDays, d].sort((a, b) => a - b);
    if (next.length === 0) return;
    set({ workDays: next });
  };

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
              value={settings.userName}
              onChange={(e) => set({ userName: e.target.value })}
            />
          </Field>
        </Card>

        <Card title="Temps de travail">
          <Field label="Heures par semaine" hint={formatClockish(settings.weeklyMinutes)}>
            <HoursInput minutes={settings.weeklyMinutes} onChange={(m) => set({ weeklyMinutes: m })} />
          </Field>
          <Field label="Heures par jour" hint={formatClockish(settings.dailyMinutes)}>
            <HoursInput
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
              minutes={settings.overtimeCapMinutes}
              onChange={(m) => set({ overtimeCapMinutes: m })}
              max={20}
            />
          </Field>
          <div style={{ paddingTop: 12 }}>
            <div className="field__label" style={{ marginBottom: 8 }}>
              Jours travaillés
            </div>
            <div className="daypicker">
              {DAY_LETTERS.map((letter, i) => {
                const d = i + 1;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={settings.workDays.includes(d)}
                    onClick={() => toggleWorkDay(d)}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card title="Horaires de référence">
          <Field label="Début de journée">
            <input
              className="input"
              type="time"
              value={settings.refStart}
              onChange={(e) => set({ refStart: e.target.value })}
            />
          </Field>
          <Field label="Début de pause">
            <input
              className="input"
              type="time"
              value={settings.refBreakStart}
              onChange={(e) => set({ refBreakStart: e.target.value })}
            />
          </Field>
          <Field label="Fin de pause">
            <input
              className="input"
              type="time"
              value={settings.refBreakEnd}
              onChange={(e) => set({ refBreakEnd: e.target.value })}
            />
          </Field>
          <Field label="Fin de journée">
            <input
              className="input"
              type="time"
              value={settings.refEnd}
              onChange={(e) => set({ refEnd: e.target.value })}
            />
          </Field>
        </Card>

        <Card title="Pause déjeuner">
          <Field
            label="Pause minimale"
            hint="En dessous, la reprise est refusée."
          >
            <input
              className="input"
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
          <Field label="Activer les alertes">
            <Switch
              checked={settings.notifications.enabled}
              onChange={(v) => setNotif({ enabled: v })}
              label="Activer les alertes"
            />
          </Field>
          <Field label="Début de journée" hint={settings.refStart}>
            <Switch
              checked={settings.notifications.dayStart}
              onChange={(v) => setNotif({ dayStart: v })}
              label="Alerte de début de journée"
            />
          </Field>
          <Field label="Déjeuner" hint={settings.refBreakStart}>
            <Switch
              checked={settings.notifications.lunchStart}
              onChange={(v) => setNotif({ lunchStart: v })}
              label="Alerte déjeuner"
            />
          </Field>
          <Field label="Reprise" hint={settings.refBreakEnd}>
            <Switch
              checked={settings.notifications.lunchEnd}
              onChange={(v) => setNotif({ lunchEnd: v })}
              label="Alerte de reprise"
            />
          </Field>
          <Field label="Fin de journée" hint={settings.refEnd}>
            <Switch
              checked={settings.notifications.dayEnd}
              onChange={(v) => setNotif({ dayEnd: v })}
              label="Alerte de fin de journée"
            />
          </Field>
          <Field label="Répétition" hint="Minutes entre deux rappels">
            <input
              className="input"
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
              type="date"
              value={settings.trackingStart}
              onChange={(e) => e.target.value && set({ trackingStart: e.target.value })}
            />
          </Field>
          <Field label="Solde initial" hint="Heures acquises avant le suivi">
            <HoursInput
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

function AdminPanel() {
  const store = useStore();
  const entryCount = [...store.entries.values()].reduce((s, l) => s + l.length, 0);
  const installed =
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  return (
    <Card title="Panneau d’administration">
      <div className="rows">
        <div className="row">
          <span className="row__label">Version</span>
          <span className="row__value">
            <span className="chip chip--accent">v{__APP_VERSION__}</span>
          </span>
        </div>
        <div className="row">
          <span className="row__label">Révision</span>
          <span className="row__value mono small">{__APP_TAG__}</span>
        </div>
        <div className="row">
          <span className="row__label">Commit</span>
          <span className="row__value mono small">{__APP_COMMIT__}</span>
        </div>
        <div className="row">
          <span className="row__label">Compilé le</span>
          <span className="row__value small">
            {new Date(__BUILD_DATE__).toLocaleString('fr-FR')}
          </span>
        </div>
        <div className="row">
          <span className="row__label">Pointages enregistrés</span>
          <span className="row__value">{entryCount}</span>
        </div>
        <div className="row">
          <span className="row__label">Journées annotées</span>
          <span className="row__value">{store.days.size}</span>
        </div>
        <div className="row">
          <span className="row__label">Mode</span>
          <span className="row__value small">{installed ? 'Application installée' : 'Navigateur'}</span>
        </div>
      </div>
    </Card>
  );
}
