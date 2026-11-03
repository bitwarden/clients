import { InputSignal, Type } from "@angular/core";
import { Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@bitwarden/ui-common";

import { VaultScope } from "../models/vault-scope";

/** Where the table is, as the host's side nav and route define it. Fields can be added later. */
export type VaultItemColumnScope = {
  /** The nav destination. Undefined when the host has no vault scope (for example desktop). */
  readonly vault: VaultScope | undefined;
  /** The organizations in that scope: the same list that names the Vault column. */
  readonly organizations: readonly Organization[];
};

/** One extra column in the vault items table. The provider decides when it applies. */
export type VaultItemColumn = {
  /**
   * The column ID. The provider owns it. It must not match a built-in column ID
   * (`VAULT_COLUMNS`); the table throws in dev mode on a clash. Keep it stable across releases:
   * if the column becomes removable, the table saves the ID in the user's hidden-column state.
   */
  readonly key: string;
  /** Already-translated header text. */
  readonly label: string;
  /** Rendered once per row with `cipher` as its only input. */
  readonly component: Type<{ cipher: InputSignal<CipherViewLike> }>;
  /** Whether the column shows in this scope. Live: the table re-subscribes when the scope changes. */
  visible$(scope: VaultItemColumnScope): Observable<boolean>;
  /**
   * Optional. Makes the column sortable. Live: the table keeps the subscription and re-sorts on
   * each emission. Lower ranks sort first ascending. Rows left out sort after ranked rows.
   * Emit only when a rank changes, not on each clock tick.
   */
  sortRanks$?(ciphers: readonly CipherViewLike[]): Observable<ReadonlyMap<CipherId, number>>;
};

/**
 * Optional extra column in the vault items table, rendered after "My folders" and before the row
 * actions. The table owns the position; the provider owns the ID, the header, the cell, and when
 * the column shows. Unprovided, the table has no extra column.
 *
 * Single token: widen it to `multi` when a second feature contributes a column.
 */
export const VAULT_ITEM_COLUMN = new SafeInjectionToken<VaultItemColumn>("VaultItemColumn");
