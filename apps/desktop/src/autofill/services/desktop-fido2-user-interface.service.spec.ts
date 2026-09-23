import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { Fido2AuthenticatorErrorCode } from "@bitwarden/common/platform/abstractions/fido2/fido2-authenticator.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { CipherListView } from "@bitwarden/sdk-internal";
import { PasswordRepromptService } from "@bitwarden/vault";

import { ModalModeState } from "../../platform/models/domain/window-state";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

import { DesktopFido2UserInterfaceSession } from "./desktop-fido2-user-interface.service";
import {
  DesktopFido2UserVerificationService,
  UserVerificationCanceled,
} from "./desktop-fido2-user-verification.service.abstraction";

/** Resolves after all pending microtasks so in-flight subscriptions are set up. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Reason produced by `AbortSignal.timeout`. */
const timeoutReason = () => new DOMException("The operation timed out.", "TimeoutError");

/** A cipher protected by a master-password reprompt. */
const repromptCipher = (id: string) =>
  Object.assign(new CipherView(), { id, reprompt: CipherRepromptType.Password });

/** A login the new passkey could be added to: matches the RP and holds no passkeys. */
const matchingLogin = () =>
  Object.assign(new CipherView(), {
    type: CipherType.Login,
    login: Object.assign(new LoginView(), { matchesUri: () => true, fido2Credentials: [] }),
  });

/** The user handle for the ceremony, matching `windowObject.userHandle` below. */
const userHandle = Fido2Utils.arrayToString(new Uint8Array([1, 2, 3]));

/**
 * A login whose URI does NOT match the RP but that already holds a passkey for
 * this RP and user handle — reached only through the existing-passkey rpId match.
 */
const rpIdMatchLogin = () =>
  Object.assign(new CipherView(), {
    type: CipherType.Login,
    login: Object.assign(new LoginView(), {
      matchesUri: () => false,
      fido2Credentials: [
        Object.assign(new Fido2CredentialView(), { rpId: "example.com", userHandle }),
      ],
    }),
  });

describe("DesktopFido2UserInterfaceSession", () => {
  let authService: MockProxy<AuthService>;
  let cipherService: MockProxy<CipherService>;
  let accountService: MockProxy<AccountService>;
  let logService: MockProxy<LogService>;
  let router: MockProxy<Router>;
  let desktopSettingsService: MockProxy<DesktopSettingsService>;
  let userVerificationService: MockProxy<DesktopFido2UserVerificationService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let domainSettingsService: MockProxy<DomainSettingsService>;

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
    userVerificationService = mock<DesktopFido2UserVerificationService>();

    passwordRepromptService = mock<PasswordRepromptService>();
    passwordRepromptService.enabled.mockResolvedValue(true);

    domainSettingsService = mock<DomainSettingsService>();
    domainSettingsService.getUrlEquivalentDomains.mockReturnValue(of(new Set<string>()));

    activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    authService.activeAccountStatus$ = activeAccountStatus$;
    accountService.activeAccount$ = new BehaviorSubject({ id: "user-1" } as any);

    // The assertion flow reads the vault through `cipherListViews$`; default to
    // empty. Tests that need the ceremony to find one stub this with the cipher
    // they expect it to retrieve.
    cipherService.cipherListViews$.mockReturnValue(of([]));
    // The registration flow reads the vault through `getAllDecrypted` to decide
    // whether to show the picker. Default to a login the new passkey could be
    // added to, so the picker is shown unless a test opts out with an empty vault.
    cipherService.getAllDecrypted.mockResolvedValue([matchingLogin()]);

    desktopSettingsService.modalMode$ = new BehaviorSubject<ModalModeState>({
      isModalModeActive: false,
    });
    desktopSettingsService.setModalMode.mockImplementation(
      async (isActive, _showTrafficButtons, _modalPosition) => {
        desktopSettingsService.modalMode$.next({ isModalModeActive: isActive });
      },
    );

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
      {
        rpId: "example.com",
        requestContext: "request-context",
        windowXy: { x: 0, y: 0 },
        appWindowHandle: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        clientWindowHandle: new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]),
        userHandle: [1, 2, 3],
      },
      userVerificationService,
      passwordRepromptService,
      domainSettingsService,
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

    it("returns the single cipher without showing UI when user presence is assumed and user verification is not required", async () => {
      await expect(
        session.pickCredential({
          cipherIds: ["cipher-1"],
          userVerification: false,
          assumeUserPresence: true,
          masterPasswordRepromptRequired: false,
        }),
      ).resolves.toEqual({ cipherId: "cipher-1", userVerified: false });

      expect(desktopSettingsService.setModalMode).not.toHaveBeenCalledWith(
        true,
        expect.anything(),
        expect.anything(),
      );
    });

    it("leaves the window the user already had open alone when no prompt was needed", async () => {
      await session.pickCredential({
        cipherIds: ["cipher-1"],
        userVerification: false,
        assumeUserPresence: true,
        masterPasswordRepromptRequired: false,
      });

      expect(router.navigate).not.toHaveBeenCalled();
      expect(accountService.setShowHeader).not.toHaveBeenCalled();
    });

    it("leaves the window the user already had open alone when only the OS prompt was shown", async () => {
      // The lone credential is verified through the OS, so the ceremony finishes
      // without routing to any of our own UI.
      cipherService.cipherListViews$.mockReturnValue(
        of([Object.assign(new CipherView(), { id: "cipher-1" })] as unknown as CipherListView[]),
      );
      userVerificationService.verify.mockResolvedValue(true);

      await expect(
        session.pickCredential({
          cipherIds: ["cipher-1"],
          userVerification: true,
          assumeUserPresence: false,
          masterPasswordRepromptRequired: false,
        }),
      ).resolves.toEqual({ cipherId: "cipher-1", userVerified: true });

      expect(router.navigate).not.toHaveBeenCalled();
      expect(accountService.setShowHeader).not.toHaveBeenCalled();
    });

    it("returns to the standard UI once the ceremony that showed it finishes", async () => {
      const result = session.pickCredential(params);
      await tick();

      session.confirmChosenCipher(Object.assign(new CipherView(), { id: "cipher-2" }));
      await result;

      expect(desktopSettingsService.setModalMode).toHaveBeenCalledWith(false);
      expect(accountService.setShowHeader).toHaveBeenCalledWith(true);
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("resolves with the cipher the user selects, verified through the OS", async () => {
      userVerificationService.verify.mockResolvedValue(true);

      const result = session.pickCredential(params);
      await tick();

      session.confirmChosenCipher(Object.assign(new CipherView(), { id: "cipher-2" }));

      await expect(result).resolves.toEqual({ cipherId: "cipher-2", userVerified: true });
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
      userVerificationService.verify.mockResolvedValue(true);

      const result = session.confirmNewCredential(params);
      await tick();

      session.notifyConfirmCreateCredential(true, existing);

      await expect(result).resolves.toEqual({ cipherId: "cipher-1", userVerified: true });
      expect(cipherService.updateWithServer).toHaveBeenCalledWith(existing, userId);
    });

    it("neither creates nor updates a cipher when user verification is required but not given", async () => {
      accountService.activeAccount$ = new BehaviorSubject({ id: "user-1" } as any);
      const existing = new CipherView();
      existing.id = "cipher-1";
      userVerificationService.verify.mockResolvedValue(false);

      const result = session.confirmNewCredential(params);
      await tick();

      session.notifyConfirmCreateCredential(true, existing);

      await expect(result).resolves.toEqual({ cipherId: undefined, userVerified: false });
      expect(cipherService.updateWithServer).not.toHaveBeenCalled();
      expect(cipherService.createWithServer).not.toHaveBeenCalled();
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

    it("shows the picker when a login the passkey could be added to exists", async () => {
      // `getAllDecrypted` defaults to a matching login.
      userVerificationService.verify.mockResolvedValue(true);

      const result = session.confirmNewCredential(params);
      await tick();

      expect(router.navigate).toHaveBeenCalledWith([
        "/fido2-creation",
        { "disable-redirect": null },
      ]);

      session.notifyConfirmCreateCredential(true, Object.assign(new CipherView(), { id: "c1" }));
      await result;
    });

    it("shows the picker when a login already holds a passkey for this RP", async () => {
      // URI doesn't match; the login is reached only via the existing-passkey rpId match.
      cipherService.getAllDecrypted.mockResolvedValue([rpIdMatchLogin()]);
      userVerificationService.verify.mockResolvedValue(true);

      const result = session.confirmNewCredential(params);
      await tick();

      expect(router.navigate).toHaveBeenCalledWith([
        "/fido2-creation",
        { "disable-redirect": null },
      ]);

      session.notifyConfirmCreateCredential(true, Object.assign(new CipherView(), { id: "c1" }));
      await result;
    });

    describe("when there is no login to add the passkey to", () => {
      beforeEach(() => {
        cipherService.getAllDecrypted.mockResolvedValue([]);
        cipherService.createWithServer.mockResolvedValue({} as any);
        cipherService.encrypt.mockResolvedValue({ cipher: { id: "new-cipher" } } as any);
      });

      it("skips the picker and creates the credential after user verification", async () => {
        userVerificationService.verify.mockResolvedValue(true);

        const result = await session.confirmNewCredential(params);

        expect(result).toEqual({ cipherId: "new-cipher", userVerified: true });
        expect(userVerificationService.verify).toHaveBeenCalled();
        expect(cipherService.createWithServer).toHaveBeenCalled();
        // The picker UI is never shown.
        expect(router.navigate).not.toHaveBeenCalled();
      });

      it("skips the picker and creates the credential even when verification is not required", async () => {
        const result = await session.confirmNewCredential({ ...params, userVerification: false });

        expect(result).toEqual({ cipherId: "new-cipher", userVerified: false });
        expect(userVerificationService.verify).not.toHaveBeenCalled();
        expect(cipherService.createWithServer).toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
      });

      it("creates nothing when required verification fails", async () => {
        userVerificationService.verify.mockResolvedValue(false);

        const result = await session.confirmNewCredential(params);

        expect(result).toEqual({ cipherId: undefined, userVerified: false });
        expect(cipherService.createWithServer).not.toHaveBeenCalled();
      });
    });
  });

  describe("getMatchingLogins", () => {
    it("includes a login whose URI matches the relying party", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([matchingLogin()]);

      await expect(session.getMatchingLogins()).resolves.toHaveLength(1);
    });

    it("includes a login that already holds a passkey for the RP even when its URI doesn't match", async () => {
      const login = rpIdMatchLogin();
      cipherService.getAllDecrypted.mockResolvedValue([login]);

      await expect(session.getMatchingLogins()).resolves.toEqual([login]);
    });

    it("excludes a login whose only passkey belongs to a different user handle", async () => {
      const login = Object.assign(new CipherView(), {
        type: CipherType.Login,
        login: Object.assign(new LoginView(), {
          matchesUri: () => true,
          fido2Credentials: [
            Object.assign(new Fido2CredentialView(), {
              rpId: "example.com",
              userHandle: "someone-else",
            }),
          ],
        }),
      });
      cipherService.getAllDecrypted.mockResolvedValue([login]);

      await expect(session.getMatchingLogins()).resolves.toEqual([]);
    });

    it("excludes deleted logins", async () => {
      const login = matchingLogin();
      login.deletedDate = new Date();
      cipherService.getAllDecrypted.mockResolvedValue([login]);

      await expect(session.getMatchingLogins()).resolves.toEqual([]);
    });

    it("computes the list once and caches it across calls", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([matchingLogin()]);

      await session.getMatchingLogins();
      await session.getMatchingLogins();

      expect(cipherService.getAllDecrypted).toHaveBeenCalledTimes(1);
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
      // Nothing of ours was on screen, so the user's own window keeps its route.
      expect(router.navigate).not.toHaveBeenCalled();
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

  describe("informExcludedCredential", () => {
    it("shows the excluded credentials UI and returns without waiting for the user", async () => {
      await session.informExcludedCredential(["cipher-1"]);

      expect(desktopSettingsService.setModalMode).toHaveBeenCalledWith(true, false, {
        x: 0,
        y: 0,
      });
      expect(accountService.setShowHeader).toHaveBeenCalledWith(false);
      expect(router.navigate).toHaveBeenCalledWith([
        "/fido2-excluded",
        { "disable-redirect": null },
      ]);
    });

    it("resets the window when the component displaying the message hides the UI", async () => {
      await session.informExcludedCredential(["cipher-1"]);
      await session.hideUi();

      expect(desktopSettingsService.setModalMode).toHaveBeenCalledWith(false);
      expect(accountService.setShowHeader).toHaveBeenCalledWith(true);
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });
  });

  describe("user verification", () => {
    const singleCipherId = "cipher-1";

    const confirmNewCredentialParams = {
      credentialName: "Example",
      userName: "user@example.com",
      userHandle: "handle",
      userVerification: true,
      rpId: "example.com",
    };

    /** Picks from a list long enough to require the picker UI. */
    const pickCredentialFromList = () =>
      session.pickCredential({
        cipherIds: [singleCipherId, "cipher-2"],
        userVerification: true,
        assumeUserPresence: false,
        masterPasswordRepromptRequired: true,
      });

    /** Makes `singleCipherId` the only credential in the vault. */
    const stubSingleCipher = () => {
      const cipher = new CipherView();
      cipher.id = singleCipherId;
      cipherService.cipherListViews$.mockReturnValue(of([cipher] as unknown as CipherListView[]));
    };

    describe("assertion", () => {
      /** Picks the lone credential, which needs no picker UI. */
      const pickSingleCredential = () =>
        session.pickCredential({
          cipherIds: [singleCipherId],
          userVerification: true,
          assumeUserPresence: false,
          masterPasswordRepromptRequired: false,
        });

      it("returns the single cipher as verified when the OS verifies the user, without showing UI", async () => {
        stubSingleCipher();
        userVerificationService.verify.mockResolvedValue(true);

        await expect(pickSingleCredential()).resolves.toEqual({
          cipherId: singleCipherId,
          userVerified: true,
        });
        expect(desktopSettingsService.setModalMode).not.toHaveBeenCalledWith(
          true,
          expect.anything(),
          expect.anything(),
        );
      });

      it("still verifies through the OS when user presence is assumed but verification is required", async () => {
        stubSingleCipher();
        userVerificationService.verify.mockResolvedValue(true);

        await expect(
          session.pickCredential({
            cipherIds: [singleCipherId],
            userVerification: true,
            assumeUserPresence: true,
            masterPasswordRepromptRequired: false,
          }),
        ).resolves.toEqual({ cipherId: singleCipherId, userVerified: true });

        expect(userVerificationService.verify).toHaveBeenCalled();
      });

      it("attaches the prompt to the client window while our own UI is hidden", async () => {
        stubSingleCipher();
        userVerificationService.verify.mockResolvedValue(true);

        await pickSingleCredential();

        expect(userVerificationService.verify).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: "assertion",
            rpId: "example.com",
            requestContext: "request-context",
            windowHandle: new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]),
          }),
          expect.anything(),
        );
      });

      it("rejects the ceremony as NotAllowed when the user dismisses the silent prompt", async () => {
        stubSingleCipher();
        userVerificationService.verify.mockRejectedValue(new UserVerificationCanceled());

        await expect(pickSingleCredential()).rejects.toMatchObject({
          errorCode: Fido2AuthenticatorErrorCode.NotAllowed,
        });
      });

      it("falls back to the picker when silent verification fails for a recoverable reason", async () => {
        stubSingleCipher();
        userVerificationService.verify.mockRejectedValueOnce(new Error("no biometrics enrolled"));
        userVerificationService.verify.mockResolvedValue(true);

        const result = pickSingleCredential();
        await tick();
        session.confirmChosenCipher(Object.assign(new CipherView(), { id: singleCipherId }));

        await expect(result).resolves.toEqual({
          cipherId: singleCipherId,
          userVerified: true,
        });
        expect(desktopSettingsService.setModalMode).toHaveBeenCalledWith(
          true,
          expect.anything(),
          expect.anything(),
        );
      });

      it("does not prompt when the user unlocked their vault during this assertion ceremony", async () => {
        stubSingleCipher();
        activeAccountStatus$.next(AuthenticationStatus.Locked);

        const unlocked = session.ensureUnlockedVault();
        await tick();
        activeAccountStatus$.next(AuthenticationStatus.Unlocked);
        await unlocked;

        await expect(pickSingleCredential()).resolves.toEqual({
          cipherId: singleCipherId,
          userVerified: true,
        });
        expect(userVerificationService.verify).not.toHaveBeenCalled();
      });
    });

    describe("registration", () => {
      it("attaches the prompt to the Bitwarden window while our own UI is showing", async () => {
        userVerificationService.verify.mockResolvedValue(true);

        const result = session.confirmNewCredential(confirmNewCredentialParams);
        await tick();
        session.notifyConfirmCreateCredential(true, Object.assign(new CipherView(), { id: "c1" }));
        await result;

        expect(userVerificationService.verify).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: "overwrite",
            rpId: "example.com",
            requestContext: "request-context",
            windowHandle: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
          }),
          expect.anything(),
        );
      });

      it("rejects credential creation as NotAllowed when the user dismisses the prompt", async () => {
        userVerificationService.verify.mockRejectedValue(new UserVerificationCanceled());

        const result = session.confirmNewCredential(confirmNewCredentialParams);
        await tick();
        session.notifyConfirmCreateCredential(true, Object.assign(new CipherView(), { id: "c1" }));

        await expect(result).rejects.toMatchObject({
          errorCode: Fido2AuthenticatorErrorCode.NotAllowed,
        });
      });

      it("does not prompt when the relying party did not ask for verification", async () => {
        const result = session.confirmNewCredential({
          ...confirmNewCredentialParams,
          userVerification: false,
        });
        await tick();
        session.notifyConfirmCreateCredential(true, Object.assign(new CipherView(), { id: "c1" }));

        await expect(result).resolves.toEqual({ cipherId: "c1", userVerified: false });
        expect(userVerificationService.verify).not.toHaveBeenCalled();
      });

      it("does not prompt when the user unlocked their vault during this registration ceremony", async () => {
        activeAccountStatus$.next(AuthenticationStatus.Locked);

        const unlocked = session.ensureUnlockedVault();
        await tick();
        activeAccountStatus$.next(AuthenticationStatus.Unlocked);
        await unlocked;

        const result = session.confirmNewCredential(confirmNewCredentialParams);
        await tick();
        session.notifyConfirmCreateCredential(true, Object.assign(new CipherView(), { id: "c1" }));

        await expect(result).resolves.toEqual({ cipherId: "c1", userVerified: true });
        expect(userVerificationService.verify).not.toHaveBeenCalled();
      });
    });

    describe("master password reprompt", () => {
      it("verifies a reprompt-protected cipher via master-password reprompt during assertion", async () => {
        passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);

        const result = pickCredentialFromList();
        await tick();
        session.confirmChosenCipher(repromptCipher(singleCipherId));

        await expect(result).resolves.toEqual({ cipherId: singleCipherId, userVerified: true });
        expect(passwordRepromptService.showPasswordPrompt).toHaveBeenCalled();
        expect(userVerificationService.verify).not.toHaveBeenCalled();
      });

      it("verifies a reprompt-protected cipher via master-password reprompt during creation", async () => {
        passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);
        const existing = repromptCipher(singleCipherId);

        const result = session.confirmNewCredential({
          ...confirmNewCredentialParams,
          userVerification: false,
        });
        await tick();
        session.notifyConfirmCreateCredential(true, existing);

        await expect(result).resolves.toEqual({ cipherId: singleCipherId, userVerified: true });
        expect(passwordRepromptService.showPasswordPrompt).toHaveBeenCalled();
        expect(userVerificationService.verify).not.toHaveBeenCalled();
        expect(cipherService.updateWithServer).toHaveBeenCalledWith(existing, "user-1");
      });

      it("rejects the assertion as NotAllowed when the master-password reprompt is dismissed", async () => {
        passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

        const result = pickCredentialFromList();
        await tick();
        session.confirmChosenCipher(repromptCipher(singleCipherId));

        await expect(result).rejects.toMatchObject({
          errorCode: Fido2AuthenticatorErrorCode.NotAllowed,
        });
        expect(userVerificationService.verify).not.toHaveBeenCalled();
      });

      it("ignores the reprompt flag and verifies through the OS during assertion when the account has no master password", async () => {
        passwordRepromptService.enabled.mockResolvedValue(false);
        userVerificationService.verify.mockResolvedValue(true);

        const result = pickCredentialFromList();
        await tick();
        session.confirmChosenCipher(repromptCipher(singleCipherId));

        await expect(result).resolves.toEqual({ cipherId: singleCipherId, userVerified: true });
        expect(passwordRepromptService.showPasswordPrompt).not.toHaveBeenCalled();
        expect(userVerificationService.verify).toHaveBeenCalled();
      });

      it("skips the master-password reprompt during creation when the account has no master password", async () => {
        passwordRepromptService.enabled.mockResolvedValue(false);
        userVerificationService.verify.mockResolvedValue(true);

        const result = session.confirmNewCredential(confirmNewCredentialParams);
        await tick();
        session.notifyConfirmCreateCredential(true, repromptCipher(singleCipherId));
        await result;

        expect(passwordRepromptService.showPasswordPrompt).not.toHaveBeenCalled();
      });

      it("refuses the ceremony when the cipher uses an unrecognized reprompt type", async () => {
        const result = pickCredentialFromList();
        await tick();
        session.confirmChosenCipher(
          Object.assign(new CipherView(), { id: singleCipherId, reprompt: 99 }),
        );

        await expect(result).rejects.toMatchObject({
          errorCode: Fido2AuthenticatorErrorCode.NotAllowed,
        });
        expect(passwordRepromptService.showPasswordPrompt).not.toHaveBeenCalled();
        expect(userVerificationService.verify).not.toHaveBeenCalled();
      });
    });
  });
});
