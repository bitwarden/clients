import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@bitwarden/ui-common";

import { VaultItemsTableRowAction } from "../components/vault-items-table/vault-items-table-row-action";

/**
 * Actions another feature adds to the vault row menu (web and desktop VFO1).
 *
 * - Synchronous. `show` must return at once from data the provider already holds (a signal
 *   snapshot). Do not write a signal inside `show`: schedule any read on a microtask.
 * - `show` runs for every rendered row on each change detection. Keep it a map lookup.
 * - `id`s must be unique and must not match a built-in action ID. A clash throws in dev mode and
 *   drops the action in production.
 * - `label` is fixed. For a label that depends on the row, add one action per label and pick
 *   with `show`.
 * - Contributed actions go after the built-in actions and before the Delete group.
 * - Contributed actions do not reach the bulk action bar.
 *
 * Single token for now. Widen to `multi` when a second feature contributes.
 */
export const VAULT_ROW_ACTIONS = new SafeInjectionToken<
  readonly VaultItemsTableRowAction<CipherViewLike>[]
>("VAULT_ROW_ACTIONS");
