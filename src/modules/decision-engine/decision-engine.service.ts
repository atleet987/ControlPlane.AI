import { Inject, Injectable, Logger } from '@nestjs/common';
import { DecisionAction } from '../../common/enums';
import { DetectionSignal, InspectionContext } from '../../common/interfaces';
import { DetectionResult } from '../detection/interfaces';
import { ResolvedPolicy } from '../policy-config/interfaces/policy.interface';
import { ContentEdit, DECISION_RULES, Decision, DecisionRule } from './interfaces';
import { ThresholdResolver } from './threshold.resolver';

/**
 * Turns detection signals into exactly one of allow / edit / escalate / block.
 *
 * The engine is deliberately conservative: the most severe matching outcome
 * wins, and an unknown or errored state resolves upward, never downward.
 */
@Injectable()
export class DecisionEngineService {
  private readonly logger = new Logger(DecisionEngineService.name);

  constructor(
    @Inject(DECISION_RULES) private readonly rules: DecisionRule[],
    private readonly thresholdResolver: ThresholdResolver,
  ) {}

  decide(
    context: InspectionContext,
    detection: DetectionResult,
    policy: ResolvedPolicy,
  ): Promise<Decision> {
    const startedAt = Date.now();

    let action = DecisionAction.ALLOW;
    const reasons: string[] = [];
    const triggeringSignals: DetectionSignal[] = [];

    // 1. Per-signal threshold resolution.
    for (const signal of detection.signals) {
      const signalAction = this.thresholdResolver.resolve(signal, policy);
      if (signalAction === DecisionAction.ALLOW) {
        continue;
      }

      action = ThresholdResolver.moreSevere(action, signalAction);
      triggeringSignals.push(signal);
      reasons.push(
        `${signal.type}${signal.label ? `/${signal.label}` : ''} scored ${signal.score.toFixed(2)} → ${signalAction}` +
          (signal.evidence ? ` (${signal.evidence})` : ''),
      );
    }

    // 2. Cross-cutting rules, evaluated in priority order. Registered rules can
    //    only raise severity — nothing may talk the engine down from a block.
    for (const rule of [...this.rules].sort((a, b) => b.priority - a.priority)) {
      const evaluation = rule.evaluate(detection.signals, policy, context);
      if (evaluation.matched) {
        action = ThresholdResolver.moreSevere(action, evaluation.action);
        reasons.push(`${rule.name}: ${evaluation.reason}`);
      }
    }

    // 3. A lane that timed out leaves the verdict incomplete. Fail upward
    //    rather than reporting a clean result built on partial evidence.
    if (detection.slowPathTimedOut && action === DecisionAction.ALLOW) {
      action = policy.defaultAction;
      reasons.push('Slow-path verification timed out; falling back to the policy default action.');
    }

    if (reasons.length === 0) {
      reasons.push('No detector exceeded its configured threshold.');
    }

    const edits = action === DecisionAction.EDIT ? this.buildEdits(triggeringSignals) : undefined;

    return Promise.resolve({
      traceId: context.traceId,
      useCaseId: context.useCaseId,
      action,
      score: triggeringSignals.reduce((max, signal) => Math.max(max, signal.score), 0),
      reasons,
      edits,
      triggeringSignals,
      policyVersion: policy.version,
      decidedAt: new Date(),
      latencyMs: Date.now() - startedAt,
    });
  }

  /**
   * Redactions are derived from the spans the detectors reported. Sorted by
   * start offset so the caller can apply them right-to-left without the earlier
   * replacements shifting the later offsets.
   */
  private buildEdits(signals: DetectionSignal[]): ContentEdit[] {
    return signals
      .flatMap((signal) =>
        (signal.spans ?? []).map((span) => ({
          start: span.start,
          end: span.end,
          replacement: `[REDACTED:${signal.label ?? signal.type.toUpperCase()}]`,
          reason: `${signal.type}${signal.label ? `/${signal.label}` : ''} redacted by policy`,
        })),
      )
      .sort((a, b) => a.start - b.start);
  }

  /** Applies edits to content. Right-to-left so offsets stay valid. */
  static applyEdits(content: string, edits: ContentEdit[] = []): string {
    return [...edits]
      .sort((a, b) => b.start - a.start)
      .reduce(
        (text, edit) => text.slice(0, edit.start) + edit.replacement + text.slice(edit.end),
        content,
      );
  }
}
