import type { PlannedAlert } from '@workpulse/core';

/**
 * Notifications, quelle que soit l'enveloppe.
 *
 * Dans un navigateur, une notification ne peut partir que si l'application
 * tourne : c'est une limite du support, pas un choix. Installée depuis le
 * `.apk`, l'application programme de vrais rappels système qui se déclenchent
 * application fermée. Les deux cas passent par ce même contrat.
 */
export interface NotificationPort {
  /** Vrai dans l'enveloppe Android, faux dans un navigateur. */
  readonly native: boolean;
  /** Les rappels différés sont-ils possibles ici ? */
  readonly canSchedule: boolean;
  permission(): Promise<'granted' | 'denied' | 'default'>;
  request(): Promise<'granted' | 'denied' | 'default'>;
  /** Notification immédiate, pour une alerte que seul le compteur connaît. */
  show(title: string, body: string, tag: string): Promise<void>;
  /** Remplace les rappels programmés de la journée. */
  schedule(date: Date, plan: PlannedAlert[]): Promise<void>;
  clearScheduled(): Promise<void>;
}

/** Identifiants stables : reprogrammer remplace au lieu d'empiler. */
const NOTIFICATION_IDS: Record<string, number> = {
  DAY_START: 1001,
  LUNCH_START: 1002,
  LUNCH_END: 1003,
  DAY_END: 1004,
};

function isNativePlatform(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
}

/** Port navigateur : notifications immédiates seulement. */
class WebNotifications implements NotificationPort {
  readonly native = false;
  readonly canSchedule = false;

  permission(): Promise<'granted' | 'denied' | 'default'> {
    if (typeof Notification === 'undefined') return Promise.resolve('denied');
    return Promise.resolve(Notification.permission);
  }

  async request(): Promise<'granted' | 'denied' | 'default'> {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.requestPermission();
  }

  async show(title: string, body: string, tag: string): Promise<void> {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, tag, icon: './icons/icon-192.png' });
    } catch {
      // Certaines plateformes n'autorisent les notifications que via le
      // service worker : on renonce silencieusement plutôt que de casser l'écran.
    }
  }

  schedule(): Promise<void> {
    return Promise.resolve();
  }

  clearScheduled(): Promise<void> {
    return Promise.resolve();
  }
}

/** Port Android : rappels programmés qui survivent à la fermeture. */
class NativeNotifications implements NotificationPort {
  readonly native = true;
  readonly canSchedule = true;

  private plugin() {
    return import('@capacitor/local-notifications').then((m) => m.LocalNotifications);
  }

  async permission(): Promise<'granted' | 'denied' | 'default'> {
    const { display } = await (await this.plugin()).checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
  }

  async request(): Promise<'granted' | 'denied' | 'default'> {
    const { display } = await (await this.plugin()).requestPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
  }

  async show(title: string, body: string, tag: string): Promise<void> {
    await (
      await this.plugin()
    ).schedule({
      notifications: [
        { id: hashId(tag), title, body, schedule: { at: new Date(Date.now() + 200) } },
      ],
    });
  }

  async schedule(date: Date, plan: PlannedAlert[]): Promise<void> {
    const plugin = await this.plugin();
    await this.clearScheduled();

    const notifications = plan
      .map((alerte) => {
        const at = new Date(date);
        at.setHours(0, Math.round(alerte.minutesOfDay), 0, 0);
        return { alerte, at };
      })
      // Programmer un rappel passé le ferait sonner immédiatement.
      .filter(({ at }) => at.getTime() > Date.now())
      .map(({ alerte, at }) => ({
        id: NOTIFICATION_IDS[alerte.kind] ?? hashId(alerte.kind),
        title: alerte.title,
        body: alerte.body,
        schedule: { at, allowWhileIdle: true },
      }));

    if (notifications.length > 0) await plugin.schedule({ notifications });
  }

  async clearScheduled(): Promise<void> {
    const plugin = await this.plugin();
    const { notifications } = await plugin.getPending();
    const ids = notifications.filter((n) => Object.values(NOTIFICATION_IDS).includes(n.id));
    if (ids.length > 0) await plugin.cancel({ notifications: ids });
  }
}

/** Identifiant numérique stable pour une clé textuelle. */
function hashId(clef: string): number {
  let h = 0;
  for (let i = 0; i < clef.length; i++) h = (h * 31 + clef.charCodeAt(i)) | 0;
  return Math.abs(h % 100000) + 2000;
}

let instance: NotificationPort | null = null;

/** Port adapté à l'enveloppe courante. */
export function notifications(): NotificationPort {
  instance ??= isNativePlatform() ? new NativeNotifications() : new WebNotifications();
  return instance;
}

/** Réservé aux tests : force un port et oublie l'instance mémorisée. */
export function setNotificationPort(port: NotificationPort | null): void {
  instance = port;
}

export { NativeNotifications, WebNotifications };
