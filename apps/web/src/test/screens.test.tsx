import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserEvent } from '@testing-library/user-event';
import { StoreProvider } from '@/state/store';
import { App } from '@/ui/App';
import { db } from '@/db/db';
import { addEntry, loadSettings, saveSettings, upsertDay, wipeAll } from '@/db/repo';
import { atTimeOn } from '@workpulse/core';

const MON = '2026-09-07';
const TUE = '2026-09-08';

let user: UserEvent;

async function at(hhmm: string, date = MON): Promise<void> {
  vi.setSystemTime(new Date(atTimeOn(date, hhmm)));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(16_000);
  });
}

function main() {
  return within(screen.getByRole('main'));
}

async function renderApp(route = 'pulse') {
  window.location.hash = `#/${route}`;
  render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
  await waitFor(() => expect(screen.queryByText('Chargement…')).not.toBeInTheDocument());
}

/** Journée complète de 7 h, utilisée comme historique de départ. */
async function sevenHours(date: string) {
  for (const [type, hhmm] of [
    ['CLOCK_IN', '08:00'],
    ['BREAK_START', '12:00'],
    ['BREAK_END', '13:00'],
    ['CLOCK_OUT', '16:00'],
  ] as const) {
    await addEntry({ date, type, at: atTimeOn(date, hhmm) });
  }
}

beforeEach(async () => {
  window.location.hash = '';
  localStorage.clear();
  await db.open();
  await wipeAll();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  await at('10:00');
  await saveSettings({ trackingStart: MON, userName: 'Erwann' });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('édition d’une journée', () => {
  it('corrige un pointage oublié et le compteur suit', async () => {
    await renderApp();
    await user.click(main().getByRole('button', { name: /Modifier/ }));

    const sheet = within(screen.getByRole('dialog'));
    expect(sheet.getByText('Aucun pointage sur cette journée.')).toBeInTheDocument();

    await user.click(sheet.getByRole('button', { name: /Arrivée/ }));
    fireEvent.change(sheet.getByLabelText('Heure à ajouter'), { target: { value: '08:02' } });

    await waitFor(() => expect(screen.getByLabelText('Heure — Arrivée')).toBeInTheDocument());
    expect(await main().findByText('Arrivée')).toBeInTheDocument();
  });

  it('déclare un congé, qui neutralise le temps théorique', async () => {
    await renderApp();
    await user.click(main().getByRole('button', { name: /Modifier/ }));

    const sheet = within(screen.getByRole('dialog'));
    await user.click(sheet.getByRole('button', { name: 'Congé' }));

    await waitFor(() => expect(sheet.getByText('Temps théorique')).toBeInTheDocument());
    const rows = screen.getByRole('dialog').querySelectorAll('.row');
    expect(rows[0].textContent).toContain('0h00');
  });

  it('bascule un jour férié en jour travaillé', async () => {
    await saveSettings({ trackingStart: '2026-07-01' });
    await at('10:00', '2026-07-14');
    await renderApp();
    await user.click(main().getByRole('button', { name: /Modifier/ }));

    const sheet = within(screen.getByRole('dialog'));
    expect(sheet.getByText(/Fête nationale/)).toBeInTheDocument();
    await user.click(sheet.getByRole('switch', { name: /jour férié/i }));

    await waitFor(() => expect(sheet.getAllByText('7h00').length).toBeGreaterThan(0));
  });

  it('supprime un pointage et réinitialise la journée', async () => {
    await sevenHours(MON);
    await at('17:00');
    await renderApp();
    await user.click(main().getByRole('button', { name: /Modifier/ }));

    const sheet = within(screen.getByRole('dialog'));
    await user.click(sheet.getByRole('button', { name: /Supprimer Départ/ }));
    await waitFor(() => expect(sheet.queryByLabelText(/Heure — Départ/)).not.toBeInTheDocument());

    await user.click(sheet.getByRole('button', { name: /Réinitialiser la journée/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Journée réinitialisée.')).toBeInTheDocument();
  });

  it('enregistre une note', async () => {
    await renderApp();
    await user.click(main().getByRole('button', { name: /Modifier/ }));
    const sheet = within(screen.getByRole('dialog'));
    const note = sheet.getByPlaceholderText(/Réunion tardive/);
    await user.type(note, 'déplacement');
    await user.tab();
    await waitFor(async () => expect((await db.days.get(MON))?.notes).toBe('déplacement'));
  });
});

describe('vue semaine', () => {
  it('affiche le détail des journées et navigue entre les semaines', async () => {
    await sevenHours(MON);
    await sevenHours(TUE);
    await at('10:00', '2026-09-09');
    await renderApp('semaine');

    expect(await screen.findByRole('heading', { name: 'Semaine 37' })).toBeInTheDocument();
    expect(main().getAllByText('7h00').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    expect(await screen.findByText(/Revenir à la semaine en cours/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Revenir à la semaine en cours/ }));
    await waitFor(() =>
      expect(screen.queryByText(/Revenir à la semaine en cours/)).not.toBeInTheDocument(),
    );
  });

  it('ouvre le détail d’une journée depuis la liste', async () => {
    await sevenHours(MON);
    await at('10:00', TUE);
    await renderApp('semaine');

    const rows = main().getAllByRole('button');
    const monday = rows.find((b) => b.textContent?.startsWith('Lun'));
    await user.click(monday!);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('signale une semaine vide', async () => {
    await renderApp('semaine');
    await user.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    await user.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    expect(await main().findByText(/Rien à afficher/)).toBeInTheDocument();
  });
});

describe('calendrier', () => {
  it('navigue de mois en mois', async () => {
    await renderApp('calendrier');
    expect(await screen.findByText('septembre')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(await screen.findByText('octobre')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mois précédent' }));
    await user.click(screen.getByRole('button', { name: 'Mois précédent' }));
    expect(await screen.findByText('août')).toBeInTheDocument();
  });

  it('pose des congés sur une plage de journées', async () => {
    await renderApp('calendrier');

    await user.click(main().getByRole('button', { name: /Poser des congés/ }));
    expect(await main().findByText(/première journée/)).toBeInTheDocument();

    await user.click(main().getByRole('button', { name: '2026-09-14' }));
    expect(await main().findByText(/dernière journée/)).toBeInTheDocument();
    await user.click(main().getByRole('button', { name: '2026-09-16' }));

    await user.click(main().getByRole('button', { name: 'Déclarer…' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Congé' }));

    expect(await screen.findByText(/3 journées/)).toBeInTheDocument();
    await waitFor(async () => expect((await db.days.get('2026-09-15'))?.status).toBe('LEAVE'));
  });

  it('retire le statut d’une plage', async () => {
    await upsertDay('2026-09-14', { status: 'LEAVE' });
    await renderApp('calendrier');

    await user.click(main().getByRole('button', { name: /Poser des congés/ }));
    await user.click(main().getByRole('button', { name: '2026-09-14' }));
    await user.click(main().getByRole('button', { name: /Retirer le statut/ }));

    await waitFor(async () => expect(await db.days.get('2026-09-14')).toBeUndefined());
  });

  it('abandonne une sélection en cours', async () => {
    await renderApp('calendrier');
    await user.click(main().getByRole('button', { name: /Poser des congés/ }));
    await user.click(main().getByRole('button', { name: 'Annuler' }));
    expect(await main().findByRole('button', { name: /Poser des congés/ })).toBeInTheDocument();
  });

  it('ouvre le détail d’une journée hors mode sélection', async () => {
    await renderApp('calendrier');
    await user.click(main().getByRole('button', { name: '2026-09-10' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('statistiques', () => {
  it('bascule entre semaine, mois et total', async () => {
    await sevenHours(MON);
    await at('10:00', TUE);
    await renderApp('stats');

    expect(await main().findByText('Heures travaillées')).toBeInTheDocument();
    for (const period of ['Semaine', 'Total', 'Mois']) {
      await user.click(main().getByRole('button', { name: period }));
      expect(await main().findByText('Compteur de jours')).toBeInTheDocument();
    }
    expect(main().getByText(/Solde cumulé actuel/)).toBeInTheDocument();
  });
});

describe('réglages', () => {
  it('modifie le temps de travail et le rend au domaine', async () => {
    await renderApp('reglages');

    fireEvent.change(main().getByLabelText('Heures par jour'), { target: { value: '8' } });
    await waitFor(async () => expect((await loadSettings()).dailyMinutes).toBe(480));

    fireEvent.change(main().getByLabelText('Heures par semaine'), { target: { value: '39' } });
    await waitFor(async () => expect((await loadSettings()).weeklyMinutes).toBe(2340));
  });

  it('désactive un jour travaillé mais jamais tous', async () => {
    await renderApp('reglages');
    const dayButton = (index: number) =>
      within(screen.getByRole('group', { name: 'Jours travaillés' })).getAllByRole('button')[index];

    await user.click(dayButton(0));
    await waitFor(async () => expect((await loadSettings()).workDays).toEqual([2, 3, 4, 5]));

    // Chaque clic attend l'enregistrement : sans cela, deux clics rapides
    // partiraient de la même liste et l'un des deux serait perdu.
    for (const [index, expected] of [
      [1, [3, 4, 5]],
      [2, [4, 5]],
      [3, [5]],
    ] as const) {
      await user.click(dayButton(index));
      await waitFor(async () => expect((await loadSettings()).workDays).toEqual([...expected]));
    }

    // Le dernier jour travaillé ne peut pas être retiré.
    await user.click(dayButton(4));
    expect((await loadSettings()).workDays).toEqual([5]);
  });

  it('coupe les alertes', async () => {
    await renderApp('reglages');
    await user.click(main().getByRole('switch', { name: 'Activer les alertes' }));
    await waitFor(async () => expect((await loadSettings()).notifications.enabled).toBe(false));
  });

  it('lève le blocage de la pause minimale', async () => {
    await renderApp('reglages');
    await user.click(main().getByRole('switch', { name: /Bloquer la reprise anticipée/ }));
    await waitFor(async () => expect((await loadSettings()).enforceMinBreak).toBe(false));
  });

  it('affiche la version dans le panneau d’administration', async () => {
    await sevenHours(MON);
    await renderApp('reglages');
    expect(await main().findByText(/^v/)).toBeInTheDocument();
    expect(main().getByText('Pointages enregistrés')).toBeInTheDocument();
    expect(main().getByText('4')).toBeInTheDocument();
  });

  it('exporte une sauvegarde', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:workpulse');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await renderApp('reglages');
    await user.click(main().getByRole('button', { name: /Exporter/ }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(await screen.findByText('Sauvegarde exportée.')).toBeInTheDocument();
    click.mockRestore();
  });

  it('efface toutes les données après confirmation', async () => {
    await sevenHours(MON);
    await renderApp('reglages');
    // La purge est une transaction Dexie : elle ne se termine pas sous
    // horloge simulée. Ce scénario tourne donc en temps réel.
    vi.useRealTimers();
    user = userEvent.setup();

    await user.click(main().getByRole('button', { name: /Effacer toutes les données/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: /Annuler/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(main().getByRole('button', { name: /Effacer toutes les données/ }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Oui, tout effacer/ }),
    );

    await waitFor(async () => expect(await db.entries.count()).toBe(0));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Données effacées.')).toBeInTheDocument();
  });
});

describe('réglages — champs restants', () => {
  it('modifie les horaires de référence', async () => {
    await renderApp('reglages');
    for (const [label, value, field] of [
      ['Début de journée', '08:30', 'refStart'],
      ['Début de pause', '12:30', 'refBreakStart'],
      ['Fin de pause', '13:30', 'refBreakEnd'],
      ['Fin de journée', '17:30', 'refEnd'],
    ] as const) {
      fireEvent.change(main().getByLabelText(label), { target: { value } });
      await waitFor(async () => expect((await loadSettings())[field]).toBe(value));
    }
  });

  it('modifie le plafond, la pause minimale et la répétition', async () => {
    await renderApp('reglages');

    fireEvent.change(main().getByLabelText('Plafond d’heures supplémentaires'), {
      target: { value: '2' },
    });
    await waitFor(async () => expect((await loadSettings()).overtimeCapMinutes).toBe(120));

    fireEvent.change(main().getByLabelText('Pause minimale en minutes'), {
      target: { value: '45' },
    });
    await waitFor(async () => expect((await loadSettings()).minBreakMinutes).toBe(45));

    fireEvent.change(main().getByLabelText('Répétition des alertes en minutes'), {
      target: { value: '10' },
    });
    await waitFor(async () => expect((await loadSettings()).notifications.repeatMinutes).toBe(10));
  });

  it('ignore une saisie de durée illisible', async () => {
    await renderApp('reglages');
    fireEvent.change(main().getByLabelText('Heures par jour'), { target: { value: 'abc' } });
    expect((await loadSettings()).dailyMinutes).toBe(420);
  });

  it('modifie le prénom, le début du suivi et le solde initial', async () => {
    await renderApp('reglages');

    fireEvent.change(main().getByLabelText('Prénom'), { target: { value: 'Alex' } });
    await waitFor(async () => expect((await loadSettings()).userName).toBe('Alex'));

    fireEvent.change(main().getByLabelText('Début du suivi'), { target: { value: '2026-01-05' } });
    await waitFor(async () => expect((await loadSettings()).trackingStart).toBe('2026-01-05'));

    fireEvent.change(main().getByLabelText('Début du suivi'), { target: { value: '' } });
    expect((await loadSettings()).trackingStart).toBe('2026-01-05');

    fireEvent.change(main().getByLabelText('Solde initial'), { target: { value: '1.5' } });
    await waitFor(async () => expect((await loadSettings()).initialBalance).toBe(90));
  });

  it('coupe chaque famille d’alertes indépendamment', async () => {
    await renderApp('reglages');
    for (const [name, key] of [
      ['Alerte de début de journée', 'dayStart'],
      ['Alerte déjeuner', 'lunchStart'],
      ['Alerte de reprise', 'lunchEnd'],
      ['Alerte de fin de journée', 'dayEnd'],
    ] as const) {
      await user.click(main().getByRole('switch', { name }));
      await waitFor(async () => expect((await loadSettings()).notifications[key]).toBe(false));
    }
  });

  it('restaure une sauvegarde et refuse un fichier étranger', async () => {
    await renderApp('reglages');
    // L'import est une transaction Dexie : horloge réelle, comme la purge.
    vi.useRealTimers();
    user = userEvent.setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const backup = {
      app: 'workpulse',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { userName: 'Restauré' },
      days: [{ date: MON, status: 'RTT', updatedAt: 0 }],
      entries: [],
    };
    // jsdom ne fournit pas `File.text()` : on le comble, l'application
    // s'appuyant sur l'API standard des navigateurs.
    const asFile = (name: string, content: string) => {
      const file = new File([content], name, { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
      return file;
    };
    const good = asFile('workpulse.json', JSON.stringify(backup));
    // Le champ de fichier est masqué : `fireEvent` contourne le contrôle de
    // visibilité que `user.upload` applique à juste titre.
    fireEvent.change(input, { target: { files: [good] } });
    expect(await screen.findByText('Sauvegarde restaurée.')).toBeInTheDocument();
    await waitFor(async () => expect((await db.days.get(MON))?.status).toBe('RTT'));

    const bad = asFile('autre.json', '{"app":"autre"}');
    fireEvent.change(input, { target: { files: [bad] } });
    expect(await screen.findByText(/non reconnu/)).toBeInTheDocument();
  });

  it('propose d’autoriser les notifications système', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });

    await renderApp('reglages');
    await user.click(main().getByRole('button', { name: 'Autoriser' }));
    await waitFor(() => expect(main().getByText('Actives')).toBeInTheDocument());

    vi.unstubAllGlobals();
  });

  it('signale des notifications refusées', async () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    await renderApp('reglages');
    expect(main().getByText(/à réactiver dans le navigateur/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('vue semaine — statuts', () => {
  it('affiche chaque motif de journée non travaillée', async () => {
    await upsertDay(MON, { status: 'LEAVE' });
    await upsertDay(TUE, { status: 'RTT' });
    await upsertDay('2026-09-09', { status: 'SICK' });
    await upsertDay('2026-09-10', { status: 'SPECIAL' });
    await upsertDay('2026-09-11', { status: 'REMOTE' });
    await at('10:00', '2026-09-12');
    await renderApp('semaine');

    for (const label of ['🌴 Congé', '🌴 RTT', '🤒 Maladie', '📌 Exceptionnel']) {
      expect(await main().findByText(label)).toBeInTheDocument();
    }
  });

  it('affiche un jour férié dans la liste des journées', async () => {
    await saveSettings({ trackingStart: '2026-07-01' });
    await at('10:00', '2026-07-17');
    await renderApp('semaine');
    expect(await main().findByText(/🎉 Fête nationale/)).toBeInTheDocument();
  });
});
