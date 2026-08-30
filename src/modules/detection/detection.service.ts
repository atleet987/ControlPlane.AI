import { Injectable, Logger } from '@nestjs/common';
import { InspectionContext } from '../../common/interfaces';
import { ResolvedPolicy } from '../policy-config/interfaces/policy.interface';
import { FastPathService } from './fast-path/fast-path.service';
import { DetectionResult } from './interfaces';
import { SlowPathService } from './slow-path/slow-path.service';

/** Slow-path detectors, by name, in the order they should be considered. */
const ENTAILMENT = 'lexical-entailment';
const JUDGE = 'llm-judge';

/**
 * Orchestrates the two lanes and merges their signals into one result.
 * Fast path always runs; the slow path is conditional on policy and on whether
 * the caller asked for the costly LLM judge.
 */
@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  constructor(
    private readonly fastPath: FastPathService,
    private readonly slowPath: SlowPathService,
  ) {}

  async inspect(
    context: InspectionContext,
    policy: ResolvedPolicy,
    useJudge = false,
  ): Promise<DetectionResult> {
    const startedAt = Date.now();

    const fast = await this.fastPath.run(context);

    const slowPathSkipped = !policy.slowPathEnabled || !this.slowPath.isEnabled();
    if (slowPathSkipped) {
      return {
        traceId: context.traceId,
        signals: fast.signals,
        fastPathTimedOut: fast.timedOut,
        slowPathTimedOut: false,
        slowPathSkipped: true,
        totalLatencyMs: Date.now() - startedAt,
      };
    }

    // The deterministic entailment check always runs; the LLM judge is the
    // opt-in fallback, since it costs seconds and real money per call.
    const detectors = useJudge ? [ENTAILMENT, JUDGE] : [ENTAILMENT];
    const slow = await this.slowPath.run(context, detectors);

    return {
      traceId: context.traceId,
      signals: [...fast.signals, ...slow.signals],
      fastPathTimedOut: fast.timedOut,
      slowPathTimedOut: slow.timedOut,
      slowPathSkipped: false,
      totalLatencyMs: Date.now() - startedAt,
    };
  }
}
