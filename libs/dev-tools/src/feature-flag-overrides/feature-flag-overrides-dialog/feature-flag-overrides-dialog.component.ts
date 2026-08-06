import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";

import { FeatureFlag, getFeatureFlagValue } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  ButtonModule,
  CenterPositionStrategy,
  DialogModule,
  DialogService,
  SearchModule,
  ToggleGroupModule,
  TypographyModule,
} from "@bitwarden/components";

import { BOOLEAN_FEATURE_FLAGS } from "../feature-flag-catalog";
import { DEV_TOOLS_RELOAD_APP } from "../feature-flag-overrides.providers";
import {
  FeatureFlagOverrides,
  FeatureFlagOverrideService,
} from "../services/feature-flag-override.service";

/** What the developer has chosen for a flag. `default` means "no override". */
type OverrideChoice = "on" | "off" | "default";

type FeatureFlagRow = {
  name: string;
  flag: FeatureFlag;
  choice: OverrideChoice;
  /** What the flag resolves to with the override ignored — i.e. what `default` means right now. */
  unoverriddenValue: boolean;
};

/**
 * Lists every boolean feature flag with an on/off/default control, writing local overrides that
 * `DefaultConfigService` resolves ahead of the server config.
 *
 * Strings here are intentionally not localized: this dialog is developer tooling, only reachable
 * once the override menu has been enabled, and never rendered for an end user.
 */
@Component({
  templateUrl: "feature-flag-overrides-dialog.component.html",
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    SearchModule,
    ToggleGroupModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureFlagOverridesDialogComponent {
  private readonly overrideService = inject(FeatureFlagOverrideService);
  private readonly configService = inject(ConfigService);
  private readonly reloadApp = inject<() => void>(DEV_TOOLS_RELOAD_APP);

  private readonly overrides = toSignal(this.overrideService.overrides$, {
    initialValue: {} as FeatureFlagOverrides,
  });
  private readonly serverConfig = toSignal(this.configService.serverConfig$, {
    initialValue: null,
  });

  protected readonly search = signal("");

  protected readonly rows = computed<FeatureFlagRow[]>(() => {
    const overrides = this.overrides();
    const serverConfig = this.serverConfig();
    const search = this.search().trim().toLowerCase();

    return BOOLEAN_FEATURE_FLAGS.filter(
      ({ name, value }) =>
        search === "" ||
        name.toLowerCase().includes(search) ||
        value.toLowerCase().includes(search),
    ).map(({ name, value }) => ({
      name,
      flag: value,
      choice: this.choiceFor(overrides[value]),
      unoverriddenValue: getFeatureFlagValue(serverConfig, value) === true,
    }));
  });

  protected readonly overrideCount = computed(() => Object.keys(this.overrides()).length);

  protected async setChoice(flag: FeatureFlag, choice: OverrideChoice) {
    if (choice === "default") {
      await this.overrideService.clearOverride(flag);
    } else {
      await this.overrideService.setOverride(flag, choice === "on");
    }
  }

  protected async clearAll() {
    await this.overrideService.clearAllOverrides();
  }

  protected reload() {
    this.reloadApp();
  }

  private choiceFor(override: unknown): OverrideChoice {
    if (override === true) {
      return "on";
    }
    if (override === false) {
      return "off";
    }
    return "default";
  }

  static open(dialogService: DialogService) {
    return dialogService.open(FeatureFlagOverridesDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
