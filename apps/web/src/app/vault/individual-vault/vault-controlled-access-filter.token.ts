import { Observable } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BitwardenIcon } from "@bitwarden/components";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/** One child of the "Controlled access" group, already localized by the host that supplies it. */
export type ControlledAccessFilterOption = {
  readonly id: string;
  readonly name: string;
  readonly icon: BitwardenIcon;
};

/**
 * Optional "Controlled access" group in the vault's Filters sidebar, and the narrowing it applies
 * to the item list. The vault renders whatever children {@link options$} emits and hands the
 * selected child's id back to {@link narrow$}; what those ids mean is entirely the providing
 * host's decision. Unprovided, the sidebar and the item list are unchanged.
 */
export abstract class VaultControlledAccessFilter {
  /** The group's children. An empty array hides the group entirely. */
  abstract readonly options$: Observable<ControlledAccessFilterOption[]>;

  /**
   * The subset of `ciphers` matching the selected option. An option id can outlive the group that
   * offered it (a bookmarked link), so an id {@link options$} no longer offers must yield the
   * input unchanged rather than an empty list.
   */
  abstract narrow$<C extends CipherViewLike>(optionId: string, ciphers: C[]): Observable<C[]>;
}

export const VAULT_CONTROLLED_ACCESS_FILTER = new SafeInjectionToken<VaultControlledAccessFilter>(
  "VaultControlledAccessFilter",
);
