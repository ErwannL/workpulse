import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadConfiguration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = loadConfiguration();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  configureApp(app, config);
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
