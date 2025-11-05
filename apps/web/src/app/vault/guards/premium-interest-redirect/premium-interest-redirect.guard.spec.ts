import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { PremiumInterestStateService } from "@bitwarden/angular/billing/services/premium-interest/premium-interest-state.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { premiumInterestRedirectGuard } from "./premium-interest-redirect.guard";

describe("premiumInterestRedirectGuard", () => {
  const _state = Object.freeze({}) as RouterStateSnapshot;
  const emptyRoute = Object.freeze({ queryParams: {} }) as ActivatedRouteSnapshot;

  const account = {
    id: "account-id",
  } as Account;

  const activeAccount$ = new BehaviorSubject<Account | null>(account);
  const createUrlTree = jest.fn();
  const getPremiumInterest = jest.fn().mockResolvedValue(false);
  const logError = jest.fn();

  beforeEach(() => {
    getPremiumInterest.mockClear();
    createUrlTree.mockClear();
    logError.mockClear();
    activeAccount$.next(account);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: AccountService, useValue: { activeAccount$ } },
        {
          provide: PremiumInterestStateService,
          useValue: { getPremiumInterest },
        },
        { provide: LogService, useValue: { error: logError } },
      ],
    });
  });

  function runPremiumInterestGuard(route?: ActivatedRouteSnapshot) {
    // Run the guard within injection context so `inject` works as you'd expect
    // Pass state object to make TypeScript happy
    return TestBed.runInInjectionContext(async () =>
      premiumInterestRedirectGuard(route ?? emptyRoute, _state),
    );
  }

  it("returns `true` when the user does not intend to setup premium", async () => {
    getPremiumInterest.mockResolvedValueOnce(false);

    expect(await runPremiumInterestGuard()).toBe(true);
  });

  it("redirects to premium subscription page when user intends to setup premium", async () => {
    getPremiumInterest.mockResolvedValueOnce(true);

    await runPremiumInterestGuard();

    expect(createUrlTree).toHaveBeenCalledWith(["/settings/subscription/premium"]);
  });

  it("redirects to login when active account is missing", async () => {
    activeAccount$.next(null);

    await runPremiumInterestGuard();

    expect(createUrlTree).toHaveBeenCalledWith(["/login"]);
  });

  it("returns `true` and logs error when getPremiumInterest throws an error", async () => {
    const error = new Error("Premium interest check failed");
    getPremiumInterest.mockRejectedValueOnce(error);

    expect(await runPremiumInterestGuard()).toBe(true);
    expect(logError).toHaveBeenCalledWith("Error in premiumInterestRedirectGuard", error);
  });
});
