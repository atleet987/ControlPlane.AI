import { Injectable } from '@nestjs/common';
import { DetectionPath, DetectionType } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { Detector } from '../interfaces';

/**
 * Term lexicon with per-band severity. A real deployment would swap this for a
 * small local classifier behind the same Detector interface — the lexicon keeps
 * the fast path dependency-free and predictable, which is what the latency
 * budget requires.
 */
const LEXICON: Array<{ label: string; score: number; terms: string[] }> = [
  {
    label: 'SEVERE_TOXICITY',
    score: 0.95,
    terms: ['kill yourself', 'kys', 'go die'],
  },
  {
    label: 'HARASSMENT',
    score: 0.85,
    terms: ['idiot', 'moron', 'stupid', 'worthless', 'incompetent', 'pathetic'],
  },
  {
    label: 'THREAT',
    score: 0.9,
    terms: ['i will find you', 'you will regret', 'watch your back'],
  },
  {
    label: 'PROFANITY',
    score: 0.6,
    terms: ['damn', 'hell'],
  },
];

const escapeRegex = (term: string): string => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Fast path: lexicon-based toxicity scoring over the inspected content.
 * Highest-severity match per band wins; the detector reports, it never decides.
 */
@Injectable()
export class ToxicityDetector implements Detector {
  readonly name = 'lexicon-toxicity';
  readonly type = DetectionType.TOXICITY;
  readonly path = DetectionPath.FAST;

  supports(context: InspectionContext): boolean {
    return context.content.length > 0;
  }

  detect(context: InspectionContext): Promise<DetectionSignal[]> {
    const startedAt = Date.now();
    const signals: DetectionSignal[] = [];

    for (const band of LEXICON) {
      for (const term of band.terms) {
        // Word-boundary match so "class" does not trip on "ass"-style substrings.
        const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
        const match = regex.exec(context.content);

        if (match) {
          signals.push({
            type: DetectionType.TOXICITY,
            path: DetectionPath.FAST,
            detector: this.name,
            score: band.score,
            label: band.label,
            spans: [{ start: match.index, end: match.index + match[0].length }],
            evidence: `Matched "${match[0]}" (${band.label.toLowerCase().replace('_', ' ')})`,
            latencyMs: Date.now() - startedAt,
          });
          // One signal per band is enough — severity does not stack.
          break;
        }
      }
    }

    return Promise.resolve(signals);
  }
}
