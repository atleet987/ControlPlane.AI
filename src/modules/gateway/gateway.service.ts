import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DecisionEngineService } from '../decision-engine/decision-engine.service';
import { DetectionService } from '../detection/detection.service';
import { PolicyConfigService } from '../policy-config/policy-config.service';
import { CompletionRequestDto, CompletionResponseDto } from './dto';

/**
 * The middleware seam itself. One call walks the full pipeline:
 *
 *   resolve policy
 *     -> inspect request  -> decide -> (block/escalate short-circuits here)
 *     -> call upstream LLM
 *     -> inspect response -> decide -> apply edits
 *     -> emit audit
 */
@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    private readonly policyConfigService: PolicyConfigService,
    private readonly detectionService: DetectionService,
    private readonly decisionEngineService: DecisionEngineService,
    private readonly auditService: AuditService,
  ) {}

  complete(_dto: CompletionRequestDto, _traceId: string): Promise<CompletionResponseDto> {
    // TODO: wire the pipeline described above.
    throw new Error('GatewayService.complete not implemented');
  }
}
