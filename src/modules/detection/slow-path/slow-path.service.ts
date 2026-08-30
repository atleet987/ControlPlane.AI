import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DetectionConfig } from '../../../config/configuration';
import { InspectionContext } from '../../../common/interfaces';
import { Detector, SLOW_PATH_DETECTORS } from '../interfaces';
import { DetectorRunResult, runDetectors } from '../detector-runner';

/**
 * Runs verification detectors that are allowed to cost seconds rather than
 * milliseconds. Callers choose whether to await this inline (high-risk tiers)
 * or let it settle out-of-band and reconcile through the audit stream.
 */
@Injectable()
export class SlowPathService {
  private readonly logger = new Logger(SlowPathService.name);

  constructor(
    @Inject(SLOW_PATH_DETECTORS) private readonly detectors: Detector[],
    private readonly configService: ConfigService,
  ) {}

  /** Global kill switch; per-policy opt-out is the caller's decision. */
  isEnabled(): boolean {
    return this.configService.getOrThrow<DetectionConfig>('detection').slowPathEnabled;
  }

  async run(context: InspectionContext, detectorNames?: string[]): Promise<DetectorRunResult> {
    const { slowPathTimeoutMs } = this.configService.getOrThrow<DetectionConfig>('detection');

    // A caller may narrow the lane — the gateway uses this to keep the costly
    // LLM judge off calls that did not ask for it.
    const selected = detectorNames
      ? this.detectors.filter((detector) => detectorNames.includes(detector.name))
      : this.detectors;

    const result = await runDetectors(selected, context, slowPathTimeoutMs);

    if (result.timedOut) {
      this.logger.warn(
        `Slow path exceeded ${slowPathTimeoutMs}ms for trace ${context.traceId}; partial signals used.`,
      );
    }
    for (const failure of result.failures) {
      this.logger.error(`Slow detector ${failure.detector} failed: ${failure.message}`);
    }

    return result;
  }
}
