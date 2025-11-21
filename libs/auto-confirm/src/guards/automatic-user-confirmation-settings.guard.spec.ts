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
    i18nService.t.mockReturnValue("You do not have permissions to view this page");

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

  describe("when user has permission to manage auto-confirm", () => {
    beforeEach(() => {
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(of(true));
    });

    it("should return true and allow navigation", async () => {
      const result = await firstValueFrom(runGuard());

      expect(result).toBe(true);
    });

    it("should not show error toast", async () => {
      await firstValueFrom(runGuard());

      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("should not redirect to vault", async () => {
      await firstValueFrom(runGuard());

      expect(router.createUrlTree).not.toHaveBeenCalled();
    });

    it("should call canManageAutoConfirm$ with correct user id", async () => {
      await firstValueFrom(runGuard());

      expect(autoConfirmService.canManageAutoConfirm$).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe("when user does not have permission to manage auto-confirm", () => {
    beforeEach(() => {
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(of(false));
    });

    it("should redirect to /tabs/vault", async () => {
      const mockUrlTree = {} as UrlTree;
      router.createUrlTree.mockReturnValue(mockUrlTree);

      const result = await firstValueFrom(runGuard());

      expect(router.createUrlTree).toHaveBeenCalledWith(["/tabs/vault"]);
      expect(result).toBe(mockUrlTree);
    });

    it("should show error toast with correct parameters", async () => {
      router.createUrlTree.mockReturnValue({} as UrlTree);

      await firstValueFrom(runGuard());

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: "You do not have permissions to view this page",
      });
    });

    it("should translate the error message", async () => {
      router.createUrlTree.mockReturnValue({} as UrlTree);

      await firstValueFrom(runGuard());

      expect(i18nService.t).toHaveBeenCalledWith("noPermissionsViewPage");
    });

    it("should show toast before redirecting", async () => {
      const callOrder: string[] = [];
      toastService.showToast.mockImplementation(() => {
        callOrder.push("toast");
      });
      router.createUrlTree.mockImplementation(() => {
        callOrder.push("redirect");
        return {} as UrlTree;
      });

      await firstValueFrom(runGuard());

      expect(callOrder).toEqual(["toast", "redirect"]);
    });
  });

  describe("when active account is null", () => {
    it("should not emit when active account is null", async () => {
      activeAccount$.next(null);
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(of(true));

      let guardEmitted = false;
      const subscription = runGuard().subscribe(() => {
        guardEmitted = true;
      });

      expect(guardEmitted).toBe(false);
      expect(autoConfirmService.canManageAutoConfirm$).not.toHaveBeenCalled();
      subscription.unsubscribe();
    });

    it("should emit when active account changes from null to valid account", async () => {
      activeAccount$.next(null);
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(of(true));

      const results: (boolean | UrlTree)[] = [];
      const subscription = runGuard().subscribe((result) => {
        results.push(result);
      });

      expect(results.length).toBe(0);

      activeAccount$.next(mockAccount);

      expect(results.length).toBe(1);
      expect(results[0]).toBe(true);

      subscription.unsubscribe();
    });
  });

  describe("service integration", () => {
    it("should properly chain observables from accountService to autoConfirmService", async () => {
      const canManageSubject = new BehaviorSubject<boolean>(false);
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(canManageSubject);
      router.createUrlTree.mockReturnValue({} as UrlTree);

      const results: (boolean | UrlTree)[] = [];
      const subscription = runGuard().subscribe((result) => {
        results.push(result);
      });

      expect(results.length).toBeGreaterThan(0);
      expect(autoConfirmService.canManageAutoConfirm$).toHaveBeenCalledWith(mockUserId);

      subscription.unsubscribe();
    });

    it("should react to changes in canManageAutoConfirm$", async () => {
      const canManageSubject = new BehaviorSubject<boolean>(true);
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(canManageSubject);

      const results: (boolean | UrlTree)[] = [];
      const subscription = runGuard().subscribe((result) => {
        results.push(result);
      });

      expect(results[results.length - 1]).toBe(true);

      router.createUrlTree.mockReturnValue({} as UrlTree);
      canManageSubject.next(false);

      expect(results.length).toBeGreaterThan(1);
      expect(toastService.showToast).toHaveBeenCalled();

      subscription.unsubscribe();
    });
  });

  describe("multiple users scenario", () => {
    it("should handle switching between different users", async () => {
      const userId1 = newGuid() as UserId;
      const userId2 = newGuid() as UserId;
      const account1: Account = {
        id: userId1,
        email: "user1@example.com",
        emailVerified: true,
        name: "User 1",
      };
      const account2: Account = {
        id: userId2,
        email: "user2@example.com",
        emailVerified: true,
        name: "User 2",
      };

      // User 1 has permission
      activeAccount$.next(account1);
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(of(true));

      let result = await firstValueFrom(runGuard());

      expect(result).toBe(true);
      expect(autoConfirmService.canManageAutoConfirm$).toHaveBeenCalledWith(userId1);

      // User 2 does not have permission
      activeAccount$.next(account2);
      autoConfirmService.canManageAutoConfirm$.mockReturnValue(of(false));
      router.createUrlTree.mockReturnValue({} as UrlTree);

      result = await firstValueFrom(runGuard());

      expect(result).not.toBe(true);
      expect(autoConfirmService.canManageAutoConfirm$).toHaveBeenCalledWith(userId2);
      expect(toastService.showToast).toHaveBeenCalled();
    });
  });
});
