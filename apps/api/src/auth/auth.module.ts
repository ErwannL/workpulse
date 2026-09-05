import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DeviceGuard } from './device.guard';

@Module({
  providers: [AuthService, DeviceGuard],
  exports: [AuthService, DeviceGuard],
})
export class AuthModule {}
