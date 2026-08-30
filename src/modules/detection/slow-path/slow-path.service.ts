import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector, SLOW_PATH_DETECTORS } from '../interfaces';

/**
 * Runs verification detectors that are allowed to cost hundreds of milliseconds.
 * Callers choose whether to await this inline (high-risk tiers) or let it settle
 * out-of-band and reconcile through the audit stream.
 */
@Injectable()
export class SlowPathService {
  private readonly logger = new Logger(SlowPathService.name);

  constructor(
    @Inject(SLOW_PATH_DETECTORS) private readonly detectors: Detector[],
    private readonly configService: ConfigService,
  ) {}

  run(_context: InspectionContext): Promise<DetectionSignal[]> {
    // TODO: honour `detection.slowPathEnabled` and per-policy slowPathEnabled,
    // then fan out under `detection.slowPathTimeoutMs`.
    throw new Error('SlowPathService.run not implemented');
  }
}
