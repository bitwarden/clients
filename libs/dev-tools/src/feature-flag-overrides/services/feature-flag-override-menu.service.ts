import { map, Observable } from "rxjs";

import { CenterPositionStrategy, DialogService } from "@bitwarden/components";
import { CONFIG_DISK, GlobalState, KeyDefinition, StateProvider } from "@bitwarden/state";

import { FeatureFlagOverridesDialogComponent } from "../feature-flag-overrides-dialog/feature-flag-overrides-dialog.component";

/**
 * Whether the developer has turned the override menu on from the console. Only matters outside a
 * development build, where the menu is otherwise hidden.
 *
 * Stored on {@link CONFIG_DISK}, which is `disk-local` on web so the choice survives a reload.
 */
export const FEATURE_FLAG_OVERRIDE_MENU_ENABLED = new KeyDefinition<boolean>(
  CONFIG_DISK,
  "featureFlagOverrideMenuEnabled",
  { deserializer: (value) => value },
);

/**
 * Gates and opens the feature flag override menu.
 *
 * The menu is always offered when the client says so (a development build, or the desktop app
 * started with `ENABLE_FEATURE_FLAG_OVERRIDE_MENU=true`). Otherwise it is hidden until the developer
 * calls `featureFlagMenu()` from the console.
 */
export class FeatureFlagOverrideMenuService {
  private readonly enabledState: GlobalState<boolean>;

  readonly enabled$: Observable<boolean>;

  constructor(
    stateProvider: StateProvider,
    private readonly dialogService: DialogService,
    private readonly defaultEnabled: boolean,
  ) {
    this.enabledState = stateProvider.getGlobal(FEATURE_FLAG_OVERRIDE_MENU_ENABLED);
    this.enabled$ = this.enabledState.state$.pipe(
      map((stored) => this.defaultEnabled || stored === true),
    );
  }

  openDialog(): void {
    this.dialogService.open(FeatureFlagOverridesDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
    });
  }

  /** Flips the stored choice and returns whether the menu is now offered. */
  async toggle(): Promise<boolean> {
    const next = await this.enabledState.update((stored) => stored !== true);
    return this.defaultEnabled || next === true;
  }

  /**
   * Exposes `featureFlagMenu()` on the global scope so the menu can be turned on or off from the
   * developer console in a build where it is hidden by default.
   */
  installGlobalHook(): void {
    globalThis.featureFlagMenu = () => this.toggle();
  }
}

declare global {
  /** Toggles the feature flag override menu. Installed by {@link FeatureFlagOverrideMenuService}. */
  var featureFlagMenu: () => Promise<boolean>;
}
