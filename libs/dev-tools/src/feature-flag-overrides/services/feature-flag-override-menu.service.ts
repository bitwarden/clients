import { map, Observable } from "rxjs";

import { CONFIG_DISK, GlobalState, KeyDefinition, StateProvider } from "@bitwarden/state";

/**
 * Whether the developer has explicitly turned the override menu on or off. Absent means "no
 * explicit choice", in which case the per-client default applies.
 *
 * Stored alongside the overrides themselves on {@link CONFIG_DISK}, which is `disk-local` on web so
 * the choice survives a reload.
 */
export const FEATURE_FLAG_OVERRIDE_MENU_ENABLED = new KeyDefinition<boolean>(
  CONFIG_DISK,
  "featureFlagOverrideMenuEnabled",
  { deserializer: (value) => value },
);

/**
 * Gates whether the feature flag override menu is offered to the user.
 *
 * Enabled when the developer has explicitly turned it on, or — absent an explicit choice — when the
 * client says it should be on by default (a development build, or the desktop app started with
 * `ENABLE_FEATURE_FLAG_OVERRIDE_MENU=true`).
 */
export class FeatureFlagOverrideMenuService {
  private readonly enabledState: GlobalState<boolean>;

  readonly enabled$: Observable<boolean>;

  constructor(
    private readonly stateProvider: StateProvider,
    private readonly defaultEnabled: boolean,
  ) {
    this.enabledState = this.stateProvider.getGlobal(FEATURE_FLAG_OVERRIDE_MENU_ENABLED);
    this.enabled$ = this.enabledState.state$.pipe(map((enabled) => enabled ?? this.defaultEnabled));
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.enabledState.update(() => enabled);
  }

  /**
   * Exposes `enableFeatureFlagOverrideMenu()` / `disableFeatureFlagOverrideMenu()` on the global
   * scope so the menu can be turned on from the developer console in a build where it is off by
   * default.
   */
  installGlobalHook(): void {
    globalThis.enableFeatureFlagOverrideMenu = () => this.setEnabled(true);
    globalThis.disableFeatureFlagOverrideMenu = () => this.setEnabled(false);
  }
}

declare global {
  /** Turns on the feature flag override menu. Installed by {@link FeatureFlagOverrideMenuService}. */
  var enableFeatureFlagOverrideMenu: () => Promise<void>;
  /** Turns off the feature flag override menu. Installed by {@link FeatureFlagOverrideMenuService}. */
  var disableFeatureFlagOverrideMenu: () => Promise<void>;
}
