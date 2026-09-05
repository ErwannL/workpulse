import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Enveloppe Android de la PWA.
 *
 * L'application native n'est pas un produit différent : c'est exactement le
 * même code, empaqueté pour être installé depuis un `.apk` plutôt que depuis
 * le navigateur. Le gain réel est ailleurs — les notifications locales
 * fonctionnent application fermée, ce qu'un service worker ne garantit pas.
 */
const config: CapacitorConfig = {
  appId: 'fr.erwannl.workpulse',
  appName: 'WorkPulse',
  webDir: 'dist',
  android: {
    // Le fond est peint avant le premier rendu : pas de flash blanc au lancement.
    backgroundColor: '#0A0C11',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_workpulse',
      iconColor: '#45E3AD',
    },
  },
};

export default config;
