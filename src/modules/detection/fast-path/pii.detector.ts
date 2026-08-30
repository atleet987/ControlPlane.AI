import { Injectable } from '@nestjs/common';
import { DetectionPath, DetectionType } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector } from '../interfaces';

interface PiiPattern {
  label: string;
  pattern: RegExp;
  /** Confidence that a match is genuinely this kind of PII. */
  score: number;
  /** Optional second check to suppress structurally-valid-looking noise. */
  validate?: (match: string) => boolean;
}

/** Luhn check — keeps order numbers and IDs from being read as card numbers. */
function passesLuhn(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13) {
    return false;
  }

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Ordered most-specific first: a card number also matches the phone pattern, so
 * whichever runs first claims the span and the overlap filter drops the rest.
 */
const PATTERNS: PiiPattern[] = [
  {
    label: 'CREDIT_CARD',
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    score: 0.98,
    validate: passesLuhn,
  },
  {
    label: 'EMAIL',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    score: 0.97,
  },
  {
    label: 'AADHAAR',
    pattern: /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g,
    score: 0.9,
  },
  {
    label: 'PHONE',
    pattern: /(?:\+\d{1,3}[ -]?)?(?:\(\d{3}\)|\d{3})[ -]?\d{3}[ -]?\d{4}\b/g,
    score: 0.95,
  },
  {
    label: 'IP_ADDRESS',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    score: 0.6,
  },
];

/**
 * Fast path: deterministic pattern matching for emails, phone numbers, cards
 * and national ids. Runs in-process on every call, so there are no network
 * calls here and the whole detector stays inside the fast-path budget.
 *
 * Spans are reported so the decision engine can redact rather than block.
 */
@Injectable()
export class PiiDetector implements Detector {
  readonly name = 'regex-pii';
  readonly type = DetectionType.PII;
  readonly path = DetectionPath.FAST;

  supports(context: InspectionContext): boolean {
    return context.content.length > 0;
  }

  detect(context: InspectionContext): Promise<DetectionSignal[]> {
    const startedAt = Date.now();
    const signals: DetectionSignal[] = [];
    const claimed: Array<{ start: number; end: number }> = [];

    for (const { label, pattern, score, validate } of PATTERNS) {
      // Fresh regex per pass: the shared literals carry /g and therefore state.
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(context.content)) !== null) {
        const text = match[0];
        const start = match.index;
        const end = start + text.length;

        if (validate && !validate(text)) {
          continue;
        }
        if (claimed.some((span) => start < span.end && end > span.start)) {
          continue;
        }

        claimed.push({ start, end });
        signals.push({
          type: DetectionType.PII,
          path: DetectionPath.FAST,
          detector: this.name,
          score,
          label,
          spans: [{ start, end }],
          evidence: `${label} detected in ${context.stage} content`,
          latencyMs: Date.now() - startedAt,
        });
      }
    }

    return Promise.resolve(signals);
  }
}
