import { Observable } from "rxjs";

/**
 * Exposes the count of PAM items awaiting the user's attention, for the navigation badge.
 *
 * This is the OSS-consumable seam for the PAM nav slots. The implementation lives in commercial code
 * (`bitwarden_license/bit-web`); in builds without the commercial app this abstraction is simply
 * unprovided and the slots fall back to a count of `0`, which renders no badge at all.
 *
 * "Awaiting attention" is scoped to the slot's destination. The user nav links to the caller's own
 * Access requests page, so this counts the caller's OWN actionable requests — the ones still pending
 * a decision, plus the approved ones they can still start. It is deliberately not the approver
 * inbox's count: a member who approves nothing would otherwise see a badge on a page that has
 * nothing for them.
 */
export abstract class PamNavBadgeService {
  /**
   * Emits the current count for the active user. Multicast — subscribing does not multiply upstream
   * work.
   */
  abstract readonly count$: Observable<number>;
}
