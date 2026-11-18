import { Injectable, Signal, inject } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { map, of, switchMap } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/state";

import { TABLE_COLUMN_PREFERENCES, TableColumnPreferences } from "./table-column-preferences.state";
import { TABLE_STATE_KEYS, TableStateKey } from "./table-state-keys";

/**
 * Stores which columns each table has hidden, per user. Without a `StateProvider` nothing is
 * stored, so only tables with a `stateKey` need one.
 */
@Injectable({ providedIn: "root" })
export class TableColumnPreferencesService {
  private readonly stateProvider = inject(StateProvider, { optional: true });
  private readonly logService = inject(LogService, { optional: true });

  /**
   * The hidden names stored for `key`, `undefined` until they load. A missing key never touches
   * `StateProvider`. Call from an injection context.
   */
  hiddenColumns(key: Signal<TableStateKey | undefined>): Signal<ReadonlySet<string> | undefined> {
    return toSignal(
      toObservable(key).pipe(
        switchMap((k) =>
          k == null || this.stateProvider == null
            ? of([])
            : this.state().state$.pipe(map((prefs) => prefs?.[TABLE_STATE_KEYS[k]])),
        ),
        // Disk may hold a malformed value from an older or foreign write.
        map((stored) => new Set(Array.isArray(stored) ? stored : [])),
      ),
    );
  }

  /**
   * Shows or hides one column. Derived inside the update so quick successive toggles don't
   * overwrite each other; names the table no longer shows are kept.
   */
  setColumnHidden(key: TableStateKey, name: string, hidden: boolean): void {
    this.write((prefs) => {
      const storageKey = TABLE_STATE_KEYS[key];
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
    this.write(({ [TABLE_STATE_KEYS[key]]: _dropped, ...rest }) => rest);
  }

  private state() {
    if (this.stateProvider == null) {
      throw new Error("bit-table-v2: `stateKey` requires a StateProvider.");
    }
    return this.stateProvider.getActive(TABLE_COLUMN_PREFERENCES);
  }

  private write(update: (prefs: TableColumnPreferences) => TableColumnPreferences): void {
    void this.state()
      .update((prefs) => update(prefs ?? {}))
      .catch((e: unknown) => this.logService?.error(e));
  }
}
