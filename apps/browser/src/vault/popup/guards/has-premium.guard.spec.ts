import { TestBed } from "@angular/core/testing";
import { Router, UrlTree } from "@angular/router";
import { BehaviorSubject, firstValueFrom, Observable, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { UserId } from "@bitwarden/common/types/guid";

import { hasPremiumGuard } from "./has-premium.guard";

describe("hasPremiumGuard", () => {
  const userId = "user-1" as UserId;
  const account = { id: userId } as Account;

  const activeAccount$ = new BehaviorSubject<Account | null>(account);
  const createUrlTree = jest.fn();
  const hasPremiumFromAnySource$ = jest.fn();
  const urlTreeSentinel = {} as UrlTree;

  beforeEach(() => {
    activeAccount$.next(account);
    createUrlTree.mockReset().mockReturnValue(urlTreeSentinel);
    hasPremiumFromAnySource$.mockReset();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: AccountService, useValue: { activeAccount$ } },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$ },
        },
      ],
    });
  });

  const runGuard = () =>
    firstValueFrom(
      TestBed.runInInjectionContext(
        () => hasPremiumGuard(null as never, null as never) as Observable<boolean | UrlTree>,
      ),
    );

  it("returns true when the active account has premium", async () => {
    hasPremiumFromAnySource$.mockReturnValue(of(true));

    const result = await runGuard();

    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it("redirects to /tabs/reports when the active account is not premium", async () => {
    hasPremiumFromAnySource$.mockReturnValue(of(false));

    const result = await runGuard();

    expect(createUrlTree).toHaveBeenCalledWith(["/tabs/reports"]);
    expect(result).toBe(urlTreeSentinel);
  });

  it("redirects to /tabs/reports when there is no active account", async () => {
    activeAccount$.next(null);

    const result = await runGuard();

    expect(hasPremiumFromAnySource$).not.toHaveBeenCalled();
    expect(createUrlTree).toHaveBeenCalledWith(["/tabs/reports"]);
    expect(result).toBe(urlTreeSentinel);
  });

  it("calls hasPremiumFromAnySource$ with the active account id", async () => {
    hasPremiumFromAnySource$.mockReturnValue(of(true));

    await runGuard();

    expect(hasPremiumFromAnySource$).toHaveBeenCalledWith(userId);
  });
});
