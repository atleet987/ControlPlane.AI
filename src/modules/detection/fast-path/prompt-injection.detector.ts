import { Injectable } from '@nestjs/common';
import { DetectionPath, DetectionType, InspectionStage } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector } from '../interfaces';

const PATTERNS: Array<{ label: string; score: number; pattern: RegExp }> = [
  {
    label: 'INSTRUCTION_OVERRIDE',
    score: 0.92,
    pattern:
      /\b(?:ignore|disregard|forget)\b[^.!?]{0,40}\b(?:previous|prior|above|earlier|all)\b[^.!?]{0,20}\b(?:instructions?|prompts?|rules?|directions?)\b/i,
  },
  {
    label: 'SYSTEM_PROMPT_EXFIL',
    score: 0.88,
    pattern:
      /\b(?:reveal|show|print|repeat|output)\b[^.!?]{0,30}\b(?:system prompt|initial instructions|your instructions)\b/i,
  },
  {
    label: 'ROLE_OVERRIDE',
    score: 0.75,
    pattern:
      /\byou are now\b|\bact as (?:an? )?(?:unrestricted|unfiltered|jailbroken)\b|\bdeveloper mode\b/i,
  },
  {
    label: 'GUARDRAIL_BYPASS',
    score: 0.8,
    pattern:
      /\b(?:bypass|override|turn off|disable)\b[^.!?]{0,30}\b(?:safety|guardrails?|filters?|restrictions?|policy)\b/i,
  },
];

/**
 * Fast path: pattern matching for prompt-injection attempts.
 *
 * Only meaningful on inbound content — a model repeating the phrase back in a
 * response is not itself an attack, so the detector scopes itself to REQUEST.
 */
@Injectable()
export class PromptInjectionDetector implements Detector {
  readonly name = 'regex-prompt-injection';
  readonly type = DetectionType.PROMPT_INJECTION;
  readonly path = DetectionPath.FAST;

  supports(context: InspectionContext): boolean {
    return context.stage === InspectionStage.REQUEST && context.content.length > 0;
  }

  detect(context: InspectionContext): Promise<DetectionSignal[]> {
    const startedAt = Date.now();
    const signals: DetectionSignal[] = [];

    for (const { label, score, pattern } of PATTERNS) {
      const match = pattern.exec(context.content);
      if (match) {
        signals.push({
          type: DetectionType.PROMPT_INJECTION,
          path: DetectionPath.FAST,
          detector: this.name,
          score,
          label,
          spans: [{ start: match.index, end: match.index + match[0].length }],
          evidence: `Matched "${match[0].slice(0, 80)}"`,
          latencyMs: Date.now() - startedAt,
        });
      }
    }

    return Promise.resolve(signals);
  }
}
