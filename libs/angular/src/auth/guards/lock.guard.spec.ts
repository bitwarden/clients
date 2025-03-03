import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { EmptyComponent } from "@bitwarden/angular/platform/guard/feature-flag.guard.spec";
import {
  Account,
  AccountInfo,
  AccountService,
} from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ClientType } from "@bitwarden/common/enums";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { lockGuard } from "./lock.guard";

interface SetupParams {
  authStatus: AuthenticationStatus;
  canLock?: boolean;
  isLegacyUser?: boolean;
  clientType?: ClientType;
  everHadUserKey?: boolean;
  supportsDeviceTrust?: boolean;
  hasMasterPassword?: boolean;
}

describe("lockGuard", () => {
  const setup = (setupParams: SetupParams) => {
    const authService: MockProxy<AuthService> = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(setupParams.authStatus));

    const vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService> =
      mock<VaultTimeoutSettingsService>();
    vaultTimeoutSettingsService.canLock.mockResolvedValue(setupParams.canLock);

    const keyService: MockProxy<KeyService> = mock<KeyService>();
    keyService.isLegacyUser.mockResolvedValue(setupParams.isLegacyUser);
    keyService.everHadUserKey$ = of(setupParams.everHadUserKey);

    const platformUtilService: MockProxy<PlatformUtilsService> = mock<PlatformUtilsService>();
    platformUtilService.getClientType.mockReturnValue(setupParams.clientType);

    const messagingService: MockProxy<MessagingService> = mock<MessagingService>();

    const deviceTrustService: MockProxy<DeviceTrustServiceAbstraction> =
      mock<DeviceTrustServiceAbstraction>();
    deviceTrustService.supportsDeviceTrust$ = of(setupParams.supportsDeviceTrust);

    const userVerificationService: MockProxy<UserVerificationService> =
      mock<UserVerificationService>();
    userVerificationService.hasMasterPassword.mockResolvedValue(setupParams.hasMasterPassword);

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

    const testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "", component: EmptyComponent },
          { path: "lock", component: EmptyComponent, canActivate: [lockGuard()] },
          { path: "non-lock-route", component: EmptyComponent },
          { path: "migrate-legacy-encryption", component: EmptyComponent },
        ]),
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: MessagingService, useValue: messagingService },
        { provide: AccountService, useValue: accountService },
        { provide: VaultTimeoutSettingsService, useValue: vaultTimeoutSettingsService },
        { provide: KeyService, useValue: keyService },
        { provide: PlatformUtilsService, useValue: platformUtilService },
        { provide: DeviceTrustServiceAbstraction, useValue: deviceTrustService },
        { provide: UserVerificationService, useValue: userVerificationService },
      ],
    });

    return {
      router: testBed.inject(Router),
      messagingService,
    };
  };

  it("should be created", () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.Locked,
    });
    expect(router).toBeTruthy();
  });

  it("should redirect to the root route when the user is Unlocked", async () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.Unlocked,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/");
  });

  it("should redirect to the root route when the user is LoggedOut", async () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.LoggedOut,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/");
  });

  it("should allow navigation to the lock route when the user is Locked and they can lock", async () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.Locked,
      canLock: true,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/lock");
  });

  it("should allow navigation to the lock route when the user is locked, they can lock, and device trust is not supported", async () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.Locked,
      canLock: true,
      supportsDeviceTrust: false,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/lock");
  });

  it("should not allow navigation to the lock route when canLock is false", async () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.Locked,
      canLock: false,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/");
  });

  it("should log user out if they are a legacy user on a desktop client", async () => {
    const { router, messagingService } = setup({
      authStatus: AuthenticationStatus.Locked,
      canLock: true,
      isLegacyUser: true,
      clientType: ClientType.Desktop,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/");
    expect(messagingService.send).toHaveBeenCalledWith("logout");
  });

  it("should log user out if they are a legacy user on a browser extension client", async () => {
    const { router, messagingService } = setup({
      authStatus: AuthenticationStatus.Locked,
      canLock: true,
      isLegacyUser: true,
      clientType: ClientType.Browser,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/");
    expect(messagingService.send).toHaveBeenCalledWith("logout");
  });

  it("should send the user to migrate-legacy-encryption if they are a legacy user on a web client", async () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.Locked,
      canLock: true,
      isLegacyUser: true,
      clientType: ClientType.Web,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/migrate-legacy-encryption");
  });

  it("should allow navigation to the lock route when device trust is supported, the user has a MP, and the user is coming from the login-initiated page", async () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.Locked,
      canLock: true,
      isLegacyUser: false,
      clientType: ClientType.Web,
      everHadUserKey: false,
      supportsDeviceTrust: true,
      hasMasterPassword: true,
    });

    await router.navigate(["lock"], { queryParams: { from: "login-initiated" } });
    expect(router.url).toBe("/lock?from=login-initiated");
  });

  it("should allow navigation to the lock route when TDE is disabled, the user doesn't have a MP, and the user has had a user key", async () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.Locked,
      canLock: true,
      supportsDeviceTrust: false,
      hasMasterPassword: false,
      everHadUserKey: true,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/lock");
  });

  it("should not allow navigation to the lock route when device trust is supported and the user has not ever had a user key", async () => {
    const { router } = setup({
      authStatus: AuthenticationStatus.Locked,
      canLock: true,
      isLegacyUser: false,
      clientType: ClientType.Web,
      everHadUserKey: false,
      supportsDeviceTrust: true,
      hasMasterPassword: false,
    });

    await router.navigate(["lock"]);
    expect(router.url).toBe("/");
  });
});
