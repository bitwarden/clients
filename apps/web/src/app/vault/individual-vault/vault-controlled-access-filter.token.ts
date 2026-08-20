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
 * to the item list. A host that surfaces a privileged-access feature provides an implementation;
 * the vault renders whatever children {@link options$} emits and hands the selected child's id
 * back to {@link narrow$} together with the rows that survived the ordinary filters. Which access
 * states those ids stand for — and whether any organization in view has the feature at all — is
 * entirely the host's decision, so the vault never depends on the feature library that implements
 * it. Unprovided, the sidebar and the item list are unchanged.
 */
export abstract class VaultControlledAccessFilter {
  /**
   * The group's children. An empty array hides the group entirely, which is how a user with no
   * organization carrying the feature sees no group at all.
   */
  abstract readonly options$: Observable<ControlledAccessFilterOption[]>;

  /**
   * The subset of `ciphers` matching the selected option. Called only while an option id is in the
   * URL, which can outlive the group itself (a bookmarked link, or the last organization with the
   * feature leaving view) — so an id that {@link options$} does not currently offer must yield the
   * input unchanged rather than an empty list, or the vault would appear empty with nothing on
   * screen to explain why.
   */
  abstract narrow$<C extends CipherViewLike>(optionId: string, ciphers: C[]): Observable<C[]>;
}

export const VAULT_CONTROLLED_ACCESS_FILTER = new SafeInjectionToken<VaultControlledAccessFilter>(
  "VaultControlledAccessFilter",
);
