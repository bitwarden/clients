import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PasswordRepromptService } from "@bitwarden/vault";

import { ModalModeState } from "../../platform/models/domain/window-state";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

import { AutofillWindowObject, DesktopAutofillUiSession } from "./desktop-autofill-ui.service";

/** Resolves after all pending microtasks so in-flight subscriptions are set up. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Reason produced by `AbortSignal.timeout`. */
const timeoutReason = () => new DOMException("The operation timed out.", "TimeoutError");

describe("DesktopAutofillUiSession", () => {
  let authService: MockProxy<AuthService>;
  let accountService: MockProxy<AccountService>;
  let logService: MockProxy<LogService>;
  let router: MockProxy<Router>;
  let desktopSettingsService: MockProxy<DesktopSettingsService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;

  let activeAccountStatus$: BehaviorSubject<AuthenticationStatus>;
  let abortController: AbortController;
  // Stands in for the deadline `AbortSignal.timeout(...)` would produce, so tests
  // can fire the timeout deterministically instead of waiting real time.
  let deadlineController: AbortController;
  let windowObject: AutofillWindowObject;

  let session: DesktopAutofillUiSession;

  // The desktop test environment runs on jest-environment-jsdom's bundled
  // jsdom@20, which predates the `AbortSignal.timeout`/`AbortSignal.any` statics
  // and `AbortSignal.prototype.throwIfAborted` the service relies on (all present
  // in the Electron/Chromium runtime). Polyfill them for the duration of each
  // test: a controllable `timeout`, a faithful `any` that mirrors the reason of
  // whichever input aborts first, and the standard `throwIfAborted`.
  const originalTimeout = (AbortSignal as any).timeout;
  const originalAny = (AbortSignal as any).any;
  const originalThrowIfAborted = (AbortSignal.prototype as any).throwIfAborted;

  function createSession(): DesktopAutofillUiSession {
    return new DesktopAutofillUiSession(
      authService,
      accountService,
      logService,
      router,
      desktopSettingsService,
      abortController,
      windowObject,
      passwordRepromptService,
    );
  }

  beforeEach(() => {
    authService = mock<AuthService>();
    accountService = mock<AccountService>();
    logService = mock<LogService>();
    router = mock<Router>();
    desktopSettingsService = mock<DesktopSettingsService>();

    passwordRepromptService = mock<PasswordRepromptService>();
    passwordRepromptService.enabled.mockResolvedValue(true);
    passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);

    activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    authService.activeAccountStatus$ = activeAccountStatus$;
    accountService.activeAccount$ = new BehaviorSubject({ id: "user-1" } as any);

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

    windowObject = {
      requestContext: "request-context",
      windowXy: { x: 12, y: 34 },
      appWindowHandle: new Uint8Array([1, 2, 3, 4]),
      clientWindowHandle: new Uint8Array([4, 3, 2, 1]),
    };

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

    session = createSession();
  });

  afterEach(() => {
    (AbortSignal as any).timeout = originalTimeout;
    (AbortSignal as any).any = originalAny;
    if (originalThrowIfAborted === undefined) {
      delete (AbortSignal.prototype as any).throwIfAborted;
    } else {
      (AbortSignal.prototype as any).throwIfAborted = originalThrowIfAborted;
    }
  });

  describe("ensureUnlockedVault", () => {
    it("shows no UI when the vault is already unlocked", async () => {
      await session.ensureUnlockedVault();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(desktopSettingsService.setModalMode).not.toHaveBeenCalledWith(
        true,
        expect.anything(),
        expect.anything(),
      );
    });

    it("shows the lock screen and resolves once the vault unlocks", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Locked);

      const result = session.ensureUnlockedVault();
      await tick();

      expect(router.navigate).toHaveBeenCalledWith(["/lock", { "disable-redirect": true }]);

      activeAccountStatus$.next(AuthenticationStatus.Unlocked);
      await expect(result).resolves.toBeUndefined();
    });

    it("throws and clears modal mode when the unlock deadline elapses", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Locked);

      const result = session.ensureUnlockedVault();
      await tick();
      deadlineController.abort(timeoutReason());

      await expect(result).rejects.toThrow("Could not retrieve vault unlock status");
      expect(logService.warning).toHaveBeenCalledWith(
        "Timeout: Vault was not unlocked within the allowed time",
      );
      expect(desktopSettingsService.setModalMode).toHaveBeenLastCalledWith(false);
    });
  });

  describe("hideUi", () => {
    it("leaves a window the user already had open untouched when no UI was shown", async () => {
      await session.hideUi();

      // Modal mode is always cleared so the app can't get stuck in it...
      expect(desktopSettingsService.setModalMode).toHaveBeenCalledWith(false);
      // ...but nothing of ours was on screen, so don't navigate away from theirs.
      expect(router.navigate).not.toHaveBeenCalled();
      expect(accountService.setShowHeader).not.toHaveBeenCalled();
    });

    it("is safe to call more than once", async () => {
      await session.hideUi();

      await expect(session.hideUi()).resolves.toBeUndefined();
    });
  });
});
