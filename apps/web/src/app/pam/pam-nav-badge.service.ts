import { Observable } from "rxjs";

/**
 * Exposes the count of PAM items awaiting the user's attention, for the navigation badge.
 *
 * The OSS-consumable seam for the PAM nav slots. The implementation lives in commercial code;
 * unprovided builds fall back to a count of `0`, rendering no badge.
 *
 * Scoped to what the Access requests page can act on: the caller's own actionable requests,
 * plus, for an approver, the requests awaiting their decision — both, since either is
 * unattended work reached through this one nav item.
 *
 * The approver half is read only for a caller who holds the privilege. A request the caller
 * both raised and manages counts once, not twice.
 */
export abstract class PamNavBadgeService {
  /**
   * Emits the current count for the active user. Multicast — subscribing does not multiply upstream
   * work.
   */
  abstract readonly count$: Observable<number>;
}
