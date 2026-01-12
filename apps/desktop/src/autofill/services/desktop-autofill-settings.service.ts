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

export class DesktopAutofillSettingsService {
  private enableDuckDuckGoBrowserIntegrationState = this.stateProvider.getGlobal(
    ENABLE_DUCK_DUCK_GO_BROWSER_INTEGRATION,
  );
  enableDuckDuckGoBrowserIntegration$ = this.enableDuckDuckGoBrowserIntegrationState.state$.pipe(
    map((x) => x ?? false),
  );

  constructor(private stateProvider: StateProvider) {}

  async setEnableDuckDuckGoBrowserIntegration(newValue: boolean): Promise<void> {
    await this.enableDuckDuckGoBrowserIntegrationState.update(() => newValue);
  }
}
