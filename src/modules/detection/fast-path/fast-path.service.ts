import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DetectionConfig } from '../../../config/configuration';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector, FAST_PATH_DETECTORS } from '../interfaces';
import { runDetectors, DetectorRunResult } from '../detector-runner';

/**
 * Runs every applicable fast detector concurrently under a hard timeout.
 * A detector that overruns is dropped, not awaited — the budget is the point.
 */
@Injectable()
export class FastPathService {
  private readonly logger = new Logger(FastPathService.name);

  constructor(
    @Inject(FAST_PATH_DETECTORS) private readonly detectors: Detector[],
    private readonly configService: ConfigService,
  ) {}

  async run(context: InspectionContext): Promise<DetectorRunResult> {
    const { fastPathTimeoutMs } = this.configService.getOrThrow<DetectionConfig>('detection');

    const result = await runDetectors(this.detectors, context, fastPathTimeoutMs);

    if (result.timedOut) {
      this.logger.warn(
        `Fast path exceeded ${fastPathTimeoutMs}ms for trace ${context.traceId}; partial signals used.`,
      );
    }
    for (const failure of result.failures) {
      this.logger.error(`Fast detector ${failure.detector} failed: ${failure.message}`);
    }

    return result;
  }

  /** Convenience for callers that only care about the signals. */
  async signals(context: InspectionContext): Promise<DetectionSignal[]> {
    return (await this.run(context)).signals;
  }
}
