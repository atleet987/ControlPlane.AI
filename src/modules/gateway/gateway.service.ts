import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DecisionAction, InspectionStage } from '../../common/enums';
import { InspectionContext } from '../../common/interfaces';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/interfaces/audit-event.interface';
import { DecisionEngineService } from '../decision-engine/decision-engine.service';
import { Decision } from '../decision-engine/interfaces';
import { DetectionService } from '../detection/detection.service';
import { PolicyConfigService } from '../policy-config/policy-config.service';
import { CompletionRequestDto, CompletionResponseDto } from './dto';

/** Returned to the caller when a request or response is refused outright. */
const BLOCKED_MESSAGE =
  'This response was withheld by policy. A support agent can help you directly.';

/**
 * The middleware seam itself. One call walks the full pipeline:
 *
 *   resolve policy
 *     -> inspect request  -> decide -> (block/escalate short-circuits here)
 *     -> obtain the model response
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

  async complete(dto: CompletionRequestDto, traceId?: string): Promise<CompletionResponseDto> {
    const startedAt = Date.now();
    const trace = traceId ?? randomUUID();
    const policy = await this.policyConfigService.resolve(dto.useCaseId);

    const prompt = dto.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';

    // ── Inbound ────────────────────────────────────────────────────────────
    const requestContext = this.buildContext(
      dto,
      trace,
      InspectionStage.REQUEST,
      prompt,
      policy.riskTier,
    );
    const requestDetection = await this.detectionService.inspect(
      requestContext,
      policy,
      dto.useJudge,
    );
    const requestDecision = await this.decisionEngineService.decide(
      requestContext,
      requestDetection,
      policy,
    );

    // A blocked or escalated prompt never reaches the model.
    if (requestDecision.action !== DecisionAction.ALLOW) {
      this.recordDecision(requestContext, requestDecision, prompt);
      return this.present(
        requestDecision,
        prompt,
        policy.version,
        startedAt,
        InspectionStage.REQUEST,
      );
    }

    // ── Model call ─────────────────────────────────────────────────────────
    // The demo supplies the completion directly so each tier can be exercised
    // deterministically; a live provider call would slot in here unchanged.
    const completion = dto.simulatedResponse ?? '';

    // ── Outbound ───────────────────────────────────────────────────────────
    const responseContext = this.buildContext(
      dto,
      trace,
      InspectionStage.RESPONSE,
      completion,
      policy.riskTier,
    );
    const responseDetection = await this.detectionService.inspect(
      responseContext,
      policy,
      dto.useJudge,
    );
    const responseDecision = await this.decisionEngineService.decide(
      responseContext,
      responseDetection,
      policy,
    );

    this.recordDecision(responseContext, responseDecision, completion);
    return this.present(
      responseDecision,
      completion,
      policy.version,
      startedAt,
      InspectionStage.RESPONSE,
    );
  }

  private buildContext(
    dto: CompletionRequestDto,
    traceId: string,
    stage: InspectionStage,
    content: string,
    riskTier: InspectionContext['riskTier'],
  ): InspectionContext {
    return {
      traceId,
      useCaseId: dto.useCaseId,
      tenantId: dto.tenantId,
      userId: dto.userId,
      stage,
      riskTier,
      content,
      // Grounding only applies to what the model said, not what was asked.
      groundingSources: stage === InspectionStage.RESPONSE ? dto.groundingSources : undefined,
      metadata: dto.metadata,
      receivedAt: new Date(),
    };
  }

  /** Shapes the decision into what the caller sees, applying redactions. */
  private present(
    decision: Decision,
    content: string,
    policyVersion: number,
    startedAt: number,
    stage: InspectionStage,
  ): CompletionResponseDto {
    const base = {
      traceId: decision.traceId,
      action: decision.action,
      reasons: decision.reasons,
      signals: decision.triggeringSignals,
      stage,
      policyVersion,
      latencyMs: Date.now() - startedAt,
    };

    switch (decision.action) {
      case DecisionAction.ALLOW:
        return { ...base, content };

      case DecisionAction.EDIT:
        return {
          ...base,
          content: DecisionEngineService.applyEdits(content, decision.edits),
          edits: decision.edits,
        };

      case DecisionAction.ESCALATE:
        // Held, not destroyed: a reviewer needs the original text.
        return {
          ...base,
          content: undefined,
          escalationId: decision.traceId,
          heldContent: content,
        };

      case DecisionAction.BLOCK:
        return { ...base, content: BLOCKED_MESSAGE };
    }
  }

  /** Audit is fire-and-forget — never on the critical path of the response. */
  private recordDecision(context: InspectionContext, decision: Decision, content: string): void {
    const eventType =
      decision.action === DecisionAction.BLOCK
        ? AuditEventType.REQUEST_BLOCKED
        : decision.action === DecisionAction.ESCALATE
          ? AuditEventType.ESCALATION_RAISED
          : AuditEventType.DECISION_MADE;

    this.auditService.emitAsync({
      eventType,
      traceId: context.traceId,
      useCaseId: context.useCaseId,
      tenantId: context.tenantId,
      userId: context.userId,
      stage: context.stage,
      riskTier: context.riskTier,
      action: decision.action,
      signals: decision.triggeringSignals,
      reasons: decision.reasons,
      policyVersion: decision.policyVersion,
      contentHash: AuditService.hashContent(content),
      latencyMs: decision.latencyMs,
    });
  }
}
