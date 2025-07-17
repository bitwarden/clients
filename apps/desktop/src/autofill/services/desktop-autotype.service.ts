import { combineLatest, map, Observable, of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  GlobalStateProvider,
  AUTOTYPE_SETTINGS_DISK,
  KeyDefinition,
} from "@bitwarden/common/platform/state";

export const AUTOTYPE_ENABLED = new KeyDefinition<boolean>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeEnabled",
  { deserializer: (b) => b },
);

export class DesktopAutotypeService {
  private readonly autotypeEnabledState = this.globalStateProvider.get(AUTOTYPE_ENABLED);

  autotypeEnabled$: Observable<boolean> = of(false);

  constructor(
    private configService: ConfigService,
    private globalStateProvider: GlobalStateProvider,
    private isWindows: boolean,
  ) {
    if (this.isWindows) {
      this.autotypeEnabled$ = combineLatest([
        this.autotypeEnabledState.state$,
        this.configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype),
      ]).pipe(
        map(
          ([autotypeEnabled, windowsDesktopAutotypeFeatureFlag]) =>
            autotypeEnabled && windowsDesktopAutotypeFeatureFlag,
        ),
      );
    }
  }

  init() {}

  async setAutotypeEnabledState(enabled: boolean): Promise<void> {
    await this.autotypeEnabledState.update(() => enabled, {
      shouldUpdate: (currentlyEnabled) => currentlyEnabled !== enabled,
    });
  }
}
