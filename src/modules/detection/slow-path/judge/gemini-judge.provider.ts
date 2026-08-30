import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  ResponseSchema,
  SchemaType,
} from '@google/generative-ai';
import { JudgeConfig } from '../../../../config/configuration';
import {
  JudgeLabel,
  JudgeProvider,
  JudgeRequest,
  JudgeResponseError,
  JudgeVerdict,
} from './judge-provider.interface';

const SYSTEM_INSTRUCTION = [
  'You are a verification judge in a content safety pipeline.',
  'Given a model output and zero or more grounding passages, decide whether the',
  'output is supported by those passages.',
  '',
  'Labels:',
  '- "verified": every substantive claim is supported by the grounding passages.',
  '- "contradicted": at least one claim conflicts with the grounding passages.',
  '- "unverifiable": there are no grounding passages, or they are silent on the claims.',
  '',
  'Judge only against the passages provided. Do not use outside knowledge, and do',
  'not treat a claim as verified because it seems plausible. Report confidence as',
  'your certainty in the label you chose, from 0 to 1.',
].join('\n');

/** Response schema handed to Gemini so the verdict comes back as strict JSON. */
const VERDICT_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    label: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: [JudgeLabel.VERIFIED, JudgeLabel.CONTRADICTED, JudgeLabel.UNVERIFIABLE],
      description: 'The verification verdict.',
    },
    confidence: {
      type: SchemaType.NUMBER,
      description: 'Certainty in the chosen label, between 0 and 1.',
    },
    reasoning: {
      type: SchemaType.STRING,
      description: 'One or two sentences justifying the label.',
    },
  },
  required: ['label', 'confidence'],
};

interface RawVerdict {
  label?: unknown;
  confidence?: unknown;
  reasoning?: unknown;
}

/**
 * Google Gemini implementation of {@link JudgeProvider}.
 *
 * Nothing outside this file knows the judge runs on Gemini. Substituting
 * another provider means adding a sibling class and pointing the
 * `JUDGE_PROVIDER` token at it — see `detection.module.ts`.
 */
@Injectable()
export class GeminiJudgeProvider implements JudgeProvider {
  readonly provider = 'gemini';
  readonly model: string;

  private readonly logger = new Logger(GeminiJudgeProvider.name);
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private client?: GenerativeModel;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<JudgeConfig>('judge');
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async judge(request: JudgeRequest): Promise<JudgeVerdict> {
    if (!this.isConfigured()) {
      throw new JudgeResponseError('GEMINI_API_KEY is not set; the judge cannot run.');
    }

    const startedAt = Date.now();
    const result = await this.getClient().generateContent(this.buildPrompt(request));
    const latencyMs = Date.now() - startedAt;

    return this.parseVerdict(result.response.text(), latencyMs);
  }

  /** Built once, on first use, so an unconfigured key never constructs a client. */
  private getClient(): GenerativeModel {
    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.apiKey).getGenerativeModel(
        {
          model: this.model,
          systemInstruction: SYSTEM_INSTRUCTION,
          generationConfig: {
            // Deterministic: the same content must not drift between verdicts.
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: VERDICT_SCHEMA,
          },
        },
        { timeout: this.timeoutMs },
      );
    }
    return this.client;
  }

  private buildPrompt(request: JudgeRequest): string {
    const sources = request.groundingSources ?? [];
    const grounding =
      sources.length > 0
        ? sources.map((source, index) => `[${index + 1}] ${source}`).join('\n\n')
        : '(none provided)';

    return [
      `Use case: ${request.useCaseId}`,
      '',
      'Grounding passages:',
      grounding,
      '',
      'Model output under review:',
      request.content,
    ].join('\n');
  }

  /**
   * The response schema makes well-formed output likely, not guaranteed — a
   * truncated or filtered response still has to be rejected rather than
   * silently scored as verified.
   */
  private parseVerdict(text: string, latencyMs: number): JudgeVerdict {
    let raw: RawVerdict;
    try {
      raw = JSON.parse(text) as RawVerdict;
    } catch {
      throw new JudgeResponseError(`Judge returned non-JSON output: ${text.slice(0, 200)}`);
    }

    const label = this.toLabel(raw.label);
    const confidence = this.toConfidence(raw.confidence);

    return {
      label,
      confidence,
      reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : undefined,
      model: this.model,
      latencyMs,
    };
  }

  private toLabel(value: unknown): JudgeLabel {
    const labels = Object.values(JudgeLabel) as string[];
    if (typeof value === 'string' && labels.includes(value)) {
      return value as JudgeLabel;
    }
    throw new JudgeResponseError(`Judge returned an unknown label: ${JSON.stringify(value)}`);
  }

  private toConfidence(value: unknown): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new JudgeResponseError(
        `Judge returned a non-numeric confidence: ${JSON.stringify(value)}`,
      );
    }
    // Clamp rather than reject: a model occasionally reporting 1.02 is a
    // formatting slip, not a reason to discard an otherwise usable verdict.
    return Math.min(1, Math.max(0, value));
  }
}
