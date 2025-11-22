import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import {
  GlobalState,
  KeyDefinition,
  PHISHING_DETECTION_DISK,
  StateProvider,
} from "../../platform/state";

// Global (client-level) setting - applies to all users on this browser
const ENABLE_PHISHING_DETECTION = new KeyDefinition(
  PHISHING_DETECTION_DISK,
  "enablePhishingDetection",
  {
    deserializer: (value: boolean) => value ?? true, // Default: enabled
  },
);

export abstract class PhishingDetectionSettingsServiceAbstraction {
  abstract enablePhishingDetection$: Observable<boolean>;
  abstract setEnablePhishingDetection: (enabled: boolean) => Promise<void>;
}

export class PhishingDetectionSettingsService
  implements PhishingDetectionSettingsServiceAbstraction
{
  private enablePhishingDetectionState: GlobalState<boolean>;
  readonly enablePhishingDetection$: Observable<boolean>;

  constructor(private stateProvider: StateProvider) {
    // Use getGlobal() for client-level setting
    this.enablePhishingDetectionState = this.stateProvider.getGlobal(ENABLE_PHISHING_DETECTION);

    this.enablePhishingDetection$ = this.enablePhishingDetectionState.state$.pipe(
      map((x) => x ?? true),
    );
  }

  async setEnablePhishingDetection(enabled: boolean): Promise<void> {
    await this.enablePhishingDetectionState.update(() => enabled);
  }
}
