import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Observable, firstValueFrom } from "rxjs";

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

    const hidden = (key: string) => firstValueFrom(service.hiddenColumns$(key));

    it("reports nothing hidden for an unknown table", async () => {
      expect(await hidden("vault-items")).toEqual([]);
    });

    it("round-trips a hidden column", async () => {
      service.setColumnHidden("vault-items", "vault", true);

      expect(await hidden("vault-items")).toEqual(["vault"]);
      expect(state.value).toEqual({ "vault-items": ["vault"] });
    });

    it("shows a column again", async () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("vault-items", "vault", false);

      expect(await hidden("vault-items")).toEqual([]);
    });

    it("is idempotent", async () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("vault-items", "vault", true);

      expect(await hidden("vault-items")).toEqual(["vault"]);
    });

    it("keeps each table's choices separate", async () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("shared-folders", "items", true);

      expect(await hidden("vault-items")).toEqual(["vault"]);
      expect(await hidden("shared-folders")).toEqual(["items"]);
    });

    it("drops only its own key on reset", async () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("shared-folders", "items", true);

      service.reset("vault-items");

      expect(await hidden("vault-items")).toEqual([]);
      expect(await hidden("shared-folders")).toEqual(["items"]);
      expect(state.value).toEqual({ "shared-folders": ["items"] });
    });

    it("preserves a stored name for a column the table no longer shows", async () => {
      // `vault` was hidden, then the table stopped offering it. Hiding `folder` must not
      // quietly discard the earlier choice.
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("vault-items", "folder", true);

      expect([...(await hidden("vault-items"))].sort()).toEqual(["folder", "vault"]);
    });

    it("derives each write from what is stored, so quick successive writes both land", () => {
      service.setColumnHidden("vault-items", "vault", true);
      service.setColumnHidden("vault-items", "folder", true);

      expect(state.value).toEqual({ "vault-items": ["vault", "folder"] });
    });

    it("tolerates a malformed stored value", async () => {
      state.seed({ "vault-items": "nonsense" } as unknown as TableColumnPreferences);

      expect(await hidden("vault-items")).toEqual([]);
    });
  });

  describe("without a StateProvider", () => {
    let service: TableColumnPreferencesService;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      service = TestBed.inject(TableColumnPreferencesService);
    });

    it("throws when there is no StateProvider", () => {
      expect(() => service.hiddenColumns$("vault-items")).toThrow(/requires a StateProvider/);
      expect(() => service.setColumnHidden("vault-items", "vault", true)).toThrow(
        /requires a StateProvider/,
      );
    });
  });
});
