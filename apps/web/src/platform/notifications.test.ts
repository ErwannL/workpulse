import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyAlertPlan, mergeSettings, scheduleFromPattern } from '@workpulse/core';
import {
  NativeNotifications,
  notifications,
  setNotificationPort,
  WebNotifications,
} from './notifications';

// Le greffon natif n'existe pas dans un navigateur : on le simule pour
// éprouver la logique de programmation, qui est la partie intéressante.
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: (...a: unknown[]) => plugin.checkPermissions(...a),
    requestPermissions: (...a: unknown[]) => plugin.requestPermissions(...a),
    schedule: (...a: unknown[]) => plugin.schedule(...a),
    getPending: (...a: unknown[]) => plugin.getPending(...a),
    cancel: (...a: unknown[]) => plugin.cancel(...a),
  },
}));

const plugin = {
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  schedule: vi.fn().mockResolvedValue(undefined),
  getPending: vi.fn().mockResolvedValue({ notifications: [] }),
  cancel: vi.fn().mockResolvedValue(undefined),
};

afterEach(() => {
  setNotificationPort(null);
  vi.unstubAllGlobals();
});

describe('choix du port', () => {
  it('utilise le port navigateur hors enveloppe native', () => {
    expect(notifications().native).toBe(false);
    expect(notifications().canSchedule).toBe(false);
  });

  it('mémorise le port choisi', () => {
    expect(notifications()).toBe(notifications());
  });

  it('bascule sur le port natif quand Capacitor est présent', () => {
    setNotificationPort(null);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
    const port = notifications();
    expect(port.native).toBe(true);
    expect(port.canSchedule).toBe(true);
  });
});

describe('port navigateur', () => {
  let port: WebNotifications;

  beforeEach(() => {
    port = new WebNotifications();
  });

  it('se déclare refusé quand les notifications n’existent pas', async () => {
    vi.stubGlobal('Notification', undefined);
    await expect(port.permission()).resolves.toBe('denied');
    await expect(port.request()).resolves.toBe('denied');
  });

  it('relaie l’état et la demande du navigateur', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    await expect(port.permission()).resolves.toBe('default');
    await expect(port.request()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalled();
  });

  it('affiche une notification quand elle est autorisée', async () => {
    const constructeur = vi.fn();
    vi.stubGlobal('Notification', Object.assign(constructeur, { permission: 'granted' }));
    await port.show('Titre', 'Corps', 'tag');
    expect(constructeur).toHaveBeenCalledWith('Titre', expect.objectContaining({ body: 'Corps' }));
  });

  it('n’affiche rien sans autorisation', async () => {
    const constructeur = vi.fn();
    vi.stubGlobal('Notification', Object.assign(constructeur, { permission: 'denied' }));
    await port.show('Titre', 'Corps', 'tag');
    expect(constructeur).not.toHaveBeenCalled();
  });

  it('encaisse un constructeur qui refuse de s’exécuter', async () => {
    const constructeur = vi.fn(() => {
      throw new Error('Illegal constructor');
    });
    vi.stubGlobal('Notification', Object.assign(constructeur, { permission: 'granted' }));
    await expect(port.show('Titre', 'Corps', 'tag')).resolves.toBeUndefined();
  });

  it('ne programme rien : un navigateur fermé ne peut rien déclencher', async () => {
    const plan = dailyAlertPlan(scheduleFromPattern('FULL', 420), mergeSettings(undefined));
    expect(plan).toHaveLength(4);
    await expect(port.schedule()).resolves.toBeUndefined();
    await expect(port.clearScheduled()).resolves.toBeUndefined();
  });
});

describe('port Android', () => {
  let port: NativeNotifications;

  beforeEach(() => {
    vi.clearAllMocks();
    plugin.getPending.mockResolvedValue({ notifications: [] });
    port = new NativeNotifications();
  });

  it('traduit les états d’autorisation du système', async () => {
    plugin.checkPermissions.mockResolvedValue({ display: 'granted' });
    await expect(port.permission()).resolves.toBe('granted');
    plugin.checkPermissions.mockResolvedValue({ display: 'denied' });
    await expect(port.permission()).resolves.toBe('denied');
    plugin.checkPermissions.mockResolvedValue({ display: 'prompt' });
    await expect(port.permission()).resolves.toBe('default');
  });

  it('relaie la demande d’autorisation', async () => {
    plugin.requestPermissions.mockResolvedValue({ display: 'granted' });
    await expect(port.request()).resolves.toBe('granted');
    plugin.requestPermissions.mockResolvedValue({ display: 'denied' });
    await expect(port.request()).resolves.toBe('denied');
    plugin.requestPermissions.mockResolvedValue({ display: 'prompt' });
    await expect(port.request()).resolves.toBe('default');
  });

  it('affiche une notification immédiate', async () => {
    await port.show('Titre', 'Corps', 'CAN_LEAVE');
    const envoi = plugin.schedule.mock.calls[0][0];
    expect(envoi.notifications[0].title).toBe('Titre');
    expect(envoi.notifications[0].id).toBeTypeOf('number');
  });

  it('programme les rappels à venir de la journée', async () => {
    const jour = new Date(2026, 8, 7, 6, 0, 0);
    vi.setSystemTime(jour);

    await port.schedule(
      jour,
      dailyAlertPlan(scheduleFromPattern('FULL', 420), mergeSettings(undefined)),
    );

    const envoyees = plugin.schedule.mock.calls[0][0].notifications;
    expect(envoyees).toHaveLength(4);
    expect(envoyees.map((n: { id: number }) => n.id)).toEqual([1001, 1002, 1003, 1004]);
    expect(new Date(envoyees[0].schedule.at).getHours()).toBe(8);
    vi.useRealTimers();
  });

  it('ignore les rappels dont l’heure est déjà passée', async () => {
    const jour = new Date(2026, 8, 7, 14, 0, 0);
    vi.setSystemTime(jour);

    await port.schedule(
      jour,
      dailyAlertPlan(scheduleFromPattern('FULL', 420), mergeSettings(undefined)),
    );

    const envoyees = plugin.schedule.mock.calls[0][0].notifications;
    expect(envoyees.map((n: { id: number }) => n.id)).toEqual([1004]);
    vi.useRealTimers();
  });

  it('n’appelle pas le système quand il n’y a rien à programmer', async () => {
    const jour = new Date(2026, 8, 12, 9, 0, 0);
    vi.setSystemTime(jour);
    await port.schedule(
      jour,
      dailyAlertPlan(scheduleFromPattern('OFF', 420), mergeSettings(undefined)),
    );
    expect(plugin.schedule).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('remplace les rappels au lieu de les empiler', async () => {
    plugin.getPending.mockResolvedValue({ notifications: [{ id: 1001 }, { id: 4242 }] });
    const jour = new Date(2026, 8, 7, 6, 0, 0);
    vi.setSystemTime(jour);

    await port.schedule(
      jour,
      dailyAlertPlan(scheduleFromPattern('FULL', 420), mergeSettings(undefined)),
    );

    // Seuls les rappels de WorkPulse sont annulés : ceux d'un autre greffon
    // ne nous appartiennent pas.
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1001 }] });
    vi.useRealTimers();
  });

  it('n’annule rien quand aucun rappel n’est en attente', async () => {
    await port.clearScheduled();
    expect(plugin.cancel).not.toHaveBeenCalled();
  });
});
