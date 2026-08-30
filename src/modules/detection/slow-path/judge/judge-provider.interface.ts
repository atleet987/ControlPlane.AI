/**
 * The verdict contract for the AI-as-judge layer.
 *
 * This is deliberately provider-agnostic: it names no vendor, no SDK type and
 * no model. Any LLM that can be prompted to return a label and a confidence
 * satisfies it, so switching providers is a config change plus one new class —
 * never a change to detection, decisioning or audit.
 */

/** What the judge concluded about the content it was given. */
export enum JudgeLabel {
  /** The claims are supported by the grounding sources. */
  VERIFIED = 'verified',
  /** The claims conflict with the grounding sources. */
  CONTRADICTED = 'contradicted',
  /** Not decidable — no grounding, or the sources are silent on the claims. */
  UNVERIFIABLE = 'unverifiable',
}

export interface JudgeRequest {
  /** The model output under review. */
  content: string;
  /** Passages the content is expected to be supported by; may be empty. */
  groundingSources?: string[];
  /** Carried for prompt context and provider-side logging. */
  useCaseId: string;
}

export interface JudgeVerdict {
  label: JudgeLabel;
  /** Normalised 0..1 — the judge's confidence in its own label. */
  confidence: number;
  /** Short rationale, retained for the audit trail. */
  reasoning?: string;
  /** Which model produced this verdict, recorded per-verdict for audit. */
  model: string;
  latencyMs: number;
}

export interface JudgeProvider {
  /** Short provider identifier, surfaced in signals and health output. */
  readonly provider: string;
  /** Active model id. */
  readonly model: string;

  /** False when credentials are absent, so the detector can skip itself. */
  isConfigured(): boolean;

  judge(request: JudgeRequest): Promise<JudgeVerdict>;
}

/** DI token — the detector injects the interface, never a concrete provider. */
export const JUDGE_PROVIDER = Symbol('JUDGE_PROVIDER');

/** Raised when a provider replies with something that isn't a usable verdict. */
export class JudgeResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JudgeResponseError';
  }
}
