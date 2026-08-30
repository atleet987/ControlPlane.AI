import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector, FAST_PATH_DETECTORS } from '../interfaces';

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

  run(_context: InspectionContext): Promise<DetectionSignal[]> {
    // TODO: Promise.allSettled across `this.detectors` with a race against
    // config `detection.fastPathTimeoutMs`.
    throw new Error('FastPathService.run not implemented');
  }
}
