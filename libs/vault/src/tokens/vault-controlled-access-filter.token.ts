import { Observable } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BitwardenIcon } from "@bitwarden/components";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export const MY_REQUESTS_FILTER_ID = "my-requests";
export const PRIVILEGED_FILTER_ID = "privileged";

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
   * The subset of `ciphers` matching the selected option. An id {@link options$} does not offer
   * (such as from a bookmarked link) must yield the input unchanged, not an empty list.
   */
  abstract narrow$<C extends CipherViewLike>(optionId: string, ciphers: C[]): Observable<C[]>;
}

export const VAULT_CONTROLLED_ACCESS_FILTER = new SafeInjectionToken<VaultControlledAccessFilter>(
  "VaultControlledAccessFilter",
);
