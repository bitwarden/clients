/**
 * Every `bit-table-v2` `stateKey`. Bind the property name; the value is what's stored, so
 * changing a value discards every preference saved under it.
 */
export const TABLE_STATE_KEYS = Object.freeze({
  /** The vault items table, shared by web and desktop. */
  vaultItems: "vault-items",
} as const);

export type TableStateKey = keyof typeof TABLE_STATE_KEYS;

/**
 * Hidden column names per table, keyed by the table's stored `stateKey` value.
 *
 * Hidden rather than visible names is deliberate: a column added in a later release is in
 * nobody's stored record, so it defaults to visible. A stored name whose column no longer
 * exists is kept, not pruned, so the choice survives the column's return.
 */
export type TableColumnPreferences = Readonly<Record<string, readonly string[]>>;

/** Where column preferences persist. Plug in the app's state provider with {@link setTableColumnPreferencesStorage}. */
export interface TableColumnPreferencesStorage {
  load(): TableColumnPreferences | undefined | Promise<TableColumnPreferences | undefined>;
  save(preferences: TableColumnPreferences): void | Promise<void>;
}

/** Keeps preferences for the page's lifetime only. The default. */
export function memoryColumnPreferencesStorage(): TableColumnPreferencesStorage {
  let stored: TableColumnPreferences | undefined;
  return {
    load: () => stored,
    save: (preferences) => {
      stored = preferences;
    },
  };
}

/** Persists preferences as JSON in `localStorage` under `storageKey`. */
export function localColumnPreferencesStorage(
  storageKey = "bit-table-column-preferences",
): TableColumnPreferencesStorage {
  return {
    load: () => {
      try {
        return JSON.parse(localStorage.getItem(storageKey) ?? "null") ?? undefined;
      } catch {
        return undefined;
      }
    },
    save: (preferences) => localStorage.setItem(storageKey, JSON.stringify(preferences)),
  };
}

/**
 * Stores which columns each table has hidden. Replaces Angular's `TableColumnPreferencesService`;
 * persistence is pluggable instead of tied to `StateProvider`.
 */
export class TableColumnPreferencesStore {
  private preferences: TableColumnPreferences | undefined;
  private loading?: Promise<void>;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: TableColumnPreferencesStorage) {}

  /** The hidden names stored for `key`, `undefined` until they load. */
  hiddenColumns(key: TableStateKey): ReadonlySet<string> | undefined {
    this.ensureLoaded();
    if (this.preferences === undefined) {
      return undefined;
    }
    const stored = this.preferences[TABLE_STATE_KEYS[key] ?? key];
    // Storage may hold a malformed value from an older or foreign write.
    return new Set(Array.isArray(stored) ? stored : []);
  }

  /** Shows or hides one column. Names the table no longer shows are kept. */
  setColumnHidden(key: TableStateKey, name: string, hidden: boolean): void {
    this.write((prefs) => {
      const storageKey = TABLE_STATE_KEYS[key] ?? key;
      const names = new Set(prefs[storageKey] ?? []);
      if (hidden) {
        names.add(name);
      } else {
        names.delete(name);
      }
      return { ...prefs, [storageKey]: [...names] };
    });
  }

  /** Drops `key` entirely, restoring the table's declared column set. */
  reset(key: TableStateKey): void {
    this.write(({ [TABLE_STATE_KEYS[key] ?? key]: _dropped, ...rest }) => rest);
  }

  /** Calls `listener` after preferences load or change. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private ensureLoaded() {
    this.loading ??= Promise.resolve(this.storage.load()).then(
      (prefs) => {
        this.preferences = prefs ?? {};
        this.notify();
      },
      () => {
        this.preferences = {};
        this.notify();
      },
    );
  }

  private write(update: (prefs: TableColumnPreferences) => TableColumnPreferences) {
    this.preferences = update(this.preferences ?? {});
    this.notify();
    void Promise.resolve(this.storage.save(this.preferences)).catch((e: unknown) =>
      // eslint-disable-next-line no-console
      console.error(e),
    );
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

let defaultStore = new TableColumnPreferencesStore(memoryColumnPreferencesStorage());

/** The store `bit-table-v2` reads unless given its own `columnPreferences`. */
export function getTableColumnPreferences(): TableColumnPreferencesStore {
  return defaultStore;
}

/** Plugs in where column preferences persist. Call once at startup, before tables render. */
export function setTableColumnPreferencesStorage(storage: TableColumnPreferencesStorage) {
  defaultStore = new TableColumnPreferencesStore(storage);
}
