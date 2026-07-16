import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Fido2AuthenticatorService as Fido2AuthenticatorServiceAbstraction } from "@bitwarden/common/platform/abstractions/fido2/fido2-authenticator.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { DesktopAutofillService } from "./desktop-autofill.service";
import { NativeWindowObject } from "./desktop-fido2-user-interface.service";

describe("DesktopAutofillService", () => {
  let logService: MockProxy<LogService>;
  let cipherService: MockProxy<CipherService>;
  let configService: MockProxy<ConfigService>;
  let fido2AuthenticatorService: MockProxy<
    Fido2AuthenticatorServiceAbstraction<NativeWindowObject>
  >;
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  let activeAccountStatus$: BehaviorSubject<AuthenticationStatus>;
  let service: DesktopAutofillService;

  beforeEach(() => {
    logService = mock<LogService>();
    cipherService = mock<CipherService>();
    configService = mock<ConfigService>();
    fido2AuthenticatorService = mock<Fido2AuthenticatorServiceAbstraction<NativeWindowObject>>();
    accountService = mock<AccountService>();
    authService = mock<AuthService>();
    platformUtilsService = mock<PlatformUtilsService>();

    activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    authService.activeAccountStatus$ = activeAccountStatus$;

    platformUtilsService.getDevice.mockReturnValue(DeviceType.MacOsDesktop);

    service = new DesktopAutofillService(
      logService,
      cipherService,
      configService,
      fido2AuthenticatorService,
      accountService,
      authService,
      platformUtilsService,
    );
  });

  describe("doLockStatus", () => {
    it("reports unlocked when the active account status is Unlocked", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Unlocked);

      await expect(service.doLockStatus()).resolves.toEqual({ isUnlocked: true });
    });

    it("reports locked when the active account status is Locked", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Locked);

      await expect(service.doLockStatus()).resolves.toEqual({ isUnlocked: false });
    });

    it("reports locked when the active account status is LoggedOut", async () => {
      activeAccountStatus$.next(AuthenticationStatus.LoggedOut);

      await expect(service.doLockStatus()).resolves.toEqual({ isUnlocked: false });
    });
  });
});
