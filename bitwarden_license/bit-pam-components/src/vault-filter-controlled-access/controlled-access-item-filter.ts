import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { VaultItemFilter } from "@bitwarden/vault";

import { ControlledAccessVaultFilterService } from "./controlled-access-vault-filter.service";

/**
 * The vault tables' "Controlled access" chip (web VFO1 and the popup), over
 * {@link ControlledAccessVaultFilterService}'s state options and matches.
 */
export function controlledAccessItemFilter(
  i18nService: I18nService,
  filterService: ControlledAccessVaultFilterService,
): VaultItemFilter {
  return {
    // Kept so `vault.controlledAccess` links and legacy `?controlledAccess=` links keep working.
    key: "controlledAccess",
    label: i18nService.t("controlledAccess"),
    icon: "bwi-lock-encrypted",
    options$: filterService.stateOptions$,
    matches$: (ciphers) => filterService.matches$(ciphers),
  };
}
