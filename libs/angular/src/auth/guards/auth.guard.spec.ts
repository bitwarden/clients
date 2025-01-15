import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { EmptyComponent } from "@bitwarden/angular/platform/guard/feature-flag.guard.spec";
import {
  Account,
  AccountInfo,
  AccountService,
} from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";

import { authGuard } from "./auth.guard";

describe("AuthGuard", () => {
  const setup = (
    authStatus: AuthenticationStatus,
    forceSetPasswordReason: ForceSetPasswordReason,
    keyConnectorServiceRequiresAccountConversion: boolean = false,
  ) => {
    const authService: MockProxy<AuthService> = mock<AuthService>();
    authService.getAuthStatus.mockResolvedValue(authStatus);
    const messagingService: MockProxy<MessagingService> = mock<MessagingService>();
    const keyConnectorService: MockProxy<KeyConnectorService> = mock<KeyConnectorService>();
    keyConnectorService.getConvertAccountRequired.mockResolvedValue(
      keyConnectorServiceRequiresAccountConversion,
    );
    const accountService: MockProxy<AccountService> = mock<AccountService>();
    const activeAccountSubject = new BehaviorSubject<Account | null>(null);
    accountService.activeAccount$ = activeAccountSubject;
    activeAccountSubject.next(
      Object.assign(
        {
          name: "Test User 1",
          email: "test@email.com",
          emailVerified: true,
        } as AccountInfo,
        { id: "test-id" as UserId },
      ),
    );

    const forceSetPasswordReasonSubject = new BehaviorSubject<ForceSetPasswordReason>(
      forceSetPasswordReason,
    );
    const masterPasswordService: MockProxy<MasterPasswordServiceAbstraction> =
      mock<MasterPasswordServiceAbstraction>();
    masterPasswordService.forceSetPasswordReason$.mockReturnValue(forceSetPasswordReasonSubject);

    const testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "", component: EmptyComponent },
          { path: "guarded-route", component: EmptyComponent, canActivate: [authGuard] },
          { path: "lock", component: EmptyComponent },
          { path: "set-password", component: EmptyComponent },
          { path: "update-temp-password", component: EmptyComponent },
          { path: "remove-password", component: EmptyComponent },
        ]),
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: MessagingService, useValue: messagingService },
        { provide: KeyConnectorService, useValue: keyConnectorService },
        { provide: AccountService, useValue: accountService },
        { provide: MasterPasswordServiceAbstraction, useValue: masterPasswordService },
      ],
    });

    return {
      router: testBed.inject(Router),
    };
  };

  it("should be created", () => {
    const { router } = setup(AuthenticationStatus.LoggedOut, ForceSetPasswordReason.None);
    expect(router).toBeTruthy();
  });

  it("should return allow access to the guarded route when user is logged in & unlocked", async () => {
    const { router } = setup(AuthenticationStatus.Unlocked, ForceSetPasswordReason.None);

    await router.navigate(["guarded-route"]);
    expect(router.url).toBe("/guarded-route");
  });

  it("should redirect to /lock when user is locked", async () => {
    const { router } = setup(AuthenticationStatus.Locked, ForceSetPasswordReason.None);

    await router.navigate(["guarded-route"]);
    expect(router.url).toContain("/lock");
  });

  it("should redirect to / when user is logged out", async () => {
    const { router } = setup(AuthenticationStatus.LoggedOut, ForceSetPasswordReason.None);

    await router.navigate(["guarded-route"]);
    expect(router.url).toBe("/");
  });

  it("should redirect to /remove-password if keyconnector service requires account conversion", async () => {
    const { router } = setup(AuthenticationStatus.Unlocked, ForceSetPasswordReason.None, true);

    await router.navigate(["guarded-route"]);
    expect(router.url).toBe("/remove-password");
  });

  it("should redirect to set-password when user is TDE user without password and has password reset permission", async () => {
    const { router } = setup(
      AuthenticationStatus.Unlocked,
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
    );

    await router.navigate(["guarded-route"]);
    expect(router.url).toContain("/set-password");
  });

  it("should redirect to update-temp-password when user has force set password reason", async () => {
    const { router } = setup(
      AuthenticationStatus.Unlocked,
      ForceSetPasswordReason.AdminForcePasswordReset,
    );

    await router.navigate(["guarded-route"]);
    expect(router.url).toContain("/update-temp-password");
  });

  it("should redirect to update-temp-password when user has weak password", async () => {
    const { router } = setup(
      AuthenticationStatus.Unlocked,
      ForceSetPasswordReason.WeakMasterPassword,
    );

    await router.navigate(["guarded-route"]);
    expect(router.url).toContain("/update-temp-password");
  });

  it("should allow navigation to set-password when the user is unlocked, is a TDE user without password, and has password reset permission", async () => {
    const { router } = setup(
      AuthenticationStatus.Unlocked,
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
    );

    await router.navigate(["/set-password"]);
    expect(router.url).toContain("/set-password");
  });

  it("should allow navigation to update-temp-password when the user is unlocked and has admin force password reset permission", async () => {
    const { router } = setup(
      AuthenticationStatus.Unlocked,
      ForceSetPasswordReason.AdminForcePasswordReset,
    );

    await router.navigate(["/update-temp-password"]);
    expect(router.url).toContain("/update-temp-password");
  });

  it("should allow navigation to update-temp-password when the user is unlocked and has weak password", async () => {
    const { router } = setup(
      AuthenticationStatus.Unlocked,
      ForceSetPasswordReason.WeakMasterPassword,
    );

    await router.navigate(["/update-temp-password"]);
    expect(router.url).toContain("/update-temp-password");
  });

  it("should allow navigation to remove-password when the user is unlocked and has 'none' password reset permission", async () => {
    const { router } = setup(AuthenticationStatus.Unlocked, ForceSetPasswordReason.None);

    await router.navigate(["/remove-password"]);
    expect(router.url).toContain("/remove-password");
  });
});
