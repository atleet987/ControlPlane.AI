import { ConfigService } from '@nestjs/config';
import { JudgeConfig } from '../../../../config/configuration';
import { GeminiJudgeProvider } from './gemini-judge.provider';
import { JudgeLabel, JudgeResponseError } from './judge-provider.interface';

const generateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  ...jest.requireActual<object>('@google/generative-ai'),
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent }),
  })),
}));

const config: JudgeConfig = {
  provider: 'gemini',
  apiKey: 'test-key',
  model: 'gemini-2.5-flash',
  timeoutMs: 30_000,
};

const buildProvider = (overrides: Partial<JudgeConfig> = {}): GeminiJudgeProvider =>
  new GeminiJudgeProvider({
    getOrThrow: () => ({ ...config, ...overrides }),
  } as unknown as ConfigService);

const respondWith = (text: string): void => {
  generateContent.mockResolvedValue({ response: { text: () => text } });
};

const request = { content: 'The refund window is 90 days.', useCaseId: 'support-copilot' };

describe('GeminiJudgeProvider', () => {
  beforeEach(() => generateContent.mockReset());

  it('reports itself unconfigured without an API key', () => {
    expect(buildProvider({ apiKey: '' }).isConfigured()).toBe(false);
    expect(buildProvider().isConfigured()).toBe(true);
  });

  it('refuses to call the API when unconfigured', async () => {
    await expect(buildProvider({ apiKey: '' }).judge(request)).rejects.toThrow(JudgeResponseError);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('parses a well-formed verdict', async () => {
    respondWith(
      JSON.stringify({ label: 'contradicted', confidence: 0.87, reasoning: 'Sources say 30.' }),
    );

    const verdict = await buildProvider().judge(request);

    expect(verdict.label).toBe(JudgeLabel.CONTRADICTED);
    expect(verdict.confidence).toBe(0.87);
    expect(verdict.reasoning).toBe('Sources say 30.');
    expect(verdict.model).toBe('gemini-2.5-flash');
    expect(verdict.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('clamps an out-of-range confidence rather than discarding the verdict', async () => {
    respondWith(JSON.stringify({ label: 'verified', confidence: 1.04 }));

    expect((await buildProvider().judge(request)).confidence).toBe(1);
  });

  it('rejects a non-JSON response instead of scoring it clean', async () => {
    respondWith('I cannot answer that.');

    await expect(buildProvider().judge(request)).rejects.toThrow(JudgeResponseError);
  });

  it('rejects an unknown label', async () => {
    respondWith(JSON.stringify({ label: 'probably_fine', confidence: 0.5 }));

    await expect(buildProvider().judge(request)).rejects.toThrow(/unknown label/);
  });

  it('rejects a non-numeric confidence', async () => {
    respondWith(JSON.stringify({ label: 'verified', confidence: 'high' }));

    await expect(buildProvider().judge(request)).rejects.toThrow(/non-numeric confidence/);
  });
});
