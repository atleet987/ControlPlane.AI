import { JudgeLabel, JudgeVerdict } from './judge-provider.interface';
import { severityOfVerdict } from './verdict-severity';

const verdict = (label: JudgeLabel, confidence: number): JudgeVerdict => ({
  label,
  confidence,
  model: 'gemini-2.5-flash',
  latencyMs: 10,
});

describe('severityOfVerdict', () => {
  it('scores a confident contradiction at full severity', () => {
    expect(severityOfVerdict(verdict(JudgeLabel.CONTRADICTED, 0.9))).toBe(0.9);
  });

  it('halves an unverifiable verdict — unproven is not proven wrong', () => {
    expect(severityOfVerdict(verdict(JudgeLabel.UNVERIFIABLE, 0.8))).toBe(0.4);
  });

  it('scores a verified verdict at zero regardless of confidence', () => {
    expect(severityOfVerdict(verdict(JudgeLabel.VERIFIED, 1))).toBe(0);
    expect(severityOfVerdict(verdict(JudgeLabel.VERIFIED, 0.2))).toBe(0);
  });

  it('never exceeds the 0..1 signal range', () => {
    for (const label of Object.values(JudgeLabel)) {
      const score = severityOfVerdict(verdict(label, 1));
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
