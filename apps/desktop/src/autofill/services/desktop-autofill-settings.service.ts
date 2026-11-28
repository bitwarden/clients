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

  /**
   * @deprecated DuckDuckGo dropped support for the integration here
   * https://github.com/duckduckgo/apple-browsers/pull/7877. We will drop support after a
   * transition period.
   */
  enableDuckDuckGoBrowserIntegration$ = this.enableDuckDuckGoBrowserIntegrationState.state$.pipe(
    map((x) => x ?? false),
  );

  constructor(private stateProvider: StateProvider) {}

  /**
   * @deprecated DuckDuckGo dropped support for the integration here
   * https://github.com/duckduckgo/apple-browsers/pull/7877. We will drop support after a
   * transition period.
   */
  async setEnableDuckDuckGoBrowserIntegration(newValue: boolean): Promise<void> {
    await this.enableDuckDuckGoBrowserIntegrationState.update(() => newValue);
  }
}
