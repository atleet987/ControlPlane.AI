import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { TRACE_ID_HEADER } from '../../common/interceptors/trace.interceptor';
import { PolicyConfigService } from '../policy-config/policy-config.service';
import { DetectionService } from './detection.service';
import { InspectDto } from './dto';
import { DetectionResult } from './interfaces';

/**
 * Direct detection endpoint, exposed for debugging and for callers that want
 * signals without the gateway's decisioning wrapped around them.
 */
@ApiTags('detection')
@Controller('detection')
export class DetectionController {
  constructor(
    private readonly detectionService: DetectionService,
    private readonly policyConfigService: PolicyConfigService,
  ) {}

  @Post('inspect')
  @ApiOperation({ summary: 'Run detection over a piece of content' })
  async inspect(
    @Body() dto: InspectDto,
    @Headers(TRACE_ID_HEADER) traceId?: string,
  ): Promise<DetectionResult> {
    const policy = await this.policyConfigService.resolve(dto.useCaseId);

    return this.detectionService.inspect(
      {
        traceId: traceId ?? randomUUID(),
        useCaseId: dto.useCaseId,
        tenantId: dto.tenantId,
        userId: dto.userId,
        stage: dto.stage,
        riskTier: policy.riskTier,
        content: dto.content,
        groundingSources: dto.groundingSources,
        metadata: dto.metadata,
        receivedAt: new Date(),
      },
      policy,
    );
  }
}
