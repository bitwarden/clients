import { Observable } from "rxjs";

/**
 * Exposes the approver-inbox pending-request count for navigation badges.
 *
 * This is the OSS-consumable seam for the PAM nav slots (rendered in the
 * organization and user layouts). The implementation lives in commercial code
 * (`bitwarden_license/bit-web`, backed by `ApproverInboxRequestsService`); in
 * builds without the commercial app this abstraction is simply unprovided and
 * the slots fall back to a count of `0`.
 */
export abstract class PamInboxBadgeService {
  /**
   * Emits the current number of pending approver-inbox requests for the active
   * user. Multicast — subscribing does not multiply upstream work.
   */
  abstract readonly count$: Observable<number>;
}
