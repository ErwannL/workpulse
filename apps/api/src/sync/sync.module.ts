import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { PrismaSyncPort } from './sync.port';

/**
 * `SyncPort` est injecté par jeton : la logique de synchronisation ne dépend
 * jamais de Prisma directement, ce qui la rend testable sans base.
 */
export const SYNC_PORT = Symbol('SYNC_PORT');

@Module({
  imports: [AuthModule],
  controllers: [SyncController],
  providers: [
    PrismaSyncPort,
    { provide: SYNC_PORT, useExisting: PrismaSyncPort },
    {
      provide: SyncService,
      useFactory: (port: PrismaSyncPort) => new SyncService(port),
      inject: [PrismaSyncPort],
    },
  ],
  exports: [SyncService, PrismaSyncPort],
})
export class SyncModule {}
