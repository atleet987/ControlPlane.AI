import { DetectionType, InspectionStage, RiskTier } from '../../../common/enums';
import { InspectionContext } from '../../../common/interfaces';
import { JudgeLabel, JudgeProvider } from './judge/judge-provider.interface';
import { JudgeDetector } from './judge.detector';

const context: InspectionContext = {
  traceId: 'trace-1',
  useCaseId: 'support-copilot',
  stage: InspectionStage.RESPONSE,
  riskTier: RiskTier.HIGH,
  content: 'The refund window is 90 days.',
  groundingSources: ['Refunds are accepted within 30 days of purchase.'],
  receivedAt: new Date(),
};

const providerStub = (overrides: Partial<JudgeProvider> = {}): JudgeProvider => ({
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  isConfigured: () => true,
  judge: jest.fn().mockResolvedValue({
    label: JudgeLabel.CONTRADICTED,
    confidence: 0.87,
    reasoning: 'Sources say 30 days, output says 90.',
    model: 'gemini-2.5-flash',
    latencyMs: 120,
  }),
  ...overrides,
});

describe('JudgeDetector', () => {
  it('skips itself when the provider has no credentials', () => {
    const detector = new JudgeDetector(providerStub({ isConfigured: () => false }));

    expect(detector.supports(context)).toBe(false);
  });

  it('maps a contradiction into a scored signal', async () => {
    const detector = new JudgeDetector(providerStub());

    const [signal] = await detector.detect(context);

    expect(signal.type).toBe(DetectionType.JUDGE);
    expect(signal.label).toBe(JudgeLabel.CONTRADICTED);
    expect(signal.score).toBe(0.87);
    expect(signal.detector).toBe('llm-judge:gemini');
    expect(signal.evidence).toContain('30 days');
  });

  it('still emits a signal for a verified verdict, so the audit records the run', async () => {
    const detector = new JudgeDetector(
      providerStub({
        judge: jest.fn().mockResolvedValue({
          label: JudgeLabel.VERIFIED,
          confidence: 0.95,
          model: 'gemini-2.5-flash',
          latencyMs: 90,
        }),
      }),
    );

    const [signal] = await detector.detect(context);

    expect(signal.label).toBe(JudgeLabel.VERIFIED);
    expect(signal.score).toBe(0);
  });

  it('passes grounding sources through to the provider', async () => {
    const judge = jest.fn().mockResolvedValue({
      label: JudgeLabel.VERIFIED,
      confidence: 0.9,
      model: 'gemini-2.5-flash',
      latencyMs: 80,
    });

    await new JudgeDetector(providerStub({ judge })).detect(context);

    expect(judge).toHaveBeenCalledWith({
      content: context.content,
      groundingSources: context.groundingSources,
      useCaseId: context.useCaseId,
    });
  });
});
