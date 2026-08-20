import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  NavigationEnd,
  NavigationStart,
  provideRouter,
  Router,
  RouterEvent,
} from "@angular/router";
import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
  const otherUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let router: Router;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    TestBed.configureTestingModule({
      providers: [
        { provide: StateProvider, useValue: stateProvider },
        { provide: AccountService, useValue: accountService },
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

  /** Seeds state as if a previous session had already written it, for a given user. */
  function seedStored(
    remembered: Record<string, Record<string, string>>,
    userId: UserId = mockUserId,
  ): void {
    stateProvider.singleUser.getFake(userId, VAULT_FILTER_MEMORY).nextState(remembered);
  }

  function storedState(userId: UserId = mockUserId) {
    return stateProvider.singleUser
      .getFake(userId, VAULT_FILTER_MEMORY)
      .nextMock.mock.calls.at(-1)?.[0];
  }

  function writeCount(userId: UserId = mockUserId): number {
    return stateProvider.singleUser.getFake(userId, VAULT_FILTER_MEMORY).nextMock.mock.calls.length;
  }

  it("returns nothing for a scope that hasn't been visited", async () => {
    const service = createService();

    await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({});
  });

  it("remembers the filters a vault route was left with", async () => {
    const service = createService();

    await router.navigateByUrl("/vault?vault.type=1&vault.folder=f-1");

    await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({
      "vault.type": "1",
      "vault.folder": "f-1",
    });
  });

  it("remembers the sort the table was left on", async () => {
    const service = createService();

    await router.navigateByUrl("/vault?vault.sort=name&vault.direction=desc");

    await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({
      "vault.sort": "name",
      "vault.direction": "desc",
    });
  });

  it("does not remember the search term", async () => {
    const service = createService();

    await router.navigateByUrl("/vault?vault.type=1&vault.search=chase");

    await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({ "vault.type": "1" });
  });

  // The allowlist fails closed: a param that turns up under the namespace later isn't persisted to
  // disk just because it shares the prefix.
  it("does not remember a param it doesn't recognize", async () => {
    const service = createService();

    await router.navigateByUrl("/vault?vault.type=1&vault.selectedRow=c-1&vault.page=3");

    await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({ "vault.type": "1" });
  });

  it("replaces a scope's filters rather than accumulating them", async () => {
    const service = createService();

    await router.navigateByUrl("/vault?vault.type=1");
    await router.navigateByUrl("/vault?vault.folder=f-1");

    await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({ "vault.folder": "f-1" });
  });

  it("ignores navigation away from the vault", async () => {
    const service = createService();

    await router.navigateByUrl("/vault?vault.type=1");
    await router.navigateByUrl("/sends");

    await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({ "vault.type": "1" });
  });

  it("keeps each vault scope's filters separate", async () => {
    const service = createService();

    await router.navigateByUrl("/vault?vault.type=1");
    await router.navigateByUrl(`/vault/${MY_VAULT_SCOPE}?vault.type=3`);

    await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({ "vault.type": "1" });
    await expect(service.paramsFor(MY_VAULT_SCOPE)).resolves.toEqual({ "vault.type": "3" });
  });

  // Back and forward retrace URLs that were recorded when the user first visited them, so there's
  // nothing to learn. It matters because a history entry can hold a bare vault URL — recording that
  // on the way past would erase the scope's memory without the user clearing anything.
  describe("back and forward", () => {
    /**
     * Replays how the router announces a history navigation. `SpyLocation.back()` updates the
     * mock's own URL without driving a navigation through the router in TestBed, so the trigger
     * this service reads — `NavigationStart.navigationTrigger` — has to be stated directly.
     */
    function simulatePopstate(url: string): void {
      const events = router.events as unknown as Subject<RouterEvent>;
      events.next(new NavigationStart(99, url, "popstate"));
      events.next(new NavigationEnd(99, url, url));
    }

    it("does not record a navigation the user reached with back or forward", async () => {
      const service = createService();

      await router.navigateByUrl("/vault?vault.type=1");
      await service.paramsFor(ALL_ITEMS_SCOPE);
      const writesBefore = writeCount();

      simulatePopstate("/vault");
      await service.paramsFor(ALL_ITEMS_SCOPE);

      expect(writeCount()).toBe(writesBefore);
    });

    it("records again once the user navigates imperatively", async () => {
      const service = createService();

      await router.navigateByUrl("/vault?vault.type=1");
      simulatePopstate("/vault");

      await router.navigateByUrl("/vault?vault.type=2");

      await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({ "vault.type": "2" });
    });
  });

  describe("persistence", () => {
    it("restores what a previous session stored", async () => {
      seedStored({ [ALL_ITEMS_SCOPE]: { "vault.type": "1" } });

      const service = createService();

      await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({ "vault.type": "1" });
    });

    it("writes a recorded scope to state", async () => {
      createService();

      await router.navigateByUrl("/vault?vault.type=1");
      await router.navigateByUrl("/sends");

      expect(storedState()).toEqual({ [ALL_ITEMS_SCOPE]: { "vault.type": "1" } });
    });

    it("leaves other scopes in state untouched when writing one", async () => {
      seedStored({ [MY_VAULT_SCOPE]: { "vault.type": "3" } });

      const service = createService();
      await router.navigateByUrl("/vault?vault.type=1");
      await service.paramsFor(ALL_ITEMS_SCOPE);

      expect(storedState()).toEqual({
        [MY_VAULT_SCOPE]: { "vault.type": "3" },
        [ALL_ITEMS_SCOPE]: { "vault.type": "1" },
      });
    });

    // A scope switch reads the memory mid-navigation, right after the outgoing scope was recorded.
    // Without the write chain the read would race the write that just recorded it.
    it("serves a record that is still being written", async () => {
      const service = createService();

      await router.navigateByUrl("/vault?vault.type=1");

      // No flush between the navigation and the read — `paramsFor` has to wait for the write.
      await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({ "vault.type": "1" });
    });

    it("keeps serving reads after a failed write", async () => {
      const service = createService();
      const state = stateProvider.singleUser.getFake(mockUserId, VAULT_FILTER_MEMORY);
      jest.spyOn(state, "update").mockRejectedValueOnce(new Error("disk full"));

      await router.navigateByUrl("/vault?vault.type=1");
      await router.navigateByUrl(`/vault/${MY_VAULT_SCOPE}?vault.type=3`);

      await expect(service.paramsFor(MY_VAULT_SCOPE)).resolves.toEqual({ "vault.type": "3" });
    });
  });

  describe("account switching", () => {
    // Writes name the user explicitly rather than going through the active-user alias, which
    // resolves whoever is active when the write lands — mid-switch, the wrong account.
    it("writes under the account that recorded the filters", async () => {
      const service = createService();
      const getUser = jest.spyOn(stateProvider, "getUser");

      await router.navigateByUrl("/vault?vault.type=1");
      await service.paramsFor(ALL_ITEMS_SCOPE);

      expect(getUser).toHaveBeenCalledWith(mockUserId, VAULT_FILTER_MEMORY);
      expect(storedState(mockUserId)).toEqual({ [ALL_ITEMS_SCOPE]: { "vault.type": "1" } });
      expect(writeCount(otherUserId)).toBe(0);
    });

    // Nothing is cached in memory across the switch, so the incoming account reads its own state
    // rather than inheriting the outgoing account's folder and collection ids.
    it("does not serve one account's filters to another", async () => {
      const service = createService();
      seedStored({ [ALL_ITEMS_SCOPE]: { "vault.folder": "theirs" } }, otherUserId);

      await router.navigateByUrl("/vault?vault.type=1");
      await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({ "vault.type": "1" });

      await accountService.switchAccount(otherUserId);

      await expect(service.paramsFor(ALL_ITEMS_SCOPE)).resolves.toEqual({
        "vault.folder": "theirs",
      });
    });
  });
});
