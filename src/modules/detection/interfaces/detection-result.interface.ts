import { DetectionSignal } from '../../../common/interfaces';

export interface DetectionResult {
  traceId: string;
  signals: DetectionSignal[];
  /** True when a lane hit its timeout budget and was cut short. */
  fastPathTimedOut: boolean;
  slowPathTimedOut: boolean;
  slowPathSkipped: boolean;
  totalLatencyMs: number;
}
