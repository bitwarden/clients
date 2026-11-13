import { InputSignal, Type } from "@angular/core";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export type VaultRowIcon = Type<{ cipher: InputSignal<CipherViewLike | null> }>;

/**
 * Optional icon after the name in a popup vault row, such as a status icon for an item another
 * feature governs. Rendered once per row with `cipher` as its only input; it renders nothing for a
 * row it has no icon for. Unprovided, rows show no extra icon.
 */
export const VAULT_ROW_ICON = new SafeInjectionToken<VaultRowIcon>("VaultRowIcon");
