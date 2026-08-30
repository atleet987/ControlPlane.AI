import { InspectionStage, RiskTier } from '../../../common/enums';
import { InspectionContext } from '../../../common/interfaces';
import { PiiDetector } from './pii.detector';

const ctx = (content: string): InspectionContext => ({
  traceId: 't',
  useCaseId: 'customer-support',
  stage: InspectionStage.RESPONSE,
  riskTier: RiskTier.MEDIUM,
  content,
  receivedAt: new Date(),
});

describe('PiiDetector', () => {
  const detector = new PiiDetector();

  it('finds an email and reports a span covering it', async () => {
    const content = 'Write to dana.patel@example.com today';
    const [signal] = await detector.detect(ctx(content));

    expect(signal.label).toBe('EMAIL');
    expect(content.slice(signal.spans![0].start, signal.spans![0].end)).toBe(
      'dana.patel@example.com',
    );
  });

  it('finds a phone number', async () => {
    const signals = await detector.detect(ctx('call 415-555-0142 now'));

    expect(signals.map((s) => s.label)).toContain('PHONE');
  });

  it('accepts a Luhn-valid card number', async () => {
    const signals = await detector.detect(ctx('card 4111 1111 1111 1111 on file'));

    expect(signals.map((s) => s.label)).toContain('CREDIT_CARD');
  });

  it('rejects a Luhn-invalid number rather than crying card', async () => {
    const signals = await detector.detect(ctx('order 1234 5678 9012 3456 shipped'));

    expect(signals.map((s) => s.label)).not.toContain('CREDIT_CARD');
  });

  it('does not double-report overlapping matches', async () => {
    // A card number also matches the phone pattern; only one may claim the span.
    const signals = await detector.detect(ctx('4111 1111 1111 1111'));

    expect(signals).toHaveLength(1);
    expect(signals[0].label).toBe('CREDIT_CARD');
  });

  it('reports every distinct item in one pass', async () => {
    const signals = await detector.detect(
      ctx('reach me at a.b@example.com or 415-555-0142 or 212-555-0199'),
    );

    expect(signals.filter((s) => s.label === 'PHONE')).toHaveLength(2);
    expect(signals.filter((s) => s.label === 'EMAIL')).toHaveLength(1);
  });

  it('returns nothing for clean content', async () => {
    expect(await detector.detect(ctx('Refunds are accepted within 30 days.'))).toEqual([]);
  });

  it('is not affected by regex lastIndex state across calls', async () => {
    const content = 'mail a@b.com';
    const first = await detector.detect(ctx(content));
    const second = await detector.detect(ctx(content));

    expect(second).toHaveLength(first.length);
  });
});
