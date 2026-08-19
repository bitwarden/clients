import { ChangeDetectionStrategy, Component } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { VAULT_FILTER_MEMORY, VaultFilterMemoryService } from "./vault-filter-memory.service";
import { ALL_ITEMS_SCOPE, MY_VAULT_SCOPE, type VaultScopeRouteData } from "./vault-scope";

/** Stands in as the target of every route the tests navigate between. */
@Component({ template: "", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
class BlankComponent {}

const inScope = { vaultFilterScope: true } satisfies VaultScopeRouteData;

describe("VaultFilterMemoryService", () => {
  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let router: Router;

  /** Longer than the service's persist debounce. */
  const PAST_DEBOUNCE = 1000;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    TestBed.configureTestingModule({
      providers: [
        { provide: StateProvider, useValue: stateProvider },
        provideRouter([
          { path: "vault", component: BlankComponent, data: inScope },
          { path: "vault/:vaultId", component: BlankComponent, data: inScope },
          { path: "sends", component: BlankComponent },
        ]),
      ],
    });
    router = TestBed.inject(Router);
  });

  /** Constructs the service, so it's listening before the test navigates. */
  function createService(): VaultFilterMemoryService {
    return TestBed.inject(VaultFilterMemoryService);
  }

  /** Seeds state as if a previous session had already written it. */
  function seedStored(remembered: Record<string, Record<string, string>>): void {
    stateProvider.activeUser.getFake(VAULT_FILTER_MEMORY).nextState(remembered);
  }

  /** The active-user fake records each write as a single `[userId, value]` argument. */
  function storedState() {
    return stateProvider.activeUser.getFake(VAULT_FILTER_MEMORY).nextMock.mock.calls.at(-1)?.[0][1];
  }

  function navigate(url: string): void {
    void router.navigateByUrl(url);
    tick();
  }

  it("returns nothing for a scope that hasn't been visited", () => {
    const service = createService();

    expect(service.paramsFor(ALL_ITEMS_SCOPE)).toEqual({});
  });

  it("remembers the filters a vault route was left with", fakeAsync(() => {
    const service = createService();

    navigate("/vault?vault.type=1&vault.folder=f-1");

    expect(service.paramsFor(ALL_ITEMS_SCOPE)).toEqual({
      "vault.type": "1",
      "vault.folder": "f-1",
    });
  }));

  it("does not remember the search term", fakeAsync(() => {
    const service = createService();

    navigate("/vault?vault.type=1&vault.search=chase");

    expect(service.paramsFor(ALL_ITEMS_SCOPE)).toEqual({ "vault.type": "1" });
  }));

  it("replaces a scope's filters rather than accumulating them", fakeAsync(() => {
    const service = createService();

    navigate("/vault?vault.type=1");
    navigate("/vault?vault.folder=f-1");

    expect(service.paramsFor(ALL_ITEMS_SCOPE)).toEqual({ "vault.folder": "f-1" });
  }));

  it("ignores navigation away from the vault", fakeAsync(() => {
    const service = createService();

    navigate("/vault?vault.type=1");
    navigate("/sends");

    expect(service.paramsFor(ALL_ITEMS_SCOPE)).toEqual({ "vault.type": "1" });
  }));

  it("keeps each vault scope's filters separate", fakeAsync(() => {
    const service = createService();

    navigate("/vault?vault.type=1");
    navigate(`/vault/${MY_VAULT_SCOPE}?vault.type=3`);

    expect(service.paramsFor(ALL_ITEMS_SCOPE)).toEqual({ "vault.type": "1" });
    expect(service.paramsFor(MY_VAULT_SCOPE)).toEqual({ "vault.type": "3" });
  }));

  describe("cross-session persistence", () => {
    it("restores what a previous session stored", fakeAsync(() => {
      seedStored({ [ALL_ITEMS_SCOPE]: { "vault.type": "1" } });

      const service = createService();
      tick();

      expect(service.paramsFor(ALL_ITEMS_SCOPE)).toEqual({ "vault.type": "1" });
    }));

    it("writes a recorded scope to state once the debounce elapses", fakeAsync(() => {
      createService();

      navigate("/vault?vault.type=1");
      tick(PAST_DEBOUNCE);

      expect(storedState()).toEqual({ [ALL_ITEMS_SCOPE]: { "vault.type": "1" } });
    }));

    it("leaves other scopes in state untouched when writing one", fakeAsync(() => {
      seedStored({ [MY_VAULT_SCOPE]: { "vault.type": "3" } });

      createService();
      navigate("/vault?vault.type=1");
      tick(PAST_DEBOUNCE);

      expect(storedState()).toEqual({
        [MY_VAULT_SCOPE]: { "vault.type": "3" },
        [ALL_ITEMS_SCOPE]: { "vault.type": "1" },
      });
    }));

    it("does not write on every change while the user is still filtering", fakeAsync(() => {
      createService();

      navigate("/vault?vault.type=1");
      navigate("/vault?vault.type=2");
      navigate("/vault?vault.type=3");
      tick(PAST_DEBOUNCE);

      const state = stateProvider.activeUser.getFake(VAULT_FILTER_MEMORY);
      expect(state.nextMock).toHaveBeenCalledTimes(1);
      expect(storedState()).toEqual({ [ALL_ITEMS_SCOPE]: { "vault.type": "3" } });
    }));

    // The debounce collapses a burst of navigations into one write, so the write has to carry every
    // scope the burst touched — not just the one that happened to be last.
    it("persists every scope recorded inside the debounce window", fakeAsync(() => {
      createService();

      navigate("/vault?vault.type=1");
      navigate(`/vault/${MY_VAULT_SCOPE}?vault.type=3`);
      tick(PAST_DEBOUNCE);

      expect(storedState()).toEqual({
        [ALL_ITEMS_SCOPE]: { "vault.type": "1" },
        [MY_VAULT_SCOPE]: { "vault.type": "3" },
      });
    }));

    it("still writes only once for a burst spanning several scopes", fakeAsync(() => {
      createService();

      navigate("/vault?vault.type=1");
      navigate(`/vault/${MY_VAULT_SCOPE}?vault.type=3`);
      tick(PAST_DEBOUNCE);

      expect(stateProvider.activeUser.getFake(VAULT_FILTER_MEMORY).nextMock).toHaveBeenCalledTimes(
        1,
      );
    }));

    // The stored value resolves asynchronously, so a scope recorded before it lands must not
    // shadow the scopes it didn't touch.
    it("does not lose stored scopes to a navigation recorded before the read resolves", fakeAsync(() => {
      const service = createService();

      navigate("/vault?vault.type=1");
      seedStored({ [MY_VAULT_SCOPE]: { "vault.type": "3" } });
      tick();

      expect(service.paramsFor(MY_VAULT_SCOPE)).toEqual({ "vault.type": "3" });
      expect(service.paramsFor(ALL_ITEMS_SCOPE)).toEqual({ "vault.type": "1" });
    }));

    it("prefers this session's record over the stored one for the same scope", fakeAsync(() => {
      seedStored({ [ALL_ITEMS_SCOPE]: { "vault.type": "1" } });

      const service = createService();
      tick();
      navigate("/vault?vault.type=2");

      expect(service.paramsFor(ALL_ITEMS_SCOPE)).toEqual({ "vault.type": "2" });
    }));
  });
});
