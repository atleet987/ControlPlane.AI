import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditQueryService, DecisionCounts, RecentDecision } from './audit-query.service';

/**
 * Read-only view over the persisted audit trail. Backs the demo sidebar and
 * counters, so what they show is what was actually written to the log.
 */
@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @Get('recent')
  @ApiOperation({ summary: 'Most recent decisions, newest first' })
  recent(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<RecentDecision[]> {
    return this.auditQueryService.recent(limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Decision counts by tier' })
  stats(): Promise<DecisionCounts> {
    return this.auditQueryService.counts();
  }
}
