import { Injectable, Signal, computed, inject } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { map, of, switchMap } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/state";

import { ParamState } from "../../utils";

import {
  TABLE_COLUMN_PREFERENCES,
  TABLE_STATE,
  TableColumnPreferences,
} from "./table-preferences.state";
import { TABLE_STATE_KEYS, TableStateKey } from "./table-state-keys";

/** Whether two flat param records hold the same values (arrays compared element-wise). */
function sameParamState(a: ParamState | undefined, b: ParamState): boolean {
  if (a == null) {
    return false;
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  return keys.every((key) => {
    const left = a[key];
    const right = b[key];
    if (Array.isArray(left) || Array.isArray(right)) {
      return (
        Array.isArray(left) &&
        Array.isArray(right) &&
        left.length === right.length &&
        left.every((item, i) => item === right[i])
      );
    }
    return left === right;
  });
}

/**
 * Stores each table's per-user preferences: which columns it has hidden, and its last filter,
 * sort, and page-size state. Without a `StateProvider` nothing is stored, so only tables with a
 * `stateKey` need one.
 */
@Injectable({ providedIn: "root" })
export class TablePreferencesService {
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
            : this.columnState().state$.pipe(map((prefs) => prefs?.[TABLE_STATE_KEYS[k]])),
        ),
        // Disk may hold a malformed value from an older or foreign write.
        map((stored) => new Set(Array.isArray(stored) ? stored : [])),
      ),
    );
  }

  /**
   * The table state stored for `key`, `undefined` until it loads. Empty, synchronously, without
   * a key or a `StateProvider`. Call from an injection context.
   */
  tableState(key: Signal<TableStateKey | undefined>): Signal<ParamState | undefined> {
    const stored = toSignal(
      toObservable(key).pipe(
        switchMap((k) =>
          k == null || this.stateProvider == null
            ? of({})
            : this.tableStates().state$.pipe(map((states) => states?.[TABLE_STATE_KEYS[k]])),
        ),
        // Disk may hold a malformed value from an older or foreign write.
        map((state): ParamState =>
          state != null && typeof state === "object" ? (state as ParamState) : {},
        ),
      ),
    );
    return computed<ParamState | undefined>(() =>
      key() == null || this.stateProvider == null ? {} : stored(),
    );
  }

  /**
   * Replaces the table state stored for `key`. Skips the write when nothing changed, and does
   * nothing without a `StateProvider` — the table writes on every change, so unlike a column
   * toggle this isn't a user action worth failing loudly on.
   */
  setTableState(key: TableStateKey, state: ParamState): void {
    if (this.stateProvider == null) {
      return;
    }
    const storageKey = TABLE_STATE_KEYS[key];
    void this.tableStates()
      .update((states) => ({ ...(states ?? {}), [storageKey]: state }), {
        shouldUpdate: (states) => !sameParamState(states?.[storageKey], state),
      })
      .catch((e: unknown) => this.logService?.error(e));
  }

  /**
   * Shows or hides one column. Derived inside the update so quick successive toggles don't
   * overwrite each other; names the table no longer shows are kept.
   */
  setColumnHidden(key: TableStateKey, name: string, hidden: boolean): void {
    this.writeColumns((prefs) => {
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

  /** Drops `key`'s column preference entirely, restoring the table's declared column set. */
  reset(key: TableStateKey): void {
    this.writeColumns(({ [TABLE_STATE_KEYS[key]]: _dropped, ...rest }) => rest);
  }

  private requireProvider(): StateProvider {
    if (this.stateProvider == null) {
      throw new Error("bit-table-v2: `stateKey` requires a StateProvider.");
    }
    return this.stateProvider;
  }

  private columnState() {
    return this.requireProvider().getActive(TABLE_COLUMN_PREFERENCES);
  }

  private tableStates() {
    return this.requireProvider().getActive(TABLE_STATE);
  }

  private writeColumns(update: (prefs: TableColumnPreferences) => TableColumnPreferences): void {
    void this.columnState()
      .update((prefs) => update(prefs ?? {}))
      .catch((e: unknown) => this.logService?.error(e));
  }
}
