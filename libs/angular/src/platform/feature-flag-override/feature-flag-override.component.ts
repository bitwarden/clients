import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import {
  AllowedFeatureFlagTypes,
  DefaultFeatureFlagValue,
  FeatureFlag,
} from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ToggleGroupModule } from "@bitwarden/components";

/** The three selectable states for a feature flag override. */
const OverrideState = {
  /** No override; the server config or default value is used. */
  Default: "default",
  /** Force the flag on (true). */
  On: "on",
  /** Force the flag off (false). */
  Off: "off",
} as const;
type OverrideState = (typeof OverrideState)[keyof typeof OverrideState];

interface FeatureFlagRow {
  flag: FeatureFlag;
  defaultValue: AllowedFeatureFlagTypes;
}

/**
 * Developer tool for inspecting and locally overriding feature flags on this client. Overrides take
 * precedence over the server config and default value, and only affect this device.
 */
@Component({
  selector: "app-feature-flag-override",
  templateUrl: "./feature-flag-override.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToggleGroupModule],
})
export class FeatureFlagOverrideComponent {
  private readonly configService = inject(ConfigService);

  protected readonly OverrideState = OverrideState;

  protected readonly rows: FeatureFlagRow[] = Object.values(FeatureFlag)
    .map((flag) => ({ flag, defaultValue: DefaultFeatureFlagValue[flag] }))
    .sort((a, b) => a.flag.localeCompare(b.flag));

  private readonly overrides = toSignal(this.configService.featureFlagOverrides$, {
    initialValue: {} as Partial<Record<FeatureFlag, AllowedFeatureFlagTypes>>,
  });

  protected stateFor(flag: FeatureFlag): OverrideState {
    const override = this.overrides()[flag];
    if (override == null) {
      return OverrideState.Default;
    }
    return override ? OverrideState.On : OverrideState.Off;
  }

  protected async setState(flag: FeatureFlag, state: OverrideState) {
    const value = state === OverrideState.Default ? null : state === OverrideState.On;
    await this.configService.setFeatureFlagOverride(flag, value);
  }
}
