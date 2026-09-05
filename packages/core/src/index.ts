/**
 * Domaine métier WorkPulse.
 *
 * Ce paquet ne dépend de rien : ni React, ni navigateur, ni base de données.
 * Il est consommé tel quel par l'application web et par l'API, ce qui garantit
 * qu'une règle de calcul ne peut pas diverger entre le téléphone et le serveur.
 */
export * from './types.js';
export * from './time.js';
export * from './holidays.js';
export * from './settings.js';
export * from './day.js';
export * from './ledger.js';
export * from './breakRules.js';
export * from './engine.js';
export * from './alerts.js';
