import { DetectionSignal, InspectionContext } from '../../common/interfaces';
import { Detector } from './interfaces';

export interface DetectorFailure {
  detector: string;
  message: string;
}

export interface DetectorRunResult {
  signals: DetectionSignal[];
  timedOut: boolean;
  failures: DetectorFailure[];
  latencyMs: number;
}

/**
 * Shared fan-out used by both lanes.
 *
 * Three properties matter here:
 * - The whole lane races one timer, so slow detectors cannot extend the budget.
 * - A detector that throws is recorded as a failure, not propagated: one broken
 *   detector must not suppress the findings of the others.
 * - Detectors that opt out via `supports()` are never invoked.
 */
export async function runDetectors(
  detectors: Detector[],
  context: InspectionContext,
  timeoutMs: number,
): Promise<DetectorRunResult> {
  const startedAt = Date.now();
  const applicable = detectors.filter((detector) => detector.supports(context));
  const failures: DetectorFailure[] = [];

  if (applicable.length === 0) {
    return { signals: [], timedOut: false, failures, latencyMs: 0 };
  }

  let timer: NodeJS.Timeout | undefined;
  const budget = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  // Each detector settles into its own slot so partial results survive a timeout.
  const collected: DetectionSignal[][] = applicable.map(() => []);
  const running = applicable.map((detector, index) =>
    detector
      .detect(context)
      .then((signals) => {
        collected[index] = signals;
      })
      .catch((error: unknown) => {
        failures.push({
          detector: detector.name,
          message: error instanceof Error ? error.message : String(error),
        });
      }),
  );

  const outcome = await Promise.race([Promise.all(running).then(() => 'done' as const), budget]);
  if (timer) {
    clearTimeout(timer);
  }

  return {
    signals: collected.flat(),
    timedOut: outcome === 'timeout',
    failures,
    latencyMs: Date.now() - startedAt,
  };
}
