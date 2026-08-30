/** Terminal outcome of the decision engine for a single request/response. */
export enum DecisionAction {
  /** Pass through unchanged. */
  ALLOW = 'allow',
  /** Pass through with redactions/rewrites applied. */
  EDIT = 'edit',
  /** Hold for human review before release. */
  ESCALATE = 'escalate',
  /** Refuse outright; return a safe canned response. */
  BLOCK = 'block',
}
