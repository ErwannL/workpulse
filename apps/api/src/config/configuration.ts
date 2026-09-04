/**
 * Configuration lue une fois au démarrage. Toute variable manquante ou
 * aberrante fait échouer le boot : mieux vaut un conteneur qui refuse de
 * démarrer qu'une API qui tourne à moitié configurée.
 */
export interface AppConfig {
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  rateLimitPerMinute: number;
  swaggerEnabled: boolean;
}

export class ConfigurationError extends Error {}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim() === '') {
    throw new ConfigurationError(`Variable d'environnement manquante : ${key}`);
  }
  return value;
}

function readPort(env: NodeJS.ProcessEnv): number {
  const raw = env.PORT ?? '3000';
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError(`PORT invalide : ${raw}`);
  }
  return port;
}

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: readPort(env),
    databaseUrl: requireEnv(env, 'DATABASE_URL'),
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE ?? 120),
    swaggerEnabled: env.SWAGGER_ENABLED !== 'false',
  };
}
