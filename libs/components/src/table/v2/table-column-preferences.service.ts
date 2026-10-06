import { DestroyRef, Injectable, Signal, inject, signal, untracked } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { map, of } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/state";

import { TABLE_COLUMN_PREFERENCES, TableColumnPreferences } from "./table-column-preferences.state";

/**
 * Stores which columns each table has hidden, per user. Without a `StateProvider` nothing is
 * stored, so only tables with a `stateKey` need one.
 */
@Injectable({ providedIn: "root" })
export class TableColumnPreferencesService {
  private readonly stateProvider = inject(StateProvider, { optional: true });
  private readonly logService = inject(LogService, { optional: true });

  private readonly destroyRef = inject(DestroyRef);
  private readonly _preferences = signal<TableColumnPreferences | undefined>(undefined);
  private subscribed = false;

  /**
   * Every table's stored hidden names. `undefined` until the stored value loads. Subscribes on
   * first read, so tables without a `stateKey` never touch `StateProvider`.
   */
  get preferences(): Signal<TableColumnPreferences | undefined> {
    if (!this.subscribed) {
      this.subscribed = true;
      // `untracked` because the first read can come from a `computed`, where signal writes throw.
      untracked(() =>
        (this.stateProvider == null ? of({}) : this.state().state$.pipe(map((p) => p ?? {})))
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((prefs) => this._preferences.set(prefs)),
      );
    }
    return this._preferences.asReadonly();
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
