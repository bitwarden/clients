import { AcceptOpenOrgInviteError } from "@bitwarden/common/auth/organization-invite";

/**
 * Accept-endpoint error kinds that render a full error UI (title + body + icon + button).
 * Derived from `AcceptOpenOrgInviteError["kind"]` so a new error kind on the parent
 * automatically flows here and the mapper's exhaustive switch fails to compile until
 * the new arm is handled.
 *
 * Two arms are excluded because they are not rendered by the mapper:
 *   - `already-member`: success-adjacent (toast + navigate)
 *   - `recovery-key-mismatch`: emits a distinct log line then reuses the `unexpected` render
 */
export type OpenOrgInviteAcceptRenderableErrorKind = Exclude<
  AcceptOpenOrgInviteError["kind"],
  "already-member" | "recovery-key-mismatch"
>;
