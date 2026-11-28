import { TABLE_PREFERENCES_DISK, UserKeyDefinition } from "@bitwarden/state";

import { ParamState } from "../../utils";

/**
 * Hidden column names per table, keyed by the table's `stateKey`.
 *
 * Hidden rather than visible names is deliberate: a column added in a later release is in
 * nobody's stored record, so it defaults to visible. A stored name whose column no longer
 * exists is kept, not pruned, so the choice survives the column's return.
 */
export type TableColumnPreferences = Readonly<Record<string, readonly string[]>>;

export const TABLE_COLUMN_PREFERENCES = UserKeyDefinition.record<readonly string[]>(
  TABLE_PREFERENCES_DISK,
  "hiddenColumns",
  {
    deserializer: (names) => Array.from(names),
    // A display preference, not session data — it outlives lock and logout.
    clearOn: [],
  },
);

/**
 * Each table's last filter, sort, and page-size state, keyed by the table's `stateKey`. The
 * same shape the table mirrors to the URL, minus the page index.
 */
export type TableStates = Record<string, ParamState>;

export const TABLE_STATE = UserKeyDefinition.record<ParamState>(
  TABLE_PREFERENCES_DISK,
  "tableState",
  {
    deserializer: (state) => state as ParamState,
    clearOn: [],
  },
);
