import { Observable } from "rxjs";

/**
 * Exposes the count of PAM items awaiting the user's attention, for the navigation badge.
 *
 * This is the OSS-consumable seam for the PAM nav slots. The implementation lives in commercial code
 * (`bitwarden_license/bit-web`); in builds without the commercial app this abstraction is simply
 * unprovided and the slots fall back to a count of `0`, which renders no badge at all.
 *
 * "Awaiting attention" is scoped to the slot's destination. The user nav links to the Access
 * requests page, so this counts everything that page can act on: the caller's own actionable
 * requests — still pending a decision, or approved and still startable — plus, for a caller who can
 * approve, the requests awaiting their decision. Both, because either one is unattended work
 * reached through this one nav item, and a badge that counted only half of it would leave an
 * approver with no signal that somebody is waiting on them.
 *
 * The approver half is only read for a caller who actually holds the privilege, so a member who
 * approves nothing still sees no badge for a tab they do not have. A request the caller both raised
 * and manages counts once, not twice.
 */
export abstract class PamNavBadgeService {
  /**
   * Emits the current count for the active user. Multicast — subscribing does not multiply upstream
   * work.
   */
  abstract readonly count$: Observable<number>;
}
