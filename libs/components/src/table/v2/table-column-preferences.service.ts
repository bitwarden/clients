import { Injectable, inject } from "@angular/core";
import { Observable, map } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/state";

import { TABLE_COLUMN_PREFERENCES, TableColumnPreferences } from "./table-column-preferences.state";

/**
 * Stores which columns each table has hidden, per user. `StateProvider` is resolved lazily,
 * so tables without a `stateKey` need none.
 */
@Injectable({ providedIn: "root" })
export class TableColumnPreferencesService {
  private readonly stateProvider = inject(StateProvider, { optional: true });
  private readonly logService = inject(LogService, { optional: true });

  /** The hidden column names stored for `key`. */
  hiddenColumns$(key: string): Observable<readonly string[]> {
    // Disk may hold a malformed value from an older or foreign write.
    return this.state().state$.pipe(
      map((prefs) => {
        const names = prefs?.[key];
        return Array.isArray(names) ? names.filter((n) => typeof n === "string") : [];
      }),
    );
  }

  /**
   * Shows or hides one column. Derived inside the update so quick successive toggles don't
   * overwrite each other; names the table no longer shows are kept.
   */
  setColumnHidden(key: string, name: string, hidden: boolean): void {
    this.write((prefs) => {
      const names = new Set(prefs[key] ?? []);
      if (hidden) {
        names.add(name);
      } else {
        names.delete(name);
      }
      return { ...prefs, [key]: [...names] };
    });
  }

  /** Drops `key` entirely, restoring the table's declared column set. */
  reset(key: string): void {
    this.write(({ [key]: _dropped, ...rest }) => rest);
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
