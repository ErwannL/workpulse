import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atTimeOn, type PlannedAlert } from '@workpulse/core';
import { StoreProvider } from './store';
import { useAlerts } from './useAlerts';
import { db } from '@/db/db';
import { saveSettings, wipeAll } from '@/db/repo';
import { setNotificationPort, type NotificationPort } from '@/platform/notifications';

const MON = '2026-09-07';

/** Port instrumenté : on observe ce que l'application demande au système. */
function fakePort(overrides: Partial<NotificationPort> = {}): NotificationPort & {
  shown: [string, string, string][];
  scheduled: { date: Date; plan: PlannedAlert[] }[];
} {
  const shown: [string, string, string][] = [];
  const scheduled: { date: Date; plan: PlannedAlert[] }[] = [];
  return {
    native: false,
    canSchedule: false,
    permission: () => Promise.resolve('granted' as const),
    request: () => Promise.resolve('granted' as const),
    show: (title, body, tag) => {
      shown.push([title, body, tag]);
      return Promise.resolve();
    },
    schedule: (date, plan) => {
      scheduled.push({ date, plan });
      return Promise.resolve();
    },
    clearScheduled: () => Promise.resolve(),
    shown,
    scheduled,
    ...overrides,
  };
}

/** Rend le crochet dans un vrai magasin et expose l'alerte courante. */
function Sonde() {
  const { alert } = useAlerts();
  return <div data-testid="alerte">{alert ? alert.kind : 'aucune'}</div>;
}

function renderSonde() {
  return render(
    <StoreProvider>
      <Sonde />
    </StoreProvider>,
  );
}

beforeEach(async () => {
  localStorage.clear();
  await db.open();
  await wipeAll();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(atTimeOn(MON, '08:20')));
  await saveSettings({ trackingStart: MON });
});

afterEach(() => {
  vi.useRealTimers();
  setNotificationPort(null);
});

describe('notification immédiate', () => {
  it('pousse l’alerte courante quand l’autorisation est accordée', async () => {
    const port = fakePort();
    setNotificationPort(port);

    renderSonde();
    await waitFor(() => expect(screen.getByTestId('alerte')).toHaveTextContent('DAY_START'));
    await waitFor(() => expect(port.shown).toHaveLength(1));

    const [titre, , tag] = port.shown[0];
    expect(titre).toContain('Tu as commencé à travailler ?');
    expect(tag).toBe('workpulse-DAY_START');
  });

  it('ne pousse rien sans autorisation', async () => {
    const port = fakePort({ permission: () => Promise.resolve('denied') });
    setNotificationPort(port);

    renderSonde();
    await waitFor(() => expect(screen.getByTestId('alerte')).toHaveTextContent('DAY_START'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(port.shown).toHaveLength(0);
  });

  it('ne répète pas la même alerte avant l’intervalle réglé', async () => {
    const port = fakePort();
    setNotificationPort(port);

    renderSonde();
    await waitFor(() => expect(port.shown).toHaveLength(1));

    // Deux minutes plus tard, l'alerte tient toujours mais reste silencieuse.
    await act(async () => {
      vi.setSystemTime(new Date(atTimeOn(MON, '08:22')));
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(port.shown).toHaveLength(1);

    // Passé l'intervalle de répétition, elle se manifeste de nouveau.
    await act(async () => {
      vi.setSystemTime(new Date(atTimeOn(MON, '08:26')));
      await vi.advanceTimersByTimeAsync(16_000);
    });
    await waitFor(() => expect(port.shown).toHaveLength(2));
  });
});

describe('rappels programmés', () => {
  it('ne programme rien sur un port qui ne sait pas le faire', async () => {
    const port = fakePort();
    setNotificationPort(port);

    renderSonde();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(port.scheduled).toHaveLength(0);
  });

  it('programme la journée sur un port qui le permet', async () => {
    const port = fakePort({ native: true, canSchedule: true });
    setNotificationPort(port);

    renderSonde();
    await waitFor(() => expect(port.scheduled.length).toBeGreaterThan(0));

    const { date, plan } = port.scheduled[0];
    expect(date.getDate()).toBe(7);
    expect(plan.map((p) => p.kind)).toEqual(['DAY_START', 'LUNCH_START', 'LUNCH_END', 'DAY_END']);
  });

  it('ne programme rien sans autorisation', async () => {
    const port = fakePort({
      native: true,
      canSchedule: true,
      permission: () => Promise.resolve('default'),
    });
    setNotificationPort(port);

    renderSonde();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(port.scheduled).toHaveLength(0);
  });
});
