import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeviceGuard, type RequestWithDevice } from '../auth/device.guard';
import { SyncPullQueryDto, SyncPushDto } from './sync.dto';
import { SyncService, type SyncResult } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(DeviceGuard)
@Controller({ path: 'sync', version: '1' })
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer ce qui a changé depuis le curseur du client' })
  @ApiOkResponse({ description: 'Lignes modifiées et nouveau curseur' })
  pull(@Req() request: RequestWithDevice, @Query() query: SyncPullQueryDto): Promise<SyncResult> {
    return this.sync.pull(request.device!.userId, query.since ?? null);
  }

  @Post()
  @ApiOperation({ summary: 'Envoyer un lot local puis récupérer le reste' })
  @ApiOkResponse({ description: 'État fusionné, conflits arbitrés et nouveau curseur' })
  push(@Req() request: RequestWithDevice, @Body() body: SyncPushDto): Promise<SyncResult> {
    return this.sync.push(request.device!.userId, body);
  }
}
