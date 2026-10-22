import { inject } from "@angular/core";
import { map, Observable } from "rxjs";

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
 * Must be called in an injection context.
 */
export function copyPresentation$(): Observable<VaultItemsTableCopyPresentation> {
  const copyButtonsService = inject(VaultCopyButtonsService);

  return copyButtonsService.showQuickCopyActions$.pipe(
    map((settingEnabled) => (settingEnabled ? "expanded" : DEFAULT_COPY_PRESENTATION)),
  );
}
