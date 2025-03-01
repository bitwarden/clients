import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { EmptyComponent } from "@bitwarden/angular/platform/guard/feature-flag.guard.spec";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { unauthGuardFn } from "./unauth.guard";

describe("UnauthGuard", () => {
  const activeUser: Account = {
    id: "fake_user_id" as UserId,
    email: "test@email.com",
    emailVerified: true,
    name: "Test User",
  };

  const setup = (
    activeUser: Account | null,
    authStatus: AuthenticationStatus | null = null,
    tdeEnabled: boolean = false,
    everHadUserKey: boolean = false,
  ) => {
    const accountService: MockProxy<AccountService> = mock<AccountService>();
    const authService: MockProxy<AuthService> = mock<AuthService>();
    const keyService: MockProxy<KeyService> = mock<KeyService>();
    const deviceTrustService: MockProxy<DeviceTrustServiceAbstraction> =
      mock<DeviceTrustServiceAbstraction>();
    const logService: MockProxy<LogService> = mock<LogService>();

    accountService.activeAccount$ = new BehaviorSubject<Account | null>(activeUser);

    if (authStatus !== null) {
      const activeAccountStatusObservable = new BehaviorSubject<AuthenticationStatus>(authStatus);
      authService.authStatusFor$.mockReturnValue(activeAccountStatusObservable);
    }

    keyService.everHadUserKey$ = new BehaviorSubject<boolean>(everHadUserKey);
    deviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(
      new BehaviorSubject<boolean>(tdeEnabled),
    );

    const testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "", component: EmptyComponent },
          {
            path: "unauth-guarded-route",
            component: EmptyComponent,
            canActivate: [unauthGuardFn()],
          },
          { path: "vault", component: EmptyComponent },
          { path: "lock", component: EmptyComponent },
          { path: "testhomepage", component: EmptyComponent },
          { path: "testlocked", component: EmptyComponent },
          { path: "login-initiated", component: EmptyComponent },
          {
            path: "testOverrides",
            component: EmptyComponent,
            canActivate: [
              unauthGuardFn({ homepage: () => "/testhomepage", locked: "/testlocked" }),
            ],
          },
        ]),
      ],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: KeyService, useValue: keyService },
        { provide: DeviceTrustServiceAbstraction, useValue: deviceTrustService },
        { provide: LogService, useValue: logService },
      ],
    });

    return {
      router: testBed.inject(Router),
    };
  };

  it("should be created", () => {
    const { router } = setup(null, AuthenticationStatus.LoggedOut);
    expect(router).toBeTruthy();
  });

  it("should redirect to /vault for guarded routes when logged in and unlocked", async () => {
    const { router } = setup(activeUser, AuthenticationStatus.Unlocked);

    await router.navigateByUrl("unauth-guarded-route");
    expect(router.url).toBe("/vault");
  });

  it("should allow access to guarded routes when account is null", async () => {
    const { router } = setup(null);

    await router.navigateByUrl("unauth-guarded-route");
    expect(router.url).toBe("/unauth-guarded-route");
  });

  it("should allow access to guarded routes when logged out", async () => {
    const { router } = setup(null, AuthenticationStatus.LoggedOut);

    await router.navigateByUrl("unauth-guarded-route");
    expect(router.url).toBe("/unauth-guarded-route");
  });

  it("should redirect to /login-initiated when locked, TDE is enabled, and the user hasn't decrypted yet", async () => {
    const { router } = setup(activeUser, AuthenticationStatus.Locked, true, false);

    await router.navigateByUrl("unauth-guarded-route");
    expect(router.url).toBe("/login-initiated");
  });

  it("should redirect to /lock for guarded routes when locked", async () => {
    const { router } = setup(activeUser, AuthenticationStatus.Locked);

    await router.navigateByUrl("unauth-guarded-route");
    expect(router.url).toBe("/lock");
  });

  it("should redirect to /testhomepage for guarded routes when testOverrides are provided and the account is unlocked", async () => {
    const { router } = setup(activeUser, AuthenticationStatus.Unlocked);

    await router.navigateByUrl("testOverrides");
    expect(router.url).toBe("/testhomepage");
  });

  it("should redirect to /testlocked for guarded routes when testOverrides are provided and the account is locked", async () => {
    const { router } = setup(activeUser, AuthenticationStatus.Locked);

    await router.navigateByUrl("testOverrides");
    expect(router.url).toBe("/testlocked");
  });
});
