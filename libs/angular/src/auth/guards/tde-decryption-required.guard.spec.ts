import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { EmptyComponent } from "@bitwarden/angular/platform/guard/feature-flag.guard.spec";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { tdeDecryptionRequiredGuard } from "./tde-decryption-required.guard";

describe("tdeDecryptionRequiredGuard", () => {
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
    const accountService = mock<AccountService>();
    const authService = mock<AuthService>();
    const keyService = mock<KeyService>();
    const deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    const logService = mock<LogService>();

    accountService.activeAccount$ = new BehaviorSubject<Account | null>(activeUser);
    if (authStatus !== null) {
      authService.getAuthStatus.mockResolvedValue(authStatus);
    }
    keyService.everHadUserKey$.mockReturnValue(of(everHadUserKey));
    deviceTrustService.supportsDeviceTrust$ = of(tdeEnabled);

    const testBed = TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: KeyService, useValue: keyService },
        { provide: DeviceTrustServiceAbstraction, useValue: deviceTrustService },
        { provide: LogService, useValue: logService },
        provideRouter([
          { path: "", component: EmptyComponent },
          {
            path: "protected-route",
            component: EmptyComponent,
            canActivate: [tdeDecryptionRequiredGuard()],
          },
        ]),
      ],
    });

    return {
      router: testBed.inject(Router),
    };
  };

  it("redirects to root when the active account is null", async () => {
    const { router } = setup(null, null);
    await router.navigate(["protected-route"]);
    expect(router.url).toBe("/");
  });

  test.each([AuthenticationStatus.Unlocked, AuthenticationStatus.LoggedOut])(
    "redirects to root when the user isn't locked",
    async (authStatus) => {
      const { router } = setup(activeUser, authStatus);

      await router.navigate(["protected-route"]);

      expect(router.url).toBe("/");
    },
  );

  it("redirects to root when TDE is not enabled", async () => {
    const { router } = setup(activeUser, AuthenticationStatus.Locked, false, true);

    await router.navigate(["protected-route"]);

    expect(router.url).toBe("/");
  });

  it("redirects to root when user has had a user key", async () => {
    const { router } = setup(activeUser, AuthenticationStatus.Locked, true, true);

    await router.navigate(["protected-route"]);

    expect(router.url).toBe("/");
  });

  it("allows access when user is locked, TDE is enabled, and user has never had a user key", async () => {
    const { router } = setup(activeUser, AuthenticationStatus.Locked, true, false);

    const result = await router.navigate(["protected-route"]);
    expect(result).toBe(true);
    expect(router.url).toBe("/protected-route");
  });
});
