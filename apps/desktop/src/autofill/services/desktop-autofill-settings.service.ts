import { map } from "rxjs";

import {
  AUTOFILL_SETTINGS_DISK,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

const ENABLE_DUCK_DUCK_GO_BROWSER_INTEGRATION = new KeyDefinition(
  AUTOFILL_SETTINGS_DISK,
  "enableDuckDuckGoBrowserIntegration",
  {
    deserializer: (v: boolean) => v,
  },
);

const SCREEN_PRIVACY = new KeyDefinition(AUTOFILL_SETTINGS_DISK, "screenPrivacy", {
  deserializer: (v: boolean) => v,
});

export class DesktopAutofillSettingsService {
  // DDG Integration
  private enableDuckDuckGoBrowserIntegrationState = this.stateProvider.getGlobal(
    ENABLE_DUCK_DUCK_GO_BROWSER_INTEGRATION,
  );
  enableDuckDuckGoBrowserIntegration$ = this.enableDuckDuckGoBrowserIntegrationState.state$.pipe(
    map((x) => x ?? false),
  );

  // Screen Privacy
  private screenPrivacyState = this.stateProvider.getGlobal(SCREEN_PRIVACY);
  screenPrivacy$ = this.screenPrivacyState.state$.pipe(map((x) => x ?? false));

  constructor(private stateProvider: StateProvider) {}

  async setEnableDuckDuckGoBrowserIntegration(newValue: boolean): Promise<void> {
    await this.enableDuckDuckGoBrowserIntegrationState.update(() => newValue);
  }

  async setScreenPrivacy(newValue: boolean): Promise<void> {
    await this.screenPrivacyState.update(() => newValue);
  }
}
