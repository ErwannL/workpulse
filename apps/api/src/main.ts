import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { loadConfiguration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = loadConfiguration();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());
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
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('WorkPulse API')
        .setDescription(
          'Synchronisation optionnelle entre appareils. ' +
            'L’appareil reste la source de vérité : le serveur ne fait qu’arbitrer.',
        )
        .setVersion(process.env.npm_package_version ?? '0.0.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'Jeton d’appareil' })
        .build(),
    );
    SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });
  }

  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`API à l'écoute sur le port ${config.port}`);
}

void bootstrap();
