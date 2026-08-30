import { Injectable } from '@nestjs/common';
import { DetectionPath, DetectionType } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector } from '../interfaces';

/**
 * Fast path: deterministic pattern + dictionary matching for emails, phone
 * numbers, card/PAN, Aadhaar-style ids and the like. Must stay inside the
 * fast-path latency budget, so no network calls here.
 */
@Injectable()
export class PiiDetector implements Detector {
  readonly name = 'regex-pii';
  readonly type = DetectionType.PII;
  readonly path = DetectionPath.FAST;

  supports(_context: InspectionContext): boolean {
    return true;
  }

  detect(_context: InspectionContext): Promise<DetectionSignal[]> {
    // TODO: pattern set + validators (Luhn etc.), emitting spans for redaction.
    return Promise.resolve([]);
  }
}
