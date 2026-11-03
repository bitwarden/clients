import { map, Observable } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultItemColumn, VaultItemColumnScope } from "@bitwarden/vault";

import { ControlledAccessVaultFilterService } from "../vault-filter-controlled-access/controlled-access-vault-filter.service";

import { ControlledAccessCellComponent } from "./controlled-access-cell.component";

/**
 * The VFO1 vault table's Controlled access column. Shows while PAM's flag is on and an
 * organization in view uses PAM; `scope.vault` is not read.
 *
 * Sorts through {@link ControlledAccessVaultFilterService.sortRanks$}, the same per-row state read
 * the filter chip shares. That read is one `getCipherAccessState` call per restricted row; a batch
 * `cipher_access_state` in the SDK would make it one call per row list.
 */
export function controlledAccessColumn(
  i18nService: I18nService,
  configService: ConfigService,
  filterService: ControlledAccessVaultFilterService,
): VaultItemColumn {
  return {
    // The ID the column had as a built-in, kept so nothing keyed on it moves.
    key: "controlledAccess",
    label: i18nService.t("controlledAccess"),
    component: ControlledAccessCellComponent,
    visible$: (scope: VaultItemColumnScope): Observable<boolean> =>
      configService
        .getFeatureFlag$(FeatureFlag.Pam)
        .pipe(map((enabled) => enabled && scope.organizations.some((o) => o.usePam))),
    sortRanks$: (ciphers: readonly CipherViewLike[]): Observable<ReadonlyMap<CipherId, number>> =>
      filterService
        .sortRanks$(ciphers)
        .pipe(map((ranks) => new Map([...ranks].map(([id, rank]) => [id as CipherId, rank])))),
  };
}
