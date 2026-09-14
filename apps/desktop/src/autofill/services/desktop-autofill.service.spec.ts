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
