import { useEffect, useState } from 'react';

export const ROUTES = ['pulse', 'semaine', 'calendrier', 'stats', 'reglages'] as const;
export type Route = (typeof ROUTES)[number];

function parse(hash: string): Route {
  const key = hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(key) ? key : 'pulse';
}

/** Routage minimal sur le fragment d'URL : le bouton retour du téléphone fonctionne. */
export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = `#/${r}`;
  };

  return [route, navigate];
}
