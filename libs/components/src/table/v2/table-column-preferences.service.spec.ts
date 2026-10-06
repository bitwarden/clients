import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Observable } from "rxjs";

import { StateProvider } from "@bitwarden/state";

import { TableColumnPreferencesService } from "./table-column-preferences.service";
import { TableColumnPreferences } from "./table-column-preferences.state";

/** The slice of `ActiveUserState` the service actually uses. */
class FakeActiveUserState {
  private readonly subject = new BehaviorSubject<TableColumnPreferences | null>(null);

  get state$(): Observable<TableColumnPreferences | null> {
    return this.subject.asObservable();
  }

  /** What the service has written, as the fake store currently holds it. */
  get value(): TableColumnPreferences | null {
    return this.subject.value;
  }

  /** Seeds the store directly, standing in for a value already on disk. */
  seed(value: TableColumnPreferences | null): void {
    this.subject.next(value);
  }

  update(configure: (prefs: TableColumnPreferences | null) => TableColumnPreferences) {
    this.subject.next(configure(this.subject.value));
    return Promise.resolve(this.subject.value);
  }
}

describe("TableColumnPreferencesService", () => {
  describe("with a StateProvider", () => {
    let state: FakeActiveUserState;
    let service: TableColumnPreferencesService;

    beforeEach(() => {
      state = new FakeActiveUserState();
      TestBed.configureTestingModule({
        providers: [{ provide: StateProvider, useValue: { getActive: () => state } }],
      });
      service = TestBed.inject(TableColumnPreferencesService);
    });

    const hidden = (key: string) => service.preferences()?.[key] ?? [];

    it("reports nothing hidden for an unknown table", () => {
      expect(hidden("vault-items")).toEqual([]);
    });

    it("round-trips a hidden column", () => {
      service.setColumnHidden("vault-items", "vault", true);

      expect(hidden("vault-items")).toEqual(["vault"]);
      expect(state.value).toEqual({ "vault-items": ["vault"] });
    });

    it("shows a column again", () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("vault-items", "vault", false);

      expect(hidden("vault-items")).toEqual([]);
    });

    it("is idempotent", () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("vault-items", "vault", true);

      expect(hidden("vault-items")).toEqual(["vault"]);
    });

    it("keeps each table's choices separate", () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("shared-folders", "items", true);

      expect(hidden("vault-items")).toEqual(["vault"]);
      expect(hidden("shared-folders")).toEqual(["items"]);
    });

    it("drops only its own key on reset", () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("shared-folders", "items", true);

      service.reset("vault-items");

      expect(hidden("vault-items")).toEqual([]);
      expect(hidden("shared-folders")).toEqual(["items"]);
      expect(state.value).toEqual({ "shared-folders": ["items"] });
    });

    it("preserves a stored name for a column the table no longer shows", () => {
      // `vault` was hidden, then the table stopped offering it. Hiding `folder` must not
      // quietly discard the earlier choice.
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("vault-items", "folder", true);

      expect([...hidden("vault-items")].sort()).toEqual(["folder", "vault"]);
    });

    it("derives each write from what is stored, so quick successive writes both land", () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("vault-items", "folder", true);

      expect(state.value).toEqual({ "vault-items": ["vault", "folder"] });
    });

    it("reads an empty record when nothing is stored", () => {
      expect(service.preferences()).toEqual({});
    });
  });

  describe("without a StateProvider", () => {
    let service: TableColumnPreferencesService;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      service = TestBed.inject(TableColumnPreferencesService);
    });

    it("reads an empty record", () => {
      expect(service.preferences()).toEqual({});
    });

    it("throws on write", () => {
      expect(() => service.setColumnHidden("vault-items", "vault", true)).toThrow(
        /requires a StateProvider/,
      );
    });
  });
});
