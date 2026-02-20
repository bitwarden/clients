import { Injectable, OnDestroy, computed, inject, signal } from "@angular/core";

import { DefaultFeatureFlagValue, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DEV_FEATURE_FLAG_OVERRIDES } from "@bitwarden/common/platform/services/config/dev-flag-overrides.state";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CenterPositionStrategy, DialogService } from "@bitwarden/components";

import { DebugFeatureFlagDialogComponent } from "./debug-feature-flag-dialog.component";

export type FlagEntry = {
  /** Enum key name (e.g. "AutoConfirm") */
  name: string;
  /** Enum string value (e.g. "pm-19934-auto-confirm-organization-users") */
  key: FeatureFlag;
  /** Current effective value shown in the UI */
  value: ReturnType<typeof signal<boolean>>;
};

/**
 * Registers a global `window.bwDevSettings()` function that opens the developer
 * feature-flag settings dialog, and manages the flag state shown in that dialog.
 */
@Injectable({
  providedIn: "root",
})
export class DebugFeatureFlagDialogService implements OnDestroy {
  private readonly dialogService = inject(DialogService);
  private readonly configService = inject(ConfigService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly stateProvider = inject(StateProvider);

  readonly flags: FlagEntry[] = Object.entries(FeatureFlag)
    .filter(([, key]) => typeof DefaultFeatureFlagValue[key as FeatureFlag] === "boolean")
    .map(([name, key]) => ({
      name,
      key: key as FeatureFlag,
      value: signal(false),
    }));

  readonly loaded = signal(false);
  readonly search = signal("");
  readonly filteredFlags = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) {
      return this.flags;
    }
    return this.flags.filter(
      (f) => f.name.toLowerCase().includes(q) || f.key.toLowerCase().includes(q),
    );
  });

  async initialize(): Promise<void> {
    if (this.platformUtilsService.isDev()) {
      (window as Window & { bwDevSettings?: () => void }).bwDevSettings = () => {
        this.dialogService.open(DebugFeatureFlagDialogComponent, {
          positionStrategy: new CenterPositionStrategy(),
        });
      };
    }

    await Promise.all(
      this.flags.map(async (flag) => {
        const effectiveValue = await this.configService.getFeatureFlag(flag.key);
        flag.value.set(effectiveValue as boolean);
      }),
    );
    this.loaded.set(true);
  }

  async onToggle(flag: FlagEntry, value: boolean): Promise<void> {
    flag.value.set(value);
    await this.stateProvider.getGlobal(DEV_FEATURE_FLAG_OVERRIDES).update((overrides) => ({
      ...(overrides ?? {}),
      [flag.key]: value,
    }));
  }

  async resetAll(): Promise<void> {
    await this.stateProvider.getGlobal(DEV_FEATURE_FLAG_OVERRIDES).update(() => null);

    await Promise.all(
      this.flags.map(async (flag) => {
        const serverValue = await this.configService.getFeatureFlag(flag.key);
        flag.value.set(serverValue as boolean);
      }),
    );
  }

  ngOnDestroy(): void {
    delete (window as Window & { bwDevSettings?: () => void }).bwDevSettings;
  }
}
