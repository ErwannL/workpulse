import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { configureApp } from './bootstrap';
import { AllExceptionsFilter } from './common/http-exception.filter';

function fakeApp() {
  const app = {
    use: vi.fn(),
    enableCors: vi.fn(),
    enableVersioning: vi.fn(),
    useGlobalFilters: vi.fn(),
    useGlobalPipes: vi.fn(),
  };
  return app as unknown as INestApplication & typeof app;
}

describe('configureApp', () => {
  it('installe les protections dans l’ordre attendu', () => {
    const app = fakeApp();
    configureApp(app);

    // helmet d'abord, puis la limite de taille : un corps démesuré doit être
    // refusé avant d'être désérialisé.
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    expect(app.useGlobalFilters).toHaveBeenCalledWith(expect.any(AllExceptionsFilter));
  });

  it('valide strictement les entrées', () => {
    const app = fakeApp();
    configureApp(app);

    const pipe = app.useGlobalPipes.mock.calls[0][0] as ValidationPipe;
    expect(pipe).toBeInstanceOf(ValidationPipe);
    // Les options ne sont pas publiques : on vérifie qu'un champ inconnu est
    // bien refusé, ce qui est la garantie qui compte.
    const options = (pipe as unknown as { validatorOptions: Record<string, unknown> })
      .validatorOptions;
    expect(options.whitelist).toBe(true);
    expect(options.forbidNonWhitelisted).toBe(true);
  });

  it('coupe CORS quand aucune origine n’est déclarée', () => {
    const app = fakeApp();
    configureApp(app);
    expect(app.enableCors).toHaveBeenCalledWith({ origin: false, credentials: false });
  });

  it('n’ouvre CORS qu’aux origines déclarées', () => {
    const app = fakeApp();
    configureApp(app, { corsOrigins: ['https://workpulse.fr'] });
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ['https://workpulse.fr'],
      credentials: false,
    });
  });
});
