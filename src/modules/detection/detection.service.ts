import { Injectable, Logger } from '@nestjs/common';
import { InspectionContext } from '../../common/interfaces';
import { FastPathService } from './fast-path/fast-path.service';
import { DetectionResult } from './interfaces';
import { SlowPathService } from './slow-path/slow-path.service';

/**
 * Orchestrates the two lanes and merges their signals into one result.
 * Fast path always runs; slow path is conditional on policy and risk tier.
 */
@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  constructor(
    private readonly fastPath: FastPathService,
    private readonly slowPath: SlowPathService,
  ) {}

  inspect(_context: InspectionContext): Promise<DetectionResult> {
    // TODO: fast path first; short-circuit on a fast blocking signal, otherwise
    // run the slow path when the policy asks for it, then merge.
    throw new Error('DetectionService.inspect not implemented');
  }
}
