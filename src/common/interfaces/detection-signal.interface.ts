import { DetectionPath, DetectionType } from '../enums';

/** A single finding from one detector. Detectors never decide — they only report. */
export interface DetectionSignal {
  readonly type: DetectionType;
  readonly path: DetectionPath;
  /** Detector identifier, e.g. `regex-pii`, `nli-entailment`. */
  readonly detector: string;
  /** Normalised 0..1; higher means more likely/severe. */
  readonly score: number;
  /** Detector-specific label, e.g. `EMAIL`, `PHONE_IN`, `SEVERE_TOXICITY`. */
  readonly label?: string;
  /** Character offsets into `InspectionContext.content`, for redaction. */
  readonly spans?: Array<{ start: number; end: number }>;
  readonly evidence?: string;
  readonly latencyMs?: number;
}
