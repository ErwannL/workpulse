import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SyncModule } from './sync/sync.module';
import { SummaryModule } from './summary/summary.module';
import { loadConfiguration } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfiguration], cache: true }),
    // Une synchronisation est un gros appel peu fréquent : la limite protège
    // surtout d'une boucle client emballée.
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120) },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    SyncModule,
    SummaryModule,
  ],
  providers: [
    // `ThrottlerModule.forRoot` ne fait que configurer : sans ce garde global,
    // aucune limite n'est réellement appliquée.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
