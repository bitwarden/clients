import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ServerSettings } from "@bitwarden/common/platform/models/domain/server-settings";
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

  let serverSettings$: BehaviorSubject<ServerSettings | null>;

  beforeEach(() => {
    Utils.isMobileBrowser = false;

    getProfileCreationDate.mockClear();
    createUrlTree.mockClear();
    serverSettings$ = new BehaviorSubject<ServerSettings | null>(new ServerSettings());

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
        {
          provide: ConfigService,
          useValue: { serverSettings$: serverSettings$.asObservable() },
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

  it("returns `true` when suppressOnboardingInterstitials is enabled", async () => {
    state$.next(false);
    serverSettings$.next(new ServerSettings({ suppressOnboardingInterstitials: true }));

    const result = await setupExtensionGuard();

    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
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
