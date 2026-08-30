import { DecisionAction, DetectionPath, DetectionType, RiskTier } from '../../common/enums';
import { DetectionSignal } from '../../common/interfaces';
import { ResolvedPolicy } from '../policy-config/interfaces/policy.interface';
import { ThresholdResolver } from './threshold.resolver';

const signal = (type: DetectionType, score: number): DetectionSignal => ({
  type,
  path: DetectionPath.FAST,
  detector: 'test',
  score,
});

const policy = (thresholds: ResolvedPolicy['thresholds']): ResolvedPolicy => ({
  useCaseId: 'test',
  version: 1,
  riskTier: RiskTier.MEDIUM,
  thresholds,
  slowPathEnabled: true,
  defaultAction: DecisionAction.ALLOW,
});

describe('ThresholdResolver', () => {
  const resolver = new ThresholdResolver();

  const bands = policy({
    [DetectionType.PII]: { enabled: true, editAt: 0.5, escalateAt: 0.8, blockAt: 0.95 },
  });

  it.each([
    [0.2, DecisionAction.ALLOW],
    [0.5, DecisionAction.EDIT],
    [0.79, DecisionAction.EDIT],
    [0.8, DecisionAction.ESCALATE],
    [0.94, DecisionAction.ESCALATE],
    [0.95, DecisionAction.BLOCK],
    [1, DecisionAction.BLOCK],
  ])('scores %s as %s', (score, expected) => {
    expect(resolver.resolve(signal(DetectionType.PII, score), bands)).toBe(expected);
  });

  it('ignores a signal type the policy does not configure', () => {
    expect(resolver.resolve(signal(DetectionType.TOXICITY, 0.99), bands)).toBe(
      DecisionAction.ALLOW,
    );
  });

  it('ignores a detector the policy explicitly disables', () => {
    const disabled = policy({ [DetectionType.PII]: { enabled: false, blockAt: 0.1 } });

    expect(resolver.resolve(signal(DetectionType.PII, 0.99), disabled)).toBe(DecisionAction.ALLOW);
  });

  it('picks the most severe band when bands are misordered', () => {
    // blockAt below escalateAt is a misconfiguration; it must not resolve down.
    const misordered = policy({
      [DetectionType.PII]: { enabled: true, escalateAt: 0.9, blockAt: 0.4 },
    });

    expect(resolver.resolve(signal(DetectionType.PII, 0.95), misordered)).toBe(
      DecisionAction.BLOCK,
    );
  });

  describe('severity ordering', () => {
    it('ranks tiers allow < edit < escalate < block', () => {
      const order = [
        DecisionAction.ALLOW,
        DecisionAction.EDIT,
        DecisionAction.ESCALATE,
        DecisionAction.BLOCK,
      ].map((a) => ThresholdResolver.severityOf(a));

      expect(order).toEqual([0, 1, 2, 3]);
    });

    it('merges to the more severe of two actions', () => {
      expect(ThresholdResolver.moreSevere(DecisionAction.EDIT, DecisionAction.BLOCK)).toBe(
        DecisionAction.BLOCK,
      );
      expect(ThresholdResolver.moreSevere(DecisionAction.ESCALATE, DecisionAction.ALLOW)).toBe(
        DecisionAction.ESCALATE,
      );
    });
  });
});
