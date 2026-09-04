import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SyncModule } from '../sync/sync.module';
import { PrismaSyncPort } from '../sync/sync.port';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  imports: [AuthModule, SyncModule],
  controllers: [SummaryController],
  providers: [
    {
      provide: SummaryService,
      useFactory: (port: PrismaSyncPort) => new SummaryService(port),
      inject: [PrismaSyncPort],
    },
  ],
})
export class SummaryModule {}
