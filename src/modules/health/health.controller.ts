import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: string; uptimeSeconds: number; timestamp: string } {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  ready(): { status: string; redis: string; auditTransport: string } {
    // Redis is a cache, so an unready client is reported but not fatal.
    return {
      status: 'ok',
      redis: this.redisService.isReady() ? 'ready' : 'unavailable',
      auditTransport: this.auditService.transport,
    };
  }
}
