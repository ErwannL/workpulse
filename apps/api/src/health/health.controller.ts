import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  checks: { database: 'up' | 'down' };
}

/** Sonde minimale utilisée par le conteneur, le proxy et la supervision. */
export interface DatabaseProbe {
  $queryRawUnsafe(query: string): Promise<unknown>;
}

/** Version du paquet, injectée par npm au lancement. */
export function version(env: NodeJS.ProcessEnv = process.env): string {
  return env.npm_package_version ?? '0.0.0';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'L’application répond-elle ?' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'L’application peut-elle servir du trafic ?' })
  async ready(db: DatabaseProbe = this.prisma): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'up';
    try {
      await db.$queryRawUnsafe('SELECT 1');
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      version: version(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database },
    };
  }
}
