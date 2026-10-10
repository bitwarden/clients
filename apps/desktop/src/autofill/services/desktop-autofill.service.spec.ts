import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Fido2AuthenticatorService as Fido2AuthenticatorServiceAbstraction } from "@bitwarden/common/platform/abstractions/fido2/fido2-authenticator.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { DesktopAutofillUiService, DesktopAutofillUiSession } from "./desktop-autofill-ui.service";
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
  let totpService: MockProxy<TotpService>;
  let autofillUiService: MockProxy<DesktopAutofillUiService>;
  let autofillUiSession: MockProxy<DesktopAutofillUiSession>;
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
    totpService = mock<TotpService>();
    autofillUiService = mock<DesktopAutofillUiService>();
    autofillUiSession = mock<DesktopAutofillUiSession>();
    autofillUiService.newSession.mockReturnValue(autofillUiSession);
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
      totpService,
      autofillUiService,
      platformUtilsService,
    );
  });

  describe("enabling native autofill", () => {
    let featureFlag$: BehaviorSubject<boolean>;
    let desktopAutofillIpc: {
      setEnabled: jest.Mock;
      getPasskeyProviderState: jest.Mock;
      listenerReady: jest.Mock;
    };

    const registered = { registered: true, enabled: true };
    const unregistered = { registered: false, enabled: false };

    beforeEach(() => {
      featureFlag$ = new BehaviorSubject<boolean>(true);
      configService.getFeatureFlag$.mockReturnValue(featureFlag$);
      configService.getFeatureFlag.mockImplementation(async () => featureFlag$.value);
      accountService.activeAccount$ = new BehaviorSubject(null);

      desktopAutofillIpc = {
        setEnabled: jest.fn().mockResolvedValue(true),
        getPasskeyProviderState: jest.fn().mockResolvedValue(registered),
        listenerReady: jest.fn(),
      };
      // `listenIpc` binds a handler to each `listen*` channel.
      const ipcProxy = new Proxy(desktopAutofillIpc, {
        get: (target, prop: string) => (target as any)[prop] ?? jest.fn(),
      });
      (global as any).ipc = { autofill: { desktopAutofill: ipcProxy } };
    });

    afterEach(() => {
      service.ngOnDestroy();
      delete (global as any).ipc;
    });

    it("does not enable when the feature flag is off", async () => {
      featureFlag$.next(false);

      await expect(service.refreshPasskeyProviderState()).resolves.toEqual(unregistered);
      expect(desktopAutofillIpc.setEnabled).not.toHaveBeenCalled();
    });

    it("does not enable on Linux", async () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.LinuxDesktop);
      service = new DesktopAutofillService(
        logService,
        cipherService,
        configService,
        fido2AuthenticatorService,
        accountService,
        authService,
        totpService,
        autofillUiService,
        platformUtilsService,
      );

      await expect(service.refreshPasskeyProviderState()).resolves.toEqual(unregistered);
      expect(desktopAutofillIpc.setEnabled).not.toHaveBeenCalled();
    });

    it("reports the passkey provider state from the OS", async () => {
      const state = { registered: true, enabled: false };
      desktopAutofillIpc.getPasskeyProviderState.mockResolvedValue(state);

      await expect(service.refreshPasskeyProviderState()).resolves.toEqual(state);
      expect(desktopAutofillIpc.setEnabled).toHaveBeenCalledWith(true);
    });

    it("re-submits registration on every call but only starts listening once", async () => {
      await expect(service.refreshPasskeyProviderState()).resolves.toEqual(registered);
      await expect(service.refreshPasskeyProviderState()).resolves.toEqual(registered);

      expect(desktopAutofillIpc.setEnabled).toHaveBeenCalledTimes(2);
      expect(desktopAutofillIpc.listenerReady).toHaveBeenCalledTimes(1);
    });

    it("does not start listening when the main process fails to enable", async () => {
      desktopAutofillIpc.setEnabled.mockResolvedValue(false);

      await expect(service.refreshPasskeyProviderState()).resolves.toEqual(unregistered);
      expect(desktopAutofillIpc.listenerReady).not.toHaveBeenCalled();
      expect(desktopAutofillIpc.getPasskeyProviderState).not.toHaveBeenCalled();
    });

    it("enables when the feature flag turns on after init", async () => {
      featureFlag$.next(false);
      await service.init();
      expect(desktopAutofillIpc.setEnabled).not.toHaveBeenCalled();

      featureFlag$.next(true);
      await new Promise(process.nextTick);

      expect(desktopAutofillIpc.setEnabled).toHaveBeenCalledWith(true);
      expect(desktopAutofillIpc.listenerReady).toHaveBeenCalledTimes(1);
    });
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

  describe("plain fills", () => {
    /** A request shaped like the one macOS sends for a chosen suggestion. */
    const suggestionRequest = (recordIdentifier: string) => ({
      userName: "user@example.com",
      displayName: undefined,
      serviceIdentifiers: ["example.com"],
      recordIdentifier,
      clientWindow: { position: { x: 1, y: 2 }, handle: undefined },
      context: "ctx-1",
    });

    /** A request shaped like the one macOS sends when the user browses instead. */
    const browseRequest = () => ({
      userName: undefined,
      displayName: undefined,
      serviceIdentifiers: ["m.example.com", "example.com"],
      recordIdentifier: undefined,
      clientWindow: { position: { x: 1, y: 2 }, handle: undefined },
      context: "ctx-1",
    });

    const login = (overrides: Record<string, unknown> = {}) =>
      Object.assign(new CipherView(), {
        id: "cipher-1",
        type: CipherType.Login,
        reprompt: CipherRepromptType.None,
        deletedDate: null,
        login: Object.assign(new LoginView(), {
          username: "user@example.com",
          password: "hunter2",
          totp: "otpauth://totp/example",
          uris: [Object.assign(new LoginUriView(), { uri: "https://example.com" })],
        }),
        ...overrides,
      });

    beforeEach(() => {
      // The window object a ceremony is given includes the app's own window
      // handle, which is fetched over IPC.
      (global as any).ipc = {
        autofill: { desktopAutofill: { getAppWindowHandle: jest.fn().mockResolvedValue(null) } },
      };

      accountService.activeAccount$ = new BehaviorSubject({ id: "user-1" } as any);
      cipherService.cipherView$.mockReturnValue(of(login()));
      cipherService.getAllDecryptedForUrl.mockResolvedValue([login()]);
      totpService.getCode$.mockReturnValue(of({ code: "123456" } as any));
    });

    it("unlocks the vault before reading any credential", async () => {
      await service.doPasswordAutofill(suggestionRequest("cipher-1") as any, new AbortController());

      expect(autofillUiSession.ensureUnlockedVault).toHaveBeenCalled();
    });

    it("fills the suggestion the OS chose without showing a picker", async () => {
      await expect(
        service.doPasswordAutofill(suggestionRequest("cipher-1") as any, new AbortController()),
      ).resolves.toEqual({ username: "user@example.com", password: "hunter2" });

      expect(autofillUiSession.pickCipher).not.toHaveBeenCalled();
    });

    it("shows the password picker over URL-matched logins when the user browses", async () => {
      autofillUiSession.pickCipher.mockResolvedValue(login());

      await expect(
        service.doPasswordAutofill(browseRequest() as any, new AbortController()),
      ).resolves.toEqual({ username: "user@example.com", password: "hunter2" });

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        "https://m.example.com",
        "user-1",
      );
      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        "https://example.com",
        "user-1",
      );
      expect(autofillUiSession.pickCipher).toHaveBeenCalledWith(["cipher-1"], "/password-autofill");
    });

    it("offers the OTP picker only logins that carry a TOTP secret", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        login(),
        login({
          id: "cipher-2",
          login: Object.assign(new LoginView(), { ...login().login, totp: undefined }),
        }),
      ]);
      autofillUiSession.pickCipher.mockResolvedValue(login());

      await expect(
        service.doOtpAutofill(browseRequest() as any, new AbortController()),
      ).resolves.toEqual({ code: "123456" });

      expect(autofillUiSession.pickCipher).toHaveBeenCalledWith(["cipher-1"], "/otp-autofill");
    });

    it("shows the picker for a reprompt-protected suggestion, since its prompt needs a window", async () => {
      cipherService.cipherView$.mockReturnValue(
        of(login({ reprompt: CipherRepromptType.Password })),
      );
      autofillUiSession.pickCipher.mockResolvedValue(login());

      await service.doPasswordAutofill(suggestionRequest("cipher-1") as any, new AbortController());

      expect(autofillUiSession.pickCipher).toHaveBeenCalled();
    });

    it("fails the request when the user picks nothing", async () => {
      autofillUiSession.pickCipher.mockResolvedValue(undefined);

      await expect(
        service.doPasswordAutofill(browseRequest() as any, new AbortController()),
      ).rejects.toThrow("No credential was selected");
    });

    it("closes the session even when the fill fails", async () => {
      autofillUiSession.pickCipher.mockResolvedValue(undefined);

      await expect(
        service.doPasswordAutofill(browseRequest() as any, new AbortController()),
      ).rejects.toThrow();
      expect(autofillUiSession.close).toHaveBeenCalled();
    });

    it("leaves no UI behind when a suggestion fill follows an unlock", async () => {
      // The suggestion path never reaches the picker, so nothing else would tear
      // down the lock screen `ensureUnlockedVault` put on screen.
      await service.doPasswordAutofill(suggestionRequest("cipher-1") as any, new AbortController());

      expect(autofillUiSession.hideUi).toHaveBeenCalled();
    });

    it("gives the session the abort controller, so a cancel reaches the picker", async () => {
      const abortController = new AbortController();
      autofillUiSession.pickCipher.mockResolvedValue(login());

      await service.doPasswordAutofill(browseRequest() as any, abortController);

      expect(autofillUiService.newSession).toHaveBeenCalledWith(
        expect.objectContaining({ requestContext: "ctx-1" }),
        abortController,
      );
    });
  });

  describe("doCancelRequest", () => {
    it("aborts the in-flight request matching the context", async () => {
      const controller = new AbortController();
      (service as any).inFlightRequests["ctx-1"] = controller;

      await service.doCancelRequest("ctx-1");

      expect(controller.signal.aborted).toBe(true);
      expect(controller.signal.reason).toBe("Operation cancelled");
    });

    it("does nothing when the context does not match an in-flight request", async () => {
      await expect(service.doCancelRequest("unknown")).resolves.toBeUndefined();
    });
  });

  describe("makeListener request correlation", () => {
    beforeEach(() => {
      // `makeListener` reads `ipc.autofill.desktopAutofill` to derive a log name.
      (global as any).ipc = { autofill: { desktopAutofill: {} } };
      // Correlation only runs once the feature flag has enabled the service.
      (service as any).isEnabled = true;
    });

    afterEach(() => {
      delete (global as any).ipc;
    });

    // Registers a handler the way `listenIpc` does and returns the listener the
    // autofill IPC server would invoke on an incoming message.
    type CapturedListener<Request> = (
      clientId: number,
      sequenceNumber: number,
      request: Request,
      completeCallback?: (error: Error | null, response: unknown) => void,
    ) => Promise<void>;

    function registerListener<Request>(
      handleFn: (request: Request, abortController: AbortController) => Promise<unknown>,
      deriveTransactionIdFn?: (request: Request) => string,
    ): CapturedListener<Request> {
      let listener!: CapturedListener<Request>;
      const channelBindFn = jest.fn((registered) => (listener = registered));
      service.makeListener(channelBindFn as any, handleFn as any, deriveTransactionIdFn as any);
      return listener;
    }

    it("delivers the abort event to the subscribed handler when the request is cancelled", async () => {
      const context = "txn-3";
      const abortListener = jest.fn();
      let finishHandler!: (response: unknown) => void;
      const handlerDone = new Promise((resolve) => (finishHandler = resolve));

      // Mirrors the real consumer: the handler reacts to the abort event
      // (rather than polling `signal.aborted`) and then settles.
      const requestListener = registerListener<{ context: string }>(
        (_request, abortController) => {
          abortController.signal.addEventListener(
            "abort",
            () => {
              abortListener(abortController.signal.reason);
              finishHandler({ cancelled: true });
            },
            { once: true },
          );
          return handlerDone;
        },
        (request) => request.context,
      );
      const cancelListener = registerListener<string>((ctx) => service.doCancelRequest(ctx));

      const completeCallback = jest.fn();
      const processing = requestListener(1, 2, { context }, completeCallback);

      // Deliver a cancellation the same way the IPC server would.
      await cancelListener(3, 4, context);
      await processing;

      expect(abortListener).toHaveBeenCalledWith("Operation cancelled");
      expect(completeCallback).toHaveBeenCalledWith(null, { cancelled: true });
      expect((service as any).inFlightRequests[context]).toBeUndefined();
    });

    it("cleans up the in-flight entry when the handler throws", async () => {
      const context = "txn-2";
      const completeCallback = jest.fn();

      const requestListener = registerListener<{ context: string }>(
        () => Promise.reject(new Error("boom")),
        (request) => request.context,
      );

      await requestListener(1, 2, { context }, completeCallback);

      expect(completeCallback).toHaveBeenCalledWith(expect.any(Error), null);
      expect((service as any).inFlightRequests[context]).toBeUndefined();
    });
  });
});
