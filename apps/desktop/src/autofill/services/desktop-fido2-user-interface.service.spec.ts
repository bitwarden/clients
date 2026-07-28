import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

import { DesktopFido2UserInterfaceSession } from "./desktop-fido2-user-interface.service";

/** Resolves after all pending microtasks so in-flight subscriptions are set up. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Reason produced by `AbortSignal.timeout`. */
const timeoutReason = () => new DOMException("The operation timed out.", "TimeoutError");

describe("DesktopFido2UserInterfaceSession", () => {
  let authService: MockProxy<AuthService>;
  let cipherService: MockProxy<CipherService>;
  let accountService: MockProxy<AccountService>;
  let logService: MockProxy<LogService>;
  let router: MockProxy<Router>;
  let desktopSettingsService: MockProxy<DesktopSettingsService>;

  let activeAccountStatus$: BehaviorSubject<AuthenticationStatus>;
  let abortController: AbortController;
  // Stands in for the deadline `AbortSignal.timeout(...)` would produce, so tests
  // can fire the timeout deterministically instead of waiting real time.
  let deadlineController: AbortController;

  let session: DesktopFido2UserInterfaceSession;

  // The desktop test environment runs on jest-environment-jsdom's bundled
  // jsdom@20, which predates the `AbortSignal.timeout`/`AbortSignal.any` statics
  // and `AbortSignal.prototype.throwIfAborted` the service relies on (all present
  // in the Electron/Chromium runtime). Polyfill them for the duration of each
  // test: a controllable `timeout`, a faithful `any` that mirrors the reason of
  // whichever input aborts first, and the standard `throwIfAborted`.
  const originalTimeout = (AbortSignal as any).timeout;
  const originalAny = (AbortSignal as any).any;
  const originalThrowIfAborted = (AbortSignal.prototype as any).throwIfAborted;

  beforeEach(() => {
    authService = mock<AuthService>();
    cipherService = mock<CipherService>();
    accountService = mock<AccountService>();
    logService = mock<LogService>();
    router = mock<Router>();
    desktopSettingsService = mock<DesktopSettingsService>();

    activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    authService.activeAccountStatus$ = activeAccountStatus$;

    abortController = new AbortController();
    deadlineController = new AbortController();

    (AbortSignal as any).timeout = jest.fn(() => deadlineController.signal);
    (AbortSignal as any).any = (signals: AbortSignal[]) => {
      const combined = new AbortController();
      for (const signal of signals) {
        if (signal.aborted) {
          combined.abort(signal.reason);
          break;
        }
        signal.addEventListener("abort", () => combined.abort(signal.reason), { once: true });
      }
      return combined.signal;
    };
    (AbortSignal.prototype as any).throwIfAborted = function (this: AbortSignal) {
      if (this.aborted) {
        throw this.reason;
      }
    };

    session = new DesktopFido2UserInterfaceSession(
      authService,
      cipherService,
      accountService,
      logService,
      router,
      desktopSettingsService,
      abortController,
      {},
    );
  });

  afterEach(() => {
    (AbortSignal as any).timeout = originalTimeout;
    (AbortSignal as any).any = originalAny;
    if (originalThrowIfAborted === undefined) {
      delete (AbortSignal.prototype as any).throwIfAborted;
    } else {
      (AbortSignal.prototype as any).throwIfAborted = originalThrowIfAborted;
    }
    jest.restoreAllMocks();
  });

  describe("pickCredential", () => {
    const params = {
      cipherIds: ["cipher-1", "cipher-2"],
      userVerification: true,
      assumeUserPresence: false,
      masterPasswordRepromptRequired: false,
    };

    it("returns the single cipher without showing UI when user presence is assumed", async () => {
      await expect(
        session.pickCredential({
          cipherIds: ["cipher-1"],
          userVerification: true,
          assumeUserPresence: true,
          masterPasswordRepromptRequired: false,
        }),
      ).resolves.toEqual({ cipherId: "cipher-1", userVerified: true });

      expect(desktopSettingsService.setModalMode).not.toHaveBeenCalledWith(
        true,
        expect.anything(),
        expect.anything(),
      );
    });

    it("resolves with the cipher the user selects", async () => {
      const result = session.pickCredential(params);
      await tick();

      session.confirmChosenCipher("cipher-2", true);

      await expect(result).resolves.toEqual({ cipherId: "cipher-2", userVerified: true });
    });

    it("resolves to no cipher and logs cancellation when the request is aborted", async () => {
      const result = session.pickCredential(params);
      await tick();

      abortController.abort("Operation cancelled");

      await expect(result).resolves.toEqual({ cipherId: undefined, userVerified: false });
      expect(logService.warning).toHaveBeenCalledWith(
        "Request was cancelled before the user selected a cipher",
        expect.anything(),
      );
    });

    it("resolves to no cipher and logs a timeout (not a cancellation) when the deadline elapses", async () => {
      const result = session.pickCredential(params);
      await tick();

      deadlineController.abort(timeoutReason());

      await expect(result).resolves.toEqual({ cipherId: undefined, userVerified: false });
      expect(logService.warning).toHaveBeenCalledWith(
        "Timeout: User did not select a cipher within the allowed time",
      );
      expect(logService.warning).not.toHaveBeenCalledWith(
        "Request was cancelled before the user selected a cipher",
        expect.anything(),
      );
    });
  });

  describe("confirmNewCredential", () => {
    const params = {
      credentialName: "Example",
      userName: "user@example.com",
      userHandle: "handle",
      userVerification: true,
      rpId: "example.com",
    };

    it("updates and returns the existing cipher when one was provided by the UI", async () => {
      const userId = "user-1";
      accountService.activeAccount$ = new BehaviorSubject({ id: userId } as any);
      const existing = new CipherView();
      existing.id = "cipher-1";

      const result = session.confirmNewCredential(params);
      await tick();

      session.notifyConfirmCreateCredential(true, existing);

      await expect(result).resolves.toEqual({ cipherId: "cipher-1", userVerified: true });
      expect(cipherService.updateWithServer).toHaveBeenCalledWith(existing, userId);
    });

    it("returns no cipher when the user declines", async () => {
      const result = session.confirmNewCredential(params);
      await tick();

      session.notifyConfirmCreateCredential(false);

      await expect(result).resolves.toEqual({ cipherId: undefined, userVerified: false });
    });

    it("returns no cipher and logs cancellation when the request is aborted", async () => {
      const result = session.confirmNewCredential(params);
      await tick();

      abortController.abort("Operation cancelled");

      await expect(result).resolves.toEqual({ cipherId: undefined, userVerified: false });
      expect(logService.warning).toHaveBeenCalledWith(
        "Request was cancelled before the user confirmed a cipher",
      );
    });
  });

  describe("ensureUnlockedVault", () => {
    it("returns without showing the lock UI when the vault is already unlocked", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Unlocked);

      await expect(session.ensureUnlockedVault()).resolves.toBeUndefined();
      expect(desktopSettingsService.setModalMode).not.toHaveBeenCalledWith(
        true,
        expect.anything(),
        expect.anything(),
      );
    });

    it("shows the lock UI, then navigates home once the vault unlocks", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Locked);

      const result = session.ensureUnlockedVault();
      await tick();
      activeAccountStatus$.next(AuthenticationStatus.Unlocked);

      await expect(result).resolves.toBeUndefined();
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("hides the UI and throws, logging cancellation, when aborted before unlock", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Locked);

      const result = session.ensureUnlockedVault();
      await tick();
      abortController.abort("Operation cancelled");

      await expect(result).rejects.toThrow("Could not retrieve vault unlock status");
      expect(logService.warning).toHaveBeenCalledWith(
        "Request was cancelled before the vault was unlocked",
      );
      expect(desktopSettingsService.setModalMode).toHaveBeenCalledWith(false);
    });

    it("does not show the lock UI when already aborted on entry", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Locked);
      abortController.abort("Operation cancelled");

      await expect(session.ensureUnlockedVault()).rejects.toThrow(
        "Could not retrieve vault unlock status",
      );
      expect(desktopSettingsService.setModalMode).not.toHaveBeenCalledWith(
        true,
        expect.anything(),
        expect.anything(),
      );
    });

    it("logs a timeout (not a cancellation) and throws when the unlock deadline elapses", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Locked);

      const result = session.ensureUnlockedVault();
      await tick();
      deadlineController.abort(timeoutReason());

      await expect(result).rejects.toThrow("Could not retrieve vault unlock status");
      expect(logService.warning).toHaveBeenCalledWith(
        "Timeout: Vault was not unlocked within the allowed time",
      );
      expect(logService.warning).not.toHaveBeenCalledWith(
        "Request was cancelled before the vault was unlocked",
      );
    });
  });
});
