import { DecisionAction, InspectionStage, RiskTier } from '../../../common/enums';
import { DetectionSignal } from '../../../common/interfaces';

export enum AuditEventType {
  REQUEST_RECEIVED = 'request.received',
  DETECTION_COMPLETED = 'detection.completed',
  DECISION_MADE = 'decision.made',
  CONTENT_EDITED = 'content.edited',
  ESCALATION_RAISED = 'escalation.raised',
  REQUEST_BLOCKED = 'request.blocked',
  UPSTREAM_ERROR = 'upstream.error',
}

/**
 * The envelope written to Kafka. Payloads carry scores and labels but never raw
 * user content — only hashes and offsets — so the audit topic stays safe to
 * retain and replay.
 */
export interface AuditEvent {
  eventId: string;
  eventType: AuditEventType;
  /** Schema version of this envelope, for consumer compatibility. */
  schemaVersion: number;
  traceId: string;
  useCaseId: string;
  tenantId?: string;
  userId?: string;
  stage: InspectionStage;
  riskTier: RiskTier;
  action?: DecisionAction;
  signals?: DetectionSignal[];
  reasons?: string[];
  policyVersion?: number;
  /** SHA-256 of the inspected content; the content itself is not published. */
  contentHash?: string;
  latencyMs?: number;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}
