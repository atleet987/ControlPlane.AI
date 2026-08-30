import { Inject, Injectable, Logger } from '@nestjs/common';
import { DetectionPath, DetectionType } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector } from '../interfaces';
import { JUDGE_PROVIDER, JudgeProvider } from './judge/judge-provider.interface';
import { severityOfVerdict } from './judge/verdict-severity';

/**
 * Slow path: AI-as-judge, the fallback verification step when deterministic
 * entailment cannot settle a response. Costly, so it is gated by risk tier and
 * typically sampled rather than run on every call.
 *
 * The detector holds no provider knowledge — it talks to `JudgeProvider`, so
 * the model behind it is a configuration concern.
 */
@Injectable()
export class JudgeDetector implements Detector {
  readonly name = 'llm-judge';
  readonly type = DetectionType.JUDGE;
  readonly path = DetectionPath.SLOW;

  private readonly logger = new Logger(JudgeDetector.name);

  constructor(@Inject(JUDGE_PROVIDER) private readonly provider: JudgeProvider) {}

  supports(_context: InspectionContext): boolean {
    // Without credentials there is nothing to call, so skip rather than fail
    // the whole slow-path lane.
    return this.provider.isConfigured();
  }

  async detect(context: InspectionContext): Promise<DetectionSignal[]> {
    const verdict = await this.provider.judge({
      content: context.content,
      groundingSources: context.groundingSources,
      useCaseId: context.useCaseId,
    });

    this.logger.debug(
      `Judge verdict ${verdict.label} (${verdict.confidence}) for trace ${context.traceId}`,
    );

    // A signal is emitted for every verdict, including `verified` at severity 0,
    // so the audit trail records that the judge ran and what it concluded.
    return [
      {
        type: DetectionType.JUDGE,
        path: DetectionPath.SLOW,
        detector: `${this.name}:${this.provider.provider}`,
        score: severityOfVerdict(verdict),
        label: verdict.label,
        evidence: verdict.reasoning,
        latencyMs: verdict.latencyMs,
      },
    ];
  }
}
