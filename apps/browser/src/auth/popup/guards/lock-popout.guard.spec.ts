import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from "@angular/router";
import { mock } from "jest-mock-extended";
import { Subject, firstValueFrom, of } from "rxjs";

import { lockGuard } from "@bitwarden/angular/auth/guards/lock.guard";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService, KeyService } from "@bitwarden/key-management";
import { WebAuthnPrfUnlockService } from "@bitwarden/key-management-ui";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

import { lockPopoutGuard } from "./lock-popout.guard";

@Component({ template: "", changeDetection: ChangeDetectionStrategy.OnPush })
class EmptyComponent {}

describe("lockPopoutGuard", () => {
  const userId = "test-user" as UserId;
  const accountService = mock<AccountService>();
  const authService = mock<AuthService>();
  const biometricsService = mock<BiometricsService>();
  const webAuthnPrfUnlockService = mock<WebAuthnPrfUnlockService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const keyService = mock<KeyService>();
  const keyConnectorService = mock<KeyConnectorService>();
  const deviceTrustService = mock<DeviceTrustServiceAbstraction>();
  const userVerificationService = mock<UserVerificationService>();
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: "/lock?from=login-initiated" } as RouterStateSnapshot;

  beforeEach(() => {
    jest.resetAllMocks();
    accountService.activeAccount$ = of({ id: userId, ...mockAccountInfoWith() });
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));
    vaultTimeoutSettingsService.canLock.mockResolvedValue(true);
    keyService.everHadUserKey$.mockReturnValue(of(true));
    keyConnectorService.requiresDomainConfirmation$.mockReturnValue(of(null));
    deviceTrustService.supportsDeviceTrust$ = of(false);
    webAuthnPrfUnlockService.isPrfUnlockAvailable.mockResolvedValue(true);
    jest.spyOn(BrowserApi, "getPlatformInfo").mockResolvedValue({
      os: "linux",
      arch: "x86-64",
      nacl_arch: "x86-64",
    });
    jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);
    jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(false);
    jest.spyOn(BrowserPopupUtils, "openPopout").mockResolvedValue(undefined);
    jest.spyOn(BrowserApi, "closePopup").mockImplementation();
    biometricsService.getShouldAutopromptNow.mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: "", component: EmptyComponent },
          {
            path: "lock",
            canActivate: [lockGuard()],
            children: [{ path: "", canActivate: [lockPopoutGuard], component: EmptyComponent }],
          },
        ]),
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: BiometricsService, useValue: biometricsService },
        { provide: WebAuthnPrfUnlockService, useValue: webAuthnPrfUnlockService },
        { provide: VaultTimeoutSettingsService, useValue: vaultTimeoutSettingsService },
        { provide: KeyService, useValue: keyService },
        { provide: KeyConnectorService, useValue: keyConnectorService },
        { provide: DeviceTrustServiceAbstraction, useValue: deviceTrustService },
        { provide: UserVerificationService, useValue: userVerificationService },
      ],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([false, true])("preserves automatic biometric prompting=%s", async (shouldAutoprompt) => {
    biometricsService.getShouldAutopromptNow.mockResolvedValue(shouldAutoprompt);

    const result = await TestBed.runInInjectionContext(() => lockPopoutGuard(route, state));

    expect(result).toBe(false);
    expect(BrowserPopupUtils.openPopout).toHaveBeenCalledWith(
      `popup/index.html#/lock?from=login-initiated&suppressBiometricAutoPrompt=${!shouldAutoprompt}&autoClosePopout=true`,
    );
    expect(BrowserApi.closePopup).toHaveBeenCalledWith(window);
    expect(state.url).toBe("/lock?from=login-initiated");
  });

  it.each(["win", "mac"] as const)("keeps locking in the current window on %s", async (os) => {
    jest.spyOn(BrowserApi, "getPlatformInfo").mockResolvedValue({
      os,
      arch: "x86-64",
      nacl_arch: "x86-64",
    });

    const result = await TestBed.runInInjectionContext(() => lockPopoutGuard(route, state));

    expect(result).toBe(true);
    expect(BrowserPopupUtils.openPopout).not.toHaveBeenCalled();
    expect(BrowserApi.closePopup).not.toHaveBeenCalled();
  });

  it.each([
    [true, false],
    [false, true],
  ])("keeps an existing popout=%s or sidebar=%s", async (inPopout, inSidebar) => {
    jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(inPopout);
    jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(inSidebar);

    const result = await TestBed.runInInjectionContext(() => lockPopoutGuard(route, state));

    expect(result).toBe(true);
    expect(BrowserPopupUtils.openPopout).not.toHaveBeenCalled();
    expect(BrowserApi.closePopup).not.toHaveBeenCalled();
  });

  it("keeps accounts without passkey unlock in the current window", async () => {
    webAuthnPrfUnlockService.isPrfUnlockAvailable.mockResolvedValue(false);

    const router = TestBed.inject(Router);
    await router.navigateByUrl("/lock");

    expect(router.url).toBe("/lock");
    expect(webAuthnPrfUnlockService.isPrfUnlockAvailable).toHaveBeenCalledWith(userId);
    expect(BrowserPopupUtils.openPopout).not.toHaveBeenCalled();
    expect(BrowserApi.closePopup).not.toHaveBeenCalled();
  });

  it("keeps the original window open if creating the popout fails", async () => {
    jest.spyOn(BrowserPopupUtils, "openPopout").mockRejectedValue(new Error("Cannot open popout"));

    await expect(
      TestBed.runInInjectionContext(() => lockPopoutGuard(route, state)),
    ).rejects.toThrow("Cannot open popout");

    expect(BrowserApi.closePopup).not.toHaveBeenCalled();
  });

  describe("parent lock guard", () => {
    it.each([
      ["already unlocked", AuthenticationStatus.Unlocked, true],
      ["logged out", AuthenticationStatus.LoggedOut, true],
      ["not allowed to lock", AuthenticationStatus.Locked, false],
    ] as const)("does not change windows when %s", async (_name, status, canLock) => {
      authService.authStatusFor$.mockReturnValue(of(status));
      vaultTimeoutSettingsService.canLock.mockResolvedValue(canLock);

      const router = TestBed.inject(Router);
      await router.navigateByUrl("/lock");

      expect(router.url).toBe("/");
      expect(webAuthnPrfUnlockService.isPrfUnlockAvailable).not.toHaveBeenCalled();
      expect(BrowserPopupUtils.openPopout).not.toHaveBeenCalled();
      expect(BrowserApi.closePopup).not.toHaveBeenCalled();
    });

    it("redirects without opening a popout when there is no active account", async () => {
      accountService.activeAccount$ = of(null);

      const router = TestBed.inject(Router);
      await router.navigateByUrl("/lock");

      expect(router.url).toBe("/");
      expect(BrowserPopupUtils.openPopout).not.toHaveBeenCalled();
      expect(BrowserApi.closePopup).not.toHaveBeenCalled();
    });

    it("does not open a popout when device trust rejects access to the lock screen", async () => {
      deviceTrustService.supportsDeviceTrust$ = of(true);
      keyService.everHadUserKey$.mockReturnValue(of(false));

      const router = TestBed.inject(Router);
      await router.navigateByUrl("/lock");

      expect(router.url).toBe("/");
      expect(BrowserPopupUtils.openPopout).not.toHaveBeenCalled();
      expect(BrowserApi.closePopup).not.toHaveBeenCalled();
    });

    it("waits for lock access before opening a popout", fakeAsync(() => {
      const canLock = new Subject<boolean>();
      vaultTimeoutSettingsService.canLock.mockReturnValue(firstValueFrom(canLock));

      const router = TestBed.inject(Router);
      void router.navigateByUrl(state.url);
      tick();

      expect(vaultTimeoutSettingsService.canLock).toHaveBeenCalledWith(userId);
      expect(webAuthnPrfUnlockService.isPrfUnlockAvailable).not.toHaveBeenCalled();
      expect(BrowserPopupUtils.openPopout).not.toHaveBeenCalled();
      expect(BrowserApi.closePopup).not.toHaveBeenCalled();

      canLock.next(true);
      tick();

      expect(BrowserPopupUtils.openPopout).toHaveBeenCalledWith(
        "popup/index.html#/lock?from=login-initiated&suppressBiometricAutoPrompt=true&autoClosePopout=true",
      );
      expect(BrowserApi.closePopup).toHaveBeenCalledWith(window);
    }));
  });
});
