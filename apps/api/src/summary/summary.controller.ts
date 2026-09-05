import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeviceGuard, type RequestWithDevice } from '../auth/device.guard';
import { SummaryQueryDto } from '../sync/sync.dto';
import { SummaryService, type WeekSummaryResponse } from './summary.service';

@ApiTags('summary')
@ApiBearerAuth()
@UseGuards(DeviceGuard)
@Controller({ path: 'summary', version: '1' })
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get('week')
  @ApiOperation({ summary: 'Solde hebdomadaire recalculé côté serveur' })
  @ApiOkResponse({ description: 'Objectif, réalisé, report et détail par journée' })
  week(
    @Req() request: RequestWithDevice,
    @Query() query: SummaryQueryDto,
  ): Promise<WeekSummaryResponse> {
    return this.summary.week(request.device!.userId, query.date);
  }
}
