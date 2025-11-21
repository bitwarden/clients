import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";

import { WebBrowserInteractionService } from "../services/web-browser-interaction.service";

import { setupExtensionRedirectGuard } from "./setup-extension-redirect.guard";

describe("setupExtensionRedirectGuard", () => {
  const _state = Object.freeze({}) as RouterStateSnapshot;
  const emptyRoute = Object.freeze({ queryParams: {} }) as ActivatedRouteSnapshot;
  const seventeenDaysAgo = new Date();
  seventeenDaysAgo.setDate(seventeenDaysAgo.getDate() - 17);

  const account = {
    id: "account-id",
  } as unknown as Account;

  const activeAccount$ = new BehaviorSubject<Account | null>(account);
  const extensionInstalled$ = new BehaviorSubject<boolean>(false);
  const state$ = new BehaviorSubject<boolean>(false);
  const createUrlTree = jest.fn();
  const getProfileCreationDate = jest.fn().mockResolvedValue(seventeenDaysAgo);

  beforeEach(() => {
    Utils.isMobileBrowser = false;

    getProfileCreationDate.mockClear();
    createUrlTree.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: StateProvider, useValue: { getUser: () => ({ state$ }) } },
        { provide: WebBrowserInteractionService, useValue: { extensionInstalled$ } },
        {
          provide: VaultProfileService,
          useValue: { getProfileCreationDate },
        },
      ],
    });
  });

  function setupExtensionGuard(route?: ActivatedRouteSnapshot) {
    // Run the guard within injection context so `inject` works as you'd expect
    // Pass state object to make TypeScript happy
    return TestBed.runInInjectionContext(async () =>
      setupExtensionRedirectGuard(route ?? emptyRoute, _state),
    );
  }

  it("returns `true` when the profile was created more than 30 days ago", async () => {
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

    getProfileCreationDate.mockResolvedValueOnce(thirtyOneDaysAgo);

    expect(await setupExtensionGuard()).toBe(true);
  });

  it("returns `true` when the profile check fails", async () => {
    getProfileCreationDate.mockRejectedValueOnce(new Error("Profile check failed"));

    expect(await setupExtensionGuard()).toBe(true);
  });

  it("returns `true` when the user is on a mobile device", async () => {
    Utils.isMobileBrowser = true;

    expect(await setupExtensionGuard()).toBe(true);
  });

  it("returns `true` when the user has dismissed the extension page", async () => {
    state$.next(true);

    expect(await setupExtensionGuard()).toBe(true);
  });

  it('redirects the user to "/setup-extension" when all criteria do not pass', async () => {
    state$.next(false);
    extensionInstalled$.next(false);

    await setupExtensionGuard();

    expect(createUrlTree).toHaveBeenCalledWith(["/setup-extension"]);
  });

  describe("missing current account", () => {
    afterAll(() => {
      // reset `activeAccount$` observable
      activeAccount$.next(account);
    });

    it("redirects to login when account is missing", async () => {
      activeAccount$.next(null);

      await setupExtensionGuard();

      expect(createUrlTree).toHaveBeenCalledWith(["/login"]);
    });
  });
});
