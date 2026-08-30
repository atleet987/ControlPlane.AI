import { DetectionPath, DetectionType } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';

/**
 * Every detector implements this, fast or slow. Implementations must be
 * side-effect free and must not throw for ordinary "nothing found" cases —
 * return an empty array instead.
 */
export interface Detector {
  readonly name: string;
  readonly type: DetectionType;
  readonly path: DetectionPath;

  /** Cheap gate so the orchestrator can skip detectors a policy disabled. */
  supports(context: InspectionContext): boolean;

  detect(context: InspectionContext): Promise<DetectionSignal[]>;
}

/** DI token for the multi-provider array of fast-path detectors. */
export const FAST_PATH_DETECTORS = Symbol('FAST_PATH_DETECTORS');

/** DI token for the multi-provider array of slow-path detectors. */
export const SLOW_PATH_DETECTORS = Symbol('SLOW_PATH_DETECTORS');
