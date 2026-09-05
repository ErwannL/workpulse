import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter, type ErrorBody } from './http-exception.filter';
import { Logger } from '@nestjs/common';

// Le filtre journalise les exceptions inattendues : c'est son rôle, mais la
// trace n'a rien à faire dans la sortie des tests.
beforeAll(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterAll(() => {
  vi.restoreAllMocks();
});

function hostWith(url?: string) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ url }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json: json as unknown as (b: ErrorBody) => void, jsonMock: json };
}

describe('AllExceptionsFilter', () => {
  it('conserve le code et le message des exceptions HTTP', () => {
    const { host, status, jsonMock } = hostWith('/v1/sync');
    new AllExceptionsFilter().catch(new BadRequestException('date invalide'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      message: 'date invalide',
      path: '/v1/sync',
    });
  });

  it('masque les erreurs inattendues derrière un 500 neutre', () => {
    const { host, status, jsonMock } = hostWith('/v1/sync');
    new AllExceptionsFilter().catch(new Error('SELECT * FROM users -- secret'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock.mock.calls[0][0].message).toBe('Erreur interne.');
  });

  it('tolère une exception qui n’est pas une Error', () => {
    const { host, jsonMock } = hostWith();
    new AllExceptionsFilter().catch('boum', host);
    expect(jsonMock.mock.calls[0][0].path).toBe('');
  });
});

describe('détail des erreurs de validation', () => {
  it('remonte la liste des champs refusés', () => {
    const { host, jsonMock } = hostWith('/v1/sync');
    new AllExceptionsFilter().catch(
      new BadRequestException({
        statusCode: 400,
        message: ['date doit être au format AAAA-MM-JJ', 'id must be a UUID'],
        error: 'Bad Request',
      }),
      host,
    );
    expect(jsonMock.mock.calls[0][0].message).toBe(
      'date doit être au format AAAA-MM-JJ ; id must be a UUID',
    );
  });

  it('remonte un message unique', () => {
    const { host, jsonMock } = hostWith('/v1/sync');
    new AllExceptionsFilter().catch(
      new BadRequestException({ statusCode: 400, message: 'lot trop volumineux' }),
      host,
    );
    expect(jsonMock.mock.calls[0][0].message).toBe('lot trop volumineux');
  });

  it('accepte un corps qui est une simple chaîne', () => {
    const { host, jsonMock } = hostWith('/v1/sync');
    // `HttpException` construit avec une chaîne renvoie cette chaîne telle
    // quelle : c'est la forme la plus simple d'une erreur métier.
    new AllExceptionsFilter().catch(new HttpException('date invalide', 400), host);
    expect(jsonMock.mock.calls[0][0].message).toBe('date invalide');
  });

  it('retombe sur le message de l’exception quand le corps n’en porte pas', () => {
    const { host, jsonMock } = hostWith('/v1/sync');
    new AllExceptionsFilter().catch(new BadRequestException({ statusCode: 400 }), host);
    expect(jsonMock.mock.calls[0][0].message).toBe('Bad Request Exception');
  });
});
