import { Signal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Observable } from "rxjs";

import { StateProvider } from "@bitwarden/state";

import { ParamState } from "../../utils";

import { TablePreferencesService } from "./table-preferences.service";
import { TableColumnPreferences, TableStates } from "./table-preferences.state";
import { TableStateKey } from "./table-state-keys";

/** The slice of `ActiveUserState` the service actually uses. */
class FakeActiveUserState<T = TableColumnPreferences> {
  private readonly subject = new BehaviorSubject<T | null>(null);

  /** How many writes the service has made. */
  updates = 0;

  get state$(): Observable<T | null> {
    return this.subject.asObservable();
  }

  /** What the service has written, as the fake store currently holds it. */
  get value(): T | null {
    return this.subject.value;
  }

  /** Seeds the store directly, standing in for a value already on disk. */
  seed(value: T | null): void {
    this.subject.next(value);
  }

  update(
    configure: (prefs: T | null) => T,
    options?: { shouldUpdate?: (prefs: T | null) => boolean },
  ) {
    if (options?.shouldUpdate && !options.shouldUpdate(this.subject.value)) {
      return Promise.resolve(this.subject.value);
    }
    this.updates++;
    this.subject.next(configure(this.subject.value));
    return Promise.resolve(this.subject.value);
  }
}

/** Reads `tableState` the way a table does, from an injection context. */
function readState(
  service: TablePreferencesService,
  key: Signal<TableStateKey | undefined> = signal("vaultItems"),
): () => ParamState | undefined {
  const state = TestBed.runInInjectionContext(() => service.tableState(key));
  return () => {
    TestBed.tick();
    return state();
  };
}

/** Reads `hiddenColumns` the way a table does, from an injection context. */
function readHidden(
  service: TablePreferencesService,
  key: Signal<TableStateKey | undefined> = signal("vaultItems"),
): () => string[] | undefined {
  const hidden = TestBed.runInInjectionContext(() => service.hiddenColumns(key));
  return () => {
    TestBed.tick();
    const names = hidden();
    return names && [...names];
  };
}

describe("TablePreferencesService", () => {
  describe("with a StateProvider", () => {
    let state: FakeActiveUserState;
    let service: TablePreferencesService;

    beforeEach(() => {
      state = new FakeActiveUserState();
      TestBed.configureTestingModule({
        providers: [{ provide: StateProvider, useValue: { getActive: () => state } }],
      });
      service = TestBed.inject(TablePreferencesService);
    });

    it("reports nothing hidden when nothing is stored", () => {
      expect(readHidden(service)()).toEqual([]);
    });

    it("round-trips a hidden column, idempotently", () => {
      const hidden = readHidden(service);

      service.setColumnHidden("vaultItems", "vault", true);
      service.setColumnHidden("vaultItems", "vault", true);

      expect(hidden()).toEqual(["vault"]);
      expect(state.value).toEqual({ "vault-items": ["vault"] });
    });

    it("shows a column again", () => {
      const hidden = readHidden(service);

      service.setColumnHidden("vaultItems", "vault", true);
      service.setColumnHidden("vaultItems", "vault", false);

      expect(hidden()).toEqual([]);
    });

    it("keeps other tables' choices on write and reset", () => {
      state.seed({ "shared-folders": ["items"] });

      service.setColumnHidden("vaultItems", "vault", true);
      expect(state.value).toEqual({ "shared-folders": ["items"], "vault-items": ["vault"] });

      service.reset("vaultItems");
      expect(state.value).toEqual({ "shared-folders": ["items"] });
    });

    it("preserves a stored name for a column the table no longer shows", () => {
      // `vault` was hidden, then the table stopped offering it. Hiding `folder` must not
      // quietly discard the earlier choice.
      service.setColumnHidden("vaultItems", "vault", true);
      service.setColumnHidden("vaultItems", "folder", true);

      expect(state.value).toEqual({ "vault-items": ["vault", "folder"] });
    });

    it("ignores a malformed stored value", () => {
      state.seed({ "vault-items": "nonsense" } as unknown as TableColumnPreferences);

      expect(readHidden(service)()).toEqual([]);
    });

    it("follows a changed key", () => {
      state.seed({ "vault-items": ["vault"] });
      const key = signal<TableStateKey | undefined>(undefined);
      const hidden = readHidden(service, key);

      expect(hidden()).toEqual([]);

      key.set("vaultItems");

      expect(hidden()).toEqual(["vault"]);
    });
  });

  describe("tableState with a StateProvider", () => {
    let state: FakeActiveUserState<TableStates>;
    let service: TablePreferencesService;

    beforeEach(() => {
      state = new FakeActiveUserState<TableStates>();
      TestBed.configureTestingModule({
        providers: [{ provide: StateProvider, useValue: { getActive: () => state } }],
      });
      service = TestBed.inject(TablePreferencesService);
    });

    it("is empty when nothing is stored", () => {
      expect(readState(service)()).toEqual({});
    });

    it("round-trips state, keeping other tables' entries", () => {
      state.seed({ "shared-folders": { sort: "name" } });
      const stored = readState(service);

      service.setTableState("vaultItems", { type: "login", sort: "name", direction: "desc" });

      expect(stored()).toEqual({ type: "login", sort: "name", direction: "desc" });
      expect(state.value).toEqual({
        "shared-folders": { sort: "name" },
        "vault-items": { type: "login", sort: "name", direction: "desc" },
      });
    });

    it("skips the write when the state is unchanged", () => {
      state.seed({ "vault-items": { type: ["login", "card"] } });

      service.setTableState("vaultItems", { type: ["login", "card"] });

      expect(state.updates).toBe(0);
    });

    it("ignores a malformed stored value", () => {
      state.seed({ "vault-items": "nonsense" } as unknown as TableStates);

      expect(readState(service)()).toEqual({});
    });
  });

  it("does not touch StateProvider without a key", () => {
    const getActive = jest.fn(() => new FakeActiveUserState());
    // Consumers often stub only the StateProvider methods they use.
    TestBed.configureTestingModule({
      providers: [{ provide: StateProvider, useValue: { getActive } }],
    });
    const service = TestBed.inject(TablePreferencesService);

    readHidden(service, signal(undefined))();

    expect(getActive).not.toHaveBeenCalled();
  });

  describe("without a StateProvider", () => {
    let service: TablePreferencesService;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      service = TestBed.inject(TablePreferencesService);
    });

    it("reports nothing hidden", () => {
      expect(readHidden(service)()).toEqual([]);
    });

    it("throws on write", () => {
      expect(() => service.setColumnHidden("vaultItems", "vault", true)).toThrow(
        /requires a StateProvider/,
      );
    });

    it("ignores a table state write", () => {
      expect(() => service.setTableState("vaultItems", { sort: "name" })).not.toThrow();
      expect(readState(service)()).toEqual({});
    });
  });
});
