import { Injectable } from '@nestjs/common';
import { DetectionPath, DetectionType } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector } from '../interfaces';

/**
 * Slow path: checks that the model's claims are entailed by the grounding
 * passages (NLI-style). Only meaningful when grounding sources are supplied.
 */
@Injectable()
export class EntailmentDetector implements Detector {
  readonly name = 'nli-entailment';
  readonly type = DetectionType.ENTAILMENT;
  readonly path = DetectionPath.SLOW;

  supports(context: InspectionContext): boolean {
    return (context.groundingSources?.length ?? 0) > 0;
  }

  detect(_context: InspectionContext): Promise<DetectionSignal[]> {
    // TODO: split into claims, score each against grounding, emit the worst.
    return Promise.resolve([]);
  }
}
