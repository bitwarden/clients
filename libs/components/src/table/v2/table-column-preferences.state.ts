import { Jsonify } from "type-fest";

import { TABLE_COLUMN_PREFERENCES_DISK, UserKeyDefinition } from "@bitwarden/state";

/**
 * Hidden column names per table, keyed by the table's `stateKey`.
 *
 * Hidden rather than visible names is deliberate: a column added in a later release is in
 * nobody's stored record, so it defaults to visible. A stored name whose column no longer
 * exists is kept, not pruned, so the choice survives the column's return.
 */
export type TableColumnPreferences = Readonly<Record<string, readonly string[]>>;

export const TABLE_COLUMN_PREFERENCES = new UserKeyDefinition<TableColumnPreferences>(
  TABLE_COLUMN_PREFERENCES_DISK,
  "hiddenColumns",
  {
    // Rebuilds each array from its serialized form; the service guards the contents,
    // since it also has to cover the in-memory and in-flight paths this never sees.
    deserializer: (obj: Jsonify<TableColumnPreferences>) =>
      Object.fromEntries(Object.entries(obj ?? {}).map(([key, names]) => [key, Array.from(names)])),
    // A display preference, not session data — it outlives lock and logout.
    clearOn: [],
  },
);
