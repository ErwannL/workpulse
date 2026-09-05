/** Date au format ISO court, ex. `2026-09-04`. */
export type DateISO = string;
/** Une durée exprimée en minutes. Toute la logique métier compte en minutes. */
export type Minutes = number;
/** Heure locale au format `HH:MM`. */
export type HHMM = string;

export type EntryType = 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT';

export interface TimeEntry {
  id: string;
  date: DateISO;
  type: EntryType;
  /** Horodatage epoch ms du pointage. */
  at: number;
  /** Vrai si le pointage a été saisi ou corrigé à la main. */
  manual: boolean;
  /** Horodatage de la dernière correction, si le pointage a été modifié. */
  editedAt?: number;
  /** Valeur d'origine avant correction, pour garder une trace. */
  originalAt?: number;
}

export type DayStatus =
  'WORK' | 'REMOTE' | 'HOLIDAY' | 'LEAVE' | 'RTT' | 'SICK' | 'SPECIAL' | 'OTHER';

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  WORK: 'Travail',
  REMOTE: 'Télétravail',
  HOLIDAY: 'Jour férié',
  LEAVE: 'Congé',
  RTT: 'RTT',
  SICK: 'Maladie',
  SPECIAL: 'Événement exceptionnel',
  OTHER: 'Autre',
};

/** Les statuts qui neutralisent le temps théorique de la journée. */
export const OFF_STATUSES: DayStatus[] = ['HOLIDAY', 'LEAVE', 'RTT', 'SICK', 'SPECIAL', 'OTHER'];

export interface WorkDay {
  date: DateISO;
  status: DayStatus;
  /** Jour férié mais travaillé quand même : le temps théorique redevient normal. */
  worksOnHoliday?: boolean;
  /** Change la forme de cette journée-là sans toucher à la semaine type. */
  pattern?: DayPattern;
  /** Force le temps théorique du jour (demi-journée de congé, etc.). */
  plannedOverride?: Minutes;
  notes?: string;
  updatedAt: number;
}

/**
 * Forme d'une journée de travail.
 *
 * `MORNING` et `AFTERNOON` décrivent une demi-journée : ni l'une ni l'autre
 * ne comporte de pause déjeuner, et les alertes s'alignent sur le seul créneau
 * réellement travaillé.
 */
export type DayPattern = 'FULL' | 'MORNING' | 'AFTERNOON' | 'CUSTOM' | 'OFF';

export const DAY_PATTERN_LABEL: Record<DayPattern, string> = {
  FULL: 'Journée complète',
  MORNING: 'Matin seulement',
  AFTERNOON: 'Après-midi seulement',
  CUSTOM: 'Horaires personnalisés',
  OFF: 'Non travaillé',
};

/** Horaire théorique d'une journée : durée due et créneaux de référence. */
export interface DaySchedule {
  pattern: DayPattern;
  /** Temps de travail dû, pauses exclues. */
  minutes: Minutes;
  start: HHMM;
  end: HHMM;
  /** Absents sur une demi-journée : on ne coupe pas trois heures de travail. */
  breakStart?: HHMM;
  breakEnd?: HHMM;
}

/** Horaire de chaque jour de la semaine, indexé de 1 (lundi) à 7 (dimanche). */
export type WeekSchedule = Record<number, DaySchedule>;

export interface NotificationSettings {
  enabled: boolean;
  dayStart: boolean;
  lunchStart: boolean;
  lunchEnd: boolean;
  dayEnd: boolean;
  /** Intervalle de répétition d'une alerte sans réponse, en minutes. */
  repeatMinutes: number;
  /** Durées de report proposées, en minutes. */
  snoozeOptions: Minutes[];
}

export interface Settings {
  userName: string;
  /**
   * Horaire hebdomadaire type. C'est lui qui fait foi : l'objectif de la
   * semaine est la somme de ses journées, ce qui permet un vendredi matin
   * seul sans règle particulière ailleurs.
   */
  week: WeekSchedule;
  /** Durée d'une journée complète, utilisée comme gabarit. */
  dailyMinutes: Minutes;
  overtimeCapMinutes: Minutes;
  /** Durée minimale légale de la pause déjeuner. */
  minBreakMinutes: Minutes;
  /** Si vrai, impossible de reprendre avant la pause minimale. */
  enforceMinBreak: boolean;
  notifications: NotificationSettings;
  country: 'FR';
  /** Première journée suivie par l'application. */
  trackingStart: DateISO;
  /** Solde d'heures déjà acquis avant le début du suivi. */
  initialBalance: Minutes;
}

/** État central produit par le moteur de décision. */
export type PulseState =
  | 'NOT_STARTED'
  | 'WORKING'
  | 'BREAK'
  | 'DAY_COMPLETE'
  | 'WEEK_COMPLETE'
  | 'OVERTIME_LIMIT_REACHED'
  | 'ABSENT'
  | 'HOLIDAY';

/** Tendance du compteur, indépendante de l'activité en cours. */
export type PulseTrend = 'BEHIND' | 'ON_TARGET' | 'AHEAD';

/** Phase d'activité de la journée, déduite des pointages. */
export type DayPhase = 'NOT_STARTED' | 'WORKING' | 'BREAK' | 'CLOCKED_OUT';
