/**
 * Outcome of the "Request access" flow as observed by the caller.
 *
 * - `lease-created` — automatic outcome; caller can immediately re-fetch the
 *   cipher via `getLeasedCipher` and reveal the credential.
 * - `request-created` — human outcome; a pending request exists, caller should
 *   not attempt a fetch yet.
 * - `dismissed` — user closed the modal without submitting, or the pre-check
 *   itself failed before the modal opened.
 */
export type RequestAccessOutcome = "lease-created" | "request-created" | "dismissed";

/**
 * Abstraction over the "Request access" user action on a partial-data cipher.
 * libs/pam owns the banner that exposes the button, but the modal that drives
 * pre-check + request-lease lives at the host-app layer (apps/web). Hosts
 * provide an implementation; libs/pam invokes it via DI.
 */
export abstract class RequestAccessTrigger {
  /**
   * Resolves the approval outcome for `cipherId`, walks the user through the
   * matching form, and posts the lease/request. The returned promise settles
   * after the modal closes with a {@link RequestAccessOutcome} describing what
   * happened, so the caller (e.g. the cipher-open gate) can branch on it.
   */
  abstract requestAccess(cipherId: string): Promise<RequestAccessOutcome>;
}
