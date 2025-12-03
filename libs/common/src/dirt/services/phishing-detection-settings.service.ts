import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { UserId } from "@bitwarden/user-core";

import {
  ActiveUserState,
  PHISHING_DETECTION_DISK,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";

const ENABLE_PHISHING_DETECTION = new UserKeyDefinition(
  PHISHING_DETECTION_DISK,
  "enablePhishingDetection",
  {
    deserializer: (value: boolean) => value ?? true, // Default: enabled
    clearOn: ["logout"],
  },
);

/**
 * Abstraction for phishing detection settings
 */
export abstract class PhishingDetectionSettingsServiceAbstraction {
  /**
   * An observable for whether phishing detection is enabled
   */
  abstract enablePhishingDetection$: Observable<boolean>;
  /**
   * Sets whether phishing detection is enabled
   *
   * @param enabled True to enable, false to disable
   */
  abstract setEnablePhishingDetection: (userId: UserId, enabled: boolean) => Promise<void>;
}

export class PhishingDetectionSettingsService
  implements PhishingDetectionSettingsServiceAbstraction
{
  private enablePhishingDetectionState: ActiveUserState<boolean>;
  readonly enablePhishingDetection$: Observable<boolean>;

  constructor(private stateProvider: StateProvider) {
    // Use getGlobal() for client-level setting
    this.enablePhishingDetectionState = this.stateProvider.getActive(ENABLE_PHISHING_DETECTION);

    this.enablePhishingDetection$ = this.enablePhishingDetectionState.state$.pipe(
      map((x) => x ?? true),
    );
  }

  async setEnablePhishingDetection(userId: UserId, enabled: boolean): Promise<void> {
    await this.stateProvider.getUser(userId, ENABLE_PHISHING_DETECTION).update(() => enabled);
  }
}
