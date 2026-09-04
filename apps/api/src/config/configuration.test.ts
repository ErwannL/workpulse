import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadConfiguration } from './configuration';

const base = { DATABASE_URL: 'postgresql://localhost/db' } as NodeJS.ProcessEnv;

describe('loadConfiguration', () => {
  it('applique les valeurs par défaut', () => {
    const config = loadConfiguration(base);
    expect(config.port).toBe(3000);
    expect(config.corsOrigins).toEqual([]);
    expect(config.rateLimitPerMinute).toBe(120);
    expect(config.swaggerEnabled).toBe(true);
  });

  it('lit les valeurs fournies', () => {
    const config = loadConfiguration({
      ...base,
      PORT: '8080',
      CORS_ORIGINS: 'https://a.fr, https://b.fr',
      RATE_LIMIT_PER_MINUTE: '30',
      SWAGGER_ENABLED: 'false',
    });
    expect(config.port).toBe(8080);
    expect(config.corsOrigins).toEqual(['https://a.fr', 'https://b.fr']);
    expect(config.rateLimitPerMinute).toBe(30);
    expect(config.swaggerEnabled).toBe(false);
  });

  it('refuse de démarrer sans base de données', () => {
    expect(() => loadConfiguration({})).toThrow(ConfigurationError);
    expect(() => loadConfiguration({ DATABASE_URL: '   ' })).toThrow(/DATABASE_URL/);
  });

  it('refuse un port aberrant', () => {
    expect(() => loadConfiguration({ ...base, PORT: '0' })).toThrow(/PORT/);
    expect(() => loadConfiguration({ ...base, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfiguration({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });
});
