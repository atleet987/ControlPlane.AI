import { Injectable } from '@nestjs/common';
import { DetectionPath, DetectionType } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector } from '../interfaces';

/**
 * Fast path: lexicon and small-classifier toxicity scoring. Intended to run
 * in-process against a local model or a term list — not a remote API.
 */
@Injectable()
export class ToxicityDetector implements Detector {
  readonly name = 'lexicon-toxicity';
  readonly type = DetectionType.TOXICITY;
  readonly path = DetectionPath.FAST;

  supports(_context: InspectionContext): boolean {
    return true;
  }

  detect(_context: InspectionContext): Promise<DetectionSignal[]> {
    // TODO: score against the toxicity lexicon / local classifier.
    return Promise.resolve([]);
  }
}
