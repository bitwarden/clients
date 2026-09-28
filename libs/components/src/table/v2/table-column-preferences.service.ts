import { Injectable, Signal, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/state";

import { TABLE_COLUMN_PREFERENCES, TableColumnPreferences } from "./table-column-preferences.state";

const EMPTY: TableColumnPreferences = Object.freeze({});

/**
 * Stores which columns each table has hidden, per user. `StateProvider` is optional so the
 * library still runs without platform state (Storybook, Jest), holding the preference in
 * memory for the session instead.
 */
@Injectable({ providedIn: "root" })
export class TableColumnPreferencesService {
  private readonly stateProvider = inject(StateProvider, { optional: true });
  private readonly logService = inject(LogService, { optional: true });

  private readonly state = this.stateProvider?.getActive(TABLE_COLUMN_PREFERENCES);

  /** Session-only fallback used when there is no `StateProvider` to persist to. */
  private readonly inMemory = signal<TableColumnPreferences>(EMPTY);

  private readonly stored: Signal<TableColumnPreferences>;

  /** One memoized signal per key, so `effectiveColumns` doesn't churn on Set identity. */
  private readonly hiddenByKey = new Map<string, Signal<ReadonlySet<string>>>();

  constructor() {
    this.stored = this.state
      ? toSignal(this.state.state$.pipe(map((prefs) => prefs ?? EMPTY)), { initialValue: EMPTY })
      : this.inMemory.asReadonly();

    if (!this.state) {
      this.logService?.warning(
        "TableColumnPreferencesService: no StateProvider available, so column choices " +
          "last only for this session.",
      );
    }
  }

  /** The hidden column names stored for `key`. */
  hidden(key: string): Signal<ReadonlySet<string>> {
    let hidden = this.hiddenByKey.get(key);
    if (!hidden) {
      // Guarded at the point of use because it covers every path — disk, the in-memory
      // fallback, and an in-flight write. `new Set` on a stray string yields characters.
      hidden = computed(() => {
        const names = this.stored()[key];
        return new Set(Array.isArray(names) ? names.filter((n) => typeof n === "string") : []);
      });
      this.hiddenByKey.set(key, hidden);
    }
    return hidden;
  }

  /**
   * Shows or hides one column. The new set is derived inside the update rather than from
   * the signal the caller last read: writes are asynchronous, so two quick toggles would
   * otherwise both build on the same stale set. Names the table no longer shows are kept.
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

  private write(update: (prefs: TableColumnPreferences) => TableColumnPreferences): void {
    if (!this.state) {
      this.inMemory.update((prefs) => update(prefs));
      return;
    }
    void this.state
      .update((prefs) => update(prefs ?? EMPTY))
      .catch((e: unknown) => this.logService?.error(e));
  }
}
