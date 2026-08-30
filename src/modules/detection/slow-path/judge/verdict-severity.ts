import { JudgeLabel, JudgeVerdict } from './judge-provider.interface';

/**
 * Converts a judge verdict into a `DetectionSignal` score, where 0 is benign
 * and 1 is maximally severe.
 *
 * The judge reports confidence in its own label; the pipeline needs severity.
 * Those are not the same number — high confidence that something is *verified*
 * is the least alarming result there is, so the mapping is per-label:
 *
 * - `contradicted`  -> severity is the confidence itself.
 * - `unverifiable`  -> halved: unproven is not the same as proven wrong, but it
 *                      is not clean either, and high-risk tiers set thresholds
 *                      low enough to act on it.
 * - `verified`      -> 0, so the signal is recorded for audit without ever
 *                      tripping a threshold.
 */
export function severityOfVerdict(verdict: JudgeVerdict): number {
  switch (verdict.label) {
    case JudgeLabel.CONTRADICTED:
      return verdict.confidence;
    case JudgeLabel.UNVERIFIABLE:
      return verdict.confidence * 0.5;
    case JudgeLabel.VERIFIED:
      return 0;
  }
}
