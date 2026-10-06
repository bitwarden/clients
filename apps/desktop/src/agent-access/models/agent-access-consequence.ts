/**
 * The four consequence grades every Agent Access approval dialog is organized around
 * (agent-access-design-spec.md §2.1 — "consequence is the organizing principle"). Each grade
 * answers "what happens if I say yes" and drives the colour of `app-agent-access-consequence`,
 * the signature band shared by the whole dialog family (see §2.2's token table for the exact
 * classes each grade maps to).
 *
 * `metadata` and `destroy` are the two ends of the spectrum — no secret value leaves the device
 * vs. an irreversible removal — with `change` (vault mutated, nothing disclosed) and `disclose`
 * (a secret value leaves the device) in between. Grade is set explicitly per dialog/resource kind
 * by the caller; it is never inferred from other request fields (see the note on
 * `desktop-agent-access.service.ts`'s `deliveryMode` in §3.3 of the spec — inferring the grade
 * from a field that isn't always set is exactly the bug this const object is meant to prevent).
 *
 * Const object + type alias per `.claude/rules/typescript.md` (ADR-0025) — no TS enums.
 */
export const AgentAccessConsequence = Object.freeze({
  /** Names, ids, flags. No secret value leaves the device. */
  Metadata: "metadata",
  /** Vault contents are created or modified. No existing value is disclosed. */
  Change: "change",
  /** A secret value leaves this device. */
  Disclose: "disclose",
  /** Irreversible removal. */
  Destroy: "destroy",
} as const);
export type AgentAccessConsequence =
  (typeof AgentAccessConsequence)[keyof typeof AgentAccessConsequence];
