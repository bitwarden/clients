import { Observable } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BitwardenIcon } from "@bitwarden/components";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export const MY_REQUESTS_FILTER_ID = "my-requests";
export const PRIVILEGED_FILTER_ID = "privileged";
export const PENDING_FILTER_ID = "pending";
export const READY_FILTER_ID = "ready";
export const ACTIVE_FILTER_ID = "active";
export const UNAVAILABLE_FILTER_ID = "unavailable";

/** One child of the "Controlled access" group, already localized by the host that supplies it. */
export type ControlledAccessFilterOption = {
  readonly id: string;
  readonly name: string;
  readonly icon: BitwardenIcon;
};

/**
 * Optional "Controlled access" group in the vault's Filters sidebar and the narrowing it applies
 * to the item list. The ids are opaque to the vault, which renders {@link options$} and hands the
 * selected id back to {@link narrow$}.
 */
export abstract class VaultControlledAccessFilter {
  /** The group's children. An empty array hides the group. */
  abstract readonly options$: Observable<ControlledAccessFilterOption[]>;

  /**
   * The vault table chip's options, when they differ from the sidebar's {@link options$}. Unset,
   * the chip offers {@link options$}.
   */
  readonly tableOptions$?: Observable<ControlledAccessFilterOption[]>;

  /**
   * The subset of `ciphers` matching the selected option. An id {@link options$} does not offer
   * (such as from a bookmarked link) must yield the input unchanged, not an empty list.
   */
  abstract narrow$<C extends CipherViewLike>(optionId: string, ciphers: C[]): Observable<C[]>;

  /**
   * Each row's place in the vault table's Controlled access sort, keyed by cipher id: lower sorts
   * first ascending. A row the map leaves out sorts after every ranked one. Unset, the column's
   * sort leaves rows in name order.
   */
  readonly sortRanks$?: <C extends CipherViewLike>(ciphers: C[]) => Observable<Map<string, number>>;
}

export const VAULT_CONTROLLED_ACCESS_FILTER = new SafeInjectionToken<VaultControlledAccessFilter>(
  "VaultControlledAccessFilter",
);
