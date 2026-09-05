import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserEvent } from '@testing-library/user-event';
import { StoreProvider } from '@/state/store';
import { App } from '@/ui/App';
import { db } from '@/db/db';
import { addEntry, saveSettings, wipeAll } from '@/db/repo';
import { atTimeOn } from '@workpulse/core';

/**
 * Parcours de bout en bout de l'application, base locale réelle
 * (fake-indexeddb) et horloge maîtrisée. Ces tests décrivent ce que
 * l'utilisateur fait, pas comment les composants sont écrits.
 */
const MON = '2026-09-07';

let user: UserEvent;

/**
 * Avance l'horloge à l'heure dite, puis laisse le battement du moteur
 * s'exécuter : sans cela l'application garderait l'heure précédente.
 */
async function at(hhmm: string): Promise<void> {
  vi.setSystemTime(new Date(atTimeOn(MON, hhmm)));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(16_000);
  });
}

function renderApp() {
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

/** Le corps de l'écran, hors bandeau d'alerte qui peut proposer les mêmes mots. */
function main() {
  return within(screen.getByRole('main'));
}

async function ready(): Promise<void> {
  await waitFor(() => expect(screen.queryByText('Chargement…')).not.toBeInTheDocument());
}

beforeEach(async () => {
  window.location.hash = '';
  localStorage.clear();
  await db.open();
  await wipeAll();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  await at('08:05');
  await saveSettings({ trackingStart: MON, userName: 'Erwann' });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('journée de travail', () => {
  it('déroule arrivée, pause et départ', async () => {
    renderApp();
    await ready();

    expect(await screen.findByText(/Bonjour Erwann/)).toBeInTheDocument();
    await user.click(main().getByRole('button', { name: /Pointer mon arrivée/ }));

    // Le compteur démarre : les actions de la journée en cours apparaissent.
    await waitFor(() => main().getByRole('button', { name: /Commencer ma pause/ }));
    expect(main().getByText('Arrivée')).toBeInTheDocument();

    await at('12:00');
    await user.click(main().getByRole('button', { name: /Commencer ma pause/ }));
    await waitFor(() => main().getByRole('button', { name: /Reprendre le travail/ }));

    await at('16:10');
    await user.click(main().getByRole('button', { name: /Reprendre le travail/ }));
    await waitFor(() => main().getByRole('button', { name: /Pointer mon départ/ }));
    await user.click(main().getByRole('button', { name: /Pointer mon départ/ }));

    expect(await screen.findByText('Départ')).toBeInTheDocument();
  });

  it('refuse une reprise avant la pause minimale, avec une suggestion', async () => {
    await at('08:00');
    await addEntry({ date: MON, type: 'CLOCK_IN', at: atTimeOn(MON, '08:00') });
    await at('12:00');
    await addEntry({ date: MON, type: 'BREAK_START', at: atTimeOn(MON, '12:00') });

    await at('12:15');
    renderApp();
    await ready();

    await user.click(main().getByRole('button', { name: /Reprendre le travail/ }));
    expect(
      await main().findByText(/Netflix|prendre l’air|café|assis|légal|épisode/),
    ).toBeInTheDocument();

    // Une fois les trente minutes écoulées, la reprise est acceptée.
    await at('12:31');
    await user.click(main().getByRole('button', { name: /Reprendre le travail/ }));
    await waitFor(() => main().getByRole('button', { name: /Commencer ma pause/ }));
  });

  it('annonce que les heures sont faites et propose une heure de départ', async () => {
    for (const [type, hhmm] of [
      ['CLOCK_IN', '08:00'],
      ['BREAK_START', '12:00'],
      ['BREAK_END', '13:00'],
    ] as const) {
      await addEntry({ date: MON, type, at: atTimeOn(MON, hhmm) });
    }

    await at('14:00');
    renderApp();
    await ready();
    expect(await main().findByText(/Il te reste/)).toBeInTheDocument();
    expect(main().getByText(/Départ recommandé/)).toBeInTheDocument();

    await at('16:05');
    await waitFor(() => main().getByText('Tu as fait tes heures'));
  });
});

describe('alertes', () => {
  it('réclame le pointage d’arrivée passé l’heure habituelle, et se laisse reporter', async () => {
    await at('08:20');
    renderApp();
    await ready();

    const alert = await screen.findByRole('status');
    expect(within(alert).getByText('Tu as commencé à travailler ?')).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: '+30 min' }));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('agit directement depuis l’alerte', async () => {
    await at('08:20');
    renderApp();
    await ready();

    const alert = await screen.findByRole('status');
    await user.click(within(alert).getByRole('button', { name: 'Pointer maintenant' }));
    await waitFor(() => main().getByRole('button', { name: /Commencer ma pause/ }));
  });

  it('se tait définitivement quand on l’ignore', async () => {
    await at('08:20');
    renderApp();
    await ready();

    const alert = await screen.findByRole('status');
    await user.click(within(alert).getByRole('button', { name: 'Ignorer' }));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
});

describe('navigation', () => {
  it('ouvre chacun des cinq onglets', async () => {
    renderApp();
    await ready();

    const cases: [RegExp, RegExp][] = [
      [/Semaine/, /Compteur/],
      [/Calendrier/, /Poser des congés/],
      [/Stats/, /Statistiques/],
      [/Réglages/, /Identité/],
    ];

    for (const [tab, expected] of cases) {
      await user.click(screen.getByRole('button', { name: tab }));
      expect(await screen.findByText(expected)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: /Aujourd’hui/ }));
    expect(await screen.findByText(/Bonjour Erwann/)).toBeInTheDocument();
  });
});
