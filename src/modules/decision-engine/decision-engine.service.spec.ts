import {
  DecisionAction,
  DetectionPath,
  DetectionType,
  InspectionStage,
  RiskTier,
} from '../../common/enums';
import { DetectionSignal, InspectionContext } from '../../common/interfaces';
import { DetectionResult } from '../detection/interfaces';
import { ResolvedPolicy } from '../policy-config/interfaces/policy.interface';
import { DecisionEngineService } from './decision-engine.service';
import { ThresholdResolver } from './threshold.resolver';

const context: InspectionContext = {
  traceId: 'trace-1',
  useCaseId: 'customer-support',
  stage: InspectionStage.RESPONSE,
  riskTier: RiskTier.MEDIUM,
  content: 'Call me on 415-555-0142 or email a@b.com',
  receivedAt: new Date(),
};

const policy: ResolvedPolicy = {
  useCaseId: 'customer-support',
  version: 3,
  riskTier: RiskTier.MEDIUM,
  thresholds: {
    [DetectionType.PII]: { enabled: true, editAt: 0.5, escalateAt: 0.99 },
    [DetectionType.TOXICITY]: { enabled: true, escalateAt: 0.7, blockAt: 0.9 },
  },
  slowPathEnabled: true,
  defaultAction: DecisionAction.ESCALATE,
};

const detection = (
  signals: DetectionSignal[],
  overrides: Partial<DetectionResult> = {},
): DetectionResult => ({
  traceId: 'trace-1',
  signals,
  fastPathTimedOut: false,
  slowPathTimedOut: false,
  slowPathSkipped: false,
  totalLatencyMs: 5,
  ...overrides,
});

const pii = (label: string, score: number, start: number, end: number): DetectionSignal => ({
  type: DetectionType.PII,
  path: DetectionPath.FAST,
  detector: 'regex-pii',
  score,
  label,
  spans: [{ start, end }],
});

describe('DecisionEngineService', () => {
  const build = () => new DecisionEngineService([], new ThresholdResolver());

  it('allows when nothing crosses a threshold', async () => {
    const decision = await build().decide(context, detection([]), policy);

    expect(decision.action).toBe(DecisionAction.ALLOW);
    expect(decision.triggeringSignals).toHaveLength(0);
    expect(decision.reasons[0]).toMatch(/No detector exceeded/);
  });

  it('takes the most severe action across several signals', async () => {
    const signals = [
      pii('PHONE', 0.95, 11, 23),
      {
        type: DetectionType.TOXICITY,
        path: DetectionPath.FAST,
        detector: 'lexicon-toxicity',
        score: 0.95,
        label: 'SEVERE',
      } as DetectionSignal,
    ];

    const decision = await build().decide(context, detection(signals), policy);

    // PII alone would only edit; the toxicity signal blocks, and block wins.
    expect(decision.action).toBe(DecisionAction.BLOCK);
    expect(decision.triggeringSignals).toHaveLength(2);
  });

  it('builds redactions from detector spans on an edit', async () => {
    const decision = await build().decide(
      context,
      detection([pii('PHONE', 0.95, 11, 23), pii('EMAIL', 0.97, 33, 40)]),
      policy,
    );

    expect(decision.action).toBe(DecisionAction.EDIT);
    expect(decision.edits).toHaveLength(2);
    // Sorted by start offset.
    expect(decision.edits?.[0].start).toBeLessThan(decision.edits![1].start);
    expect(decision.edits?.[0].replacement).toBe('[REDACTED:PHONE]');
  });

  it('records the policy version that produced the decision', async () => {
    const decision = await build().decide(context, detection([]), policy);

    expect(decision.policyVersion).toBe(3);
  });

  it('fails upward to the policy default when the slow path times out', async () => {
    const decision = await build().decide(
      context,
      detection([], { slowPathTimedOut: true }),
      policy,
    );

    expect(decision.action).toBe(DecisionAction.ESCALATE);
    expect(decision.reasons.join(' ')).toMatch(/timed out/);
  });

  it('lets a registered rule raise severity but never lower it', async () => {
    const raising = {
      name: 'critical-tier-guard',
      priority: 10,
      evaluate: () => ({
        matched: true,
        action: DecisionAction.ESCALATE,
        reason: 'critical tier',
        score: 1,
      }),
    };
    const lowering = {
      name: 'permissive-rule',
      priority: 1,
      evaluate: () => ({
        matched: true,
        action: DecisionAction.ALLOW,
        reason: 'looks fine to me',
        score: 0,
      }),
    };

    const engine = new DecisionEngineService([lowering, raising], new ThresholdResolver());
    const decision = await engine.decide(context, detection([]), policy);

    expect(decision.action).toBe(DecisionAction.ESCALATE);
  });

  describe('applyEdits', () => {
    it('redacts without corrupting later offsets', () => {
      const text = 'Call me on 415-555-0142 or email a@b.com';
      const edits = [
        { start: 11, end: 23, replacement: '[REDACTED:PHONE]', reason: '' },
        { start: 33, end: 40, replacement: '[REDACTED:EMAIL]', reason: '' },
      ];

      expect(DecisionEngineService.applyEdits(text, edits)).toBe(
        'Call me on [REDACTED:PHONE] or email [REDACTED:EMAIL]',
      );
    });

    it('returns the content untouched when there are no edits', () => {
      expect(DecisionEngineService.applyEdits('hello')).toBe('hello');
    });
  });
});
