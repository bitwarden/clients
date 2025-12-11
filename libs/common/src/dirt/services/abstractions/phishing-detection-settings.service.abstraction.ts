import { Observable } from "rxjs";

import { UserId } from "@bitwarden/user-core";

/**
 * Abstraction for phishing detection settings
 */
export abstract class PhishingDetectionSettingsServiceAbstraction {
  /**
   * An observable for whether phishing detection is available for the active user account.
   *
   * Access is granted only when the PhishingDetection feature flag is enabled and
   * at least one of the following is true for the active account:
   * - the user has a personal premium subscription
   * - the user is a member of a Family org (ProductTierType.Families)
   * - the user is a member of an Enterprise org with `usePhishingBlocker` enabled
   */
  abstract readonly available$: Observable<boolean>;
  /**
   * An observable for whether phishing detection is available and enabled for the active user account
   */
  abstract readonly on$: Observable<boolean>;
  /**
   * An observable for whether phishing detection is enabled
   */
  abstract readonly enabled$: Observable<boolean>;
  /**
   * Sets whether phishing detection is enabled
   *
   * @param enabled True to enable, false to disable
   */
  abstract setEnabled: (userId: UserId, enabled: boolean) => Promise<void>;
}
