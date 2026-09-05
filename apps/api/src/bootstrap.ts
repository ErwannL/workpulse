import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { json } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/http-exception.filter';
import type { AppConfig } from './config/configuration';

/**
 * Configuration commune de l'application.
 *
 * Elle vit ici plutôt que dans `main.ts` pour que les tests de bout en bout
 * exercent exactement la même chaîne : en-têtes de sécurité, limite de taille,
 * validation stricte et filtre d'erreurs. Une protection qui n'existerait que
 * dans le démarrage de production ne serait vérifiée par personne.
 */
export function configureApp(
  app: INestApplication,
  config: Pick<AppConfig, 'corsOrigins'> = { corsOrigins: [] },
): INestApplication {
  app.use(helmet());

  // Un lot de synchronisation complet pèse quelques centaines de kilo-octets ;
  // au-delà, la requête est refusée avant même d'être désérialisée.
  app.use(json({ limit: '2mb' }));

  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: false,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      // Tout champ non déclaré est rejeté : un client qui invente une colonne
      // doit échouer bruyamment, pas silencieusement.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  return app;
}
