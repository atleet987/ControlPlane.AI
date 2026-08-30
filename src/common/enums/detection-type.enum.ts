/** Categories of signal a detector can emit. */
export enum DetectionType {
  PII = 'pii',
  TOXICITY = 'toxicity',
  PROMPT_INJECTION = 'prompt_injection',
  SECRET = 'secret',
  /** Slow path: does the response follow from the provided grounding? */
  ENTAILMENT = 'entailment',
  /** Slow path: LLM-as-judge rubric score. */
  JUDGE = 'judge',
}

/** Which detection lane produced a signal. */
export enum DetectionPath {
  FAST = 'fast',
  SLOW = 'slow',
}

/** Whether the text being inspected is inbound to the LLM or outbound to the client. */
export enum InspectionStage {
  REQUEST = 'request',
  RESPONSE = 'response',
}
