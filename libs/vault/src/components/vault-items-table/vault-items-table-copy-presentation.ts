import { inject } from "@angular/core";
import { combineLatest, map, Observable } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { VaultCopyButtonsService } from "../../services/vault-copy-buttons.service";

/**
 * How the built-in Copy quick action presents itself.
 *
 * - `"collapsed"` — a single Copy button, opening a menu when the row has more than one copyable
 *   field. Narrow, so the actions column stays compact.
 * - `"expanded"` — one button per copyable field. Faster to reach a specific field, at the cost
 *   of a much wider actions column.
 */
export type VaultItemsTableCopyPresentation = "collapsed" | "expanded";

/**
 * Collapsed is the default because `expanded` widens the actions column by ~80px, which pushes
 * the table's minimum width past common viewports and forces horizontal scrolling.
 */
export const DEFAULT_COPY_PRESENTATION: VaultItemsTableCopyPresentation = "collapsed";

/**
 * Resolves the user's quick copy icon setting into a {@link VaultItemsTableCopyPresentation} for
 * `VaultItemsTableComponent`'s `copyPresentation` input.
 *
 * The setting only takes effect while {@link FeatureFlag.PM40435_QuickCopyIconSetting} is on — with
 * the flag off the table stays collapsed regardless of what the user previously saved. This mirrors
 * the gating the legacy web and desktop rows already apply, so both list implementations agree.
 *
 * Must be called in an injection context.
 */
export function copyPresentation$(): Observable<VaultItemsTableCopyPresentation> {
  const configService = inject(ConfigService);
  const copyButtonsService = inject(VaultCopyButtonsService);

  return combineLatest([
    configService.getFeatureFlag$(FeatureFlag.PM40435_QuickCopyIconSetting),
    copyButtonsService.showQuickCopyActions$,
  ]).pipe(
    map(([flagEnabled, settingEnabled]) =>
      flagEnabled && settingEnabled ? "expanded" : "collapsed",
    ),
  );
}
