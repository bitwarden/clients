import { TestBed } from "@angular/core/testing";
import { Router, UrlTree } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Observable, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";

import { AutomaticUserConfirmationService } from "../abstractions";

import { canAccessAutoConfirmSettings } from "./automatic-user-confirmation-settings.guard";

describe("canAccessAutoConfirmSettings", () => {
  let accountService: MockProxy<AccountService>;
  let autoConfirmService: MockProxy<AutomaticUserConfirmationService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let router: MockProxy<Router>;

  const mockUserId = newGuid() as UserId;
  const mockAccount: Account = {
    id: mockUserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  };
  let activeAccount$: BehaviorSubject<Account | null>;

  const runGuard = () => {
    return TestBed.runInInjectionContext(() => {
      return canAccessAutoConfirmSettings(null as any, null as any) as Observable<
        boolean | UrlTree
      >;
    });
  };

  beforeEach(() => {
    accountService = mock<AccountService>();
    autoConfirmService = mock<AutomaticUserConfirmationService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    router = mock<Router>();

    activeAccount$ = new BehaviorSubject<Account | null>(mockAccount);
    accountService.activeAccount$ = activeAccount$;

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AutomaticUserConfirmationService, useValue: autoConfirmService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: Router, useValue: router },
      ],
    });
  });

  it("should allow access when user has permission", async () => {
    autoConfirmService.canManageAutoConfirm$.mockReturnValue(of(true));

    const result = await firstValueFrom(runGuard());

    expect(result).toBe(true);
  });

  it("should redirect to vault when user lacks permission", async () => {
    autoConfirmService.canManageAutoConfirm$.mockReturnValue(of(false));
    const mockUrlTree = {} as UrlTree;
    router.createUrlTree.mockReturnValue(mockUrlTree);

    const result = await firstValueFrom(runGuard());

    expect(result).toBe(mockUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/tabs/vault"]);
  });

  it("should not emit when active account is null", async () => {
    activeAccount$.next(null);
    autoConfirmService.canManageAutoConfirm$.mockReturnValue(of(true));

    let guardEmitted = false;
    const subscription = runGuard().subscribe(() => {
      guardEmitted = true;
    });

    expect(guardEmitted).toBe(false);
    subscription.unsubscribe();
  });
});
