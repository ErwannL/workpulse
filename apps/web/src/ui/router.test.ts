import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTES, useRoute } from './router';

beforeEach(() => {
  window.location.hash = '';
});

describe('useRoute', () => {
  it('ouvre le tableau de bord par défaut', () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current[0]).toBe('pulse');
  });

  it('lit la route du fragment d’URL', () => {
    window.location.hash = '#/calendrier';
    const { result } = renderHook(() => useRoute());
    expect(result.current[0]).toBe('calendrier');
  });

  it('retombe sur le tableau de bord pour une route inconnue', () => {
    window.location.hash = '#/inexistant';
    const { result } = renderHook(() => useRoute());
    expect(result.current[0]).toBe('pulse');
  });

  it('navigue en écrivant dans le fragment', () => {
    const { result } = renderHook(() => useRoute());
    act(() => result.current[1]('stats'));
    expect(window.location.hash).toBe('#/stats');
  });

  it('réagit au bouton retour du navigateur', () => {
    const { result } = renderHook(() => useRoute());
    act(() => {
      window.location.hash = '#/semaine';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current[0]).toBe('semaine');
  });

  it('déclare exactement les cinq onglets de l’application', () => {
    expect(ROUTES).toEqual(['pulse', 'semaine', 'calendrier', 'stats', 'reglages']);
  });
});
