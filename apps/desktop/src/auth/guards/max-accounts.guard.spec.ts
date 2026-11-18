import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, Observable, of } from "rxjs";

import { AccountSwitcherService } from "@bitwarden/common/auth/account-switcher";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { maxAccountsGuardFn } from "./max-accounts.guard";

describe("maxAccountsGuardFn", () => {
  let accountSwitcherService: MockProxy<AccountSwitcherService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;

  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      firstValueFrom(
        maxAccountsGuardFn()(
          mock<ActivatedRouteSnapshot>(),
          mock<RouterStateSnapshot>(),
        ) as Observable<boolean>,
      ),
    );

  beforeEach(() => {
    accountSwitcherService = mock<AccountSwitcherService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountSwitcherService, useValue: accountSwitcherService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
      ],
    });
  });

  it("allows navigation when another account can be added", async () => {
    accountSwitcherService.canAddAccount$ = of(true);

    const result = await runGuard();

    expect(result).toBe(true);
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("blocks navigation and shows a toast when the account limit is reached", async () => {
    accountSwitcherService.canAddAccount$ = of(false);

    const result = await runGuard();

    expect(result).toBe(false);
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      title: null,
      message: "accountLimitReached",
    });
  });
});
