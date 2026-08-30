import { Injectable } from '@nestjs/common';
import { DetectionPath, DetectionType } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector } from '../interfaces';
import { JudgeLabel } from './judge/judge-provider.interface';
import { severityOfVerdict } from './judge/verdict-severity';

/** Words carrying no claim content, excluded from the overlap measure. */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'and',
  'or',
  'but',
  'if',
  'then',
  'than',
  'that',
  'this',
  'these',
  'those',
  'it',
  'its',
  'you',
  'your',
  'we',
  'our',
  'they',
  'their',
  'can',
  'will',
  'may',
  'from',
  'by',
  'as',
  'not',
  'no',
  'yes',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'within',
  'up',
  'out',
]);

/** Overlap below this means the response asserts things the sources never say. */
const SUPPORT_THRESHOLD = 0.4;

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/** Numbers, including percentages and decimals — the usual site of a conflict. */
function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:\.\d+)?%?/g) ?? []).map((value) => value.replace(/^0+(?=\d)/, ''));
}

/**
 * Slow path: checks that a response is supported by its grounding passages.
 *
 * This is a deterministic lexical heuristic, not a semantic entailment model.
 * It exists so the pipeline has a fast, offline first opinion; the LLM judge is
 * the fallback that handles what this cannot settle. It is intentionally
 * conservative — anything it cannot support comes back `unverifiable` rather
 * than `verified`, so an unsupported claim is never waved through.
 */
@Injectable()
export class EntailmentDetector implements Detector {
  readonly name = 'lexical-entailment';
  readonly type = DetectionType.ENTAILMENT;
  readonly path = DetectionPath.SLOW;

  supports(context: InspectionContext): boolean {
    return (context.groundingSources?.length ?? 0) > 0 && context.content.length > 0;
  }

  detect(context: InspectionContext): Promise<DetectionSignal[]> {
    const startedAt = Date.now();
    const grounding = (context.groundingSources ?? []).join('\n');

    const { label, confidence, reasoning } = this.assess(context.content, grounding);
    const score = severityOfVerdict({
      label,
      confidence,
      model: this.name,
      latencyMs: 0,
    });

    return Promise.resolve([
      {
        type: DetectionType.ENTAILMENT,
        path: DetectionPath.SLOW,
        detector: this.name,
        score,
        label,
        evidence: reasoning,
        latencyMs: Date.now() - startedAt,
      },
    ]);
  }

  private assess(
    response: string,
    grounding: string,
  ): { label: JudgeLabel; confidence: number; reasoning: string } {
    const responseNumbers = numbersIn(response);
    const groundingNumbers = new Set(numbersIn(grounding));

    // A figure the sources never state, where the sources do state figures, is
    // the clearest contradiction this heuristic can identify.
    const conflicting = responseNumbers.filter((value) => !groundingNumbers.has(value));
    if (groundingNumbers.size > 0 && conflicting.length > 0) {
      return {
        label: JudgeLabel.CONTRADICTED,
        confidence: 0.95,
        reasoning:
          `Response states ${conflicting.map((v) => `"${v}"`).join(', ')}, ` +
          `but the grounding sources state ${[...groundingNumbers].map((v) => `"${v}"`).join(', ')}.`,
      };
    }

    const responseWords = contentWords(response);
    if (responseWords.length === 0) {
      return {
        label: JudgeLabel.UNVERIFIABLE,
        confidence: 0.8,
        reasoning: 'Response carries no checkable claim content.',
      };
    }

    const groundingWords = new Set(contentWords(grounding));
    const supported = responseWords.filter((word) => groundingWords.has(word));
    const ratio = supported.length / responseWords.length;

    if (ratio >= SUPPORT_THRESHOLD) {
      return {
        label: JudgeLabel.VERIFIED,
        confidence: Math.min(1, ratio + 0.2),
        reasoning: `${Math.round(ratio * 100)}% of claim terms appear in the grounding sources.`,
      };
    }

    return {
      label: JudgeLabel.UNVERIFIABLE,
      confidence: 1 - ratio,
      reasoning:
        `Only ${Math.round(ratio * 100)}% of claim terms appear in the grounding sources; ` +
        'the response asserts details the sources do not cover.',
    };
  }
}
