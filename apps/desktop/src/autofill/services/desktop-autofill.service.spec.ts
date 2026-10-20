import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { Fido2AuthenticatorService as Fido2AuthenticatorServiceAbstraction } from "@bitwarden/common/platform/abstractions/fido2/fido2-authenticator.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillIpcErrorKind } from "../models/autofill-ipc-channels";

import { DesktopAutofillService } from "./desktop-autofill.service";
import {
  CredentialNotFound,
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
  ExcludedCredentialMatched,
  NativeWindowObject,
} from "./desktop-fido2-user-interface.service";

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
  let environmentService: MockProxy<EnvironmentService>;
  /** The active account's web vault URL. */
  let webVaultUrl: string;
  let fido2UserInterfaceService: MockProxy<DesktopFido2UserInterfaceService>;

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
    environmentService = mock<EnvironmentService>();
    webVaultUrl = "https://vault.bitwarden.com";
    environmentService.environment$ = of({ getWebVaultUrl: () => webVaultUrl } as Environment);
    fido2UserInterfaceService = mock<DesktopFido2UserInterfaceService>();

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
      environmentService,
      platformUtilsService,
      fido2UserInterfaceService,
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
        environmentService,
        platformUtilsService,
        fido2UserInterfaceService,
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

  describe("blocked RP IDs", () => {
    it.each(["vault.bitwarden.com", "Vault.Bitwarden.COM"])(
      "tells the user why, then rejects registration, assertion, and UI-less assertion for the active vault's RP ID (%s)",
      async (rpId) => {
        (global as any).ipc = {
          autofill: { desktopAutofill: { getAppWindowHandle: jest.fn().mockResolvedValue(null) } },
        };
        const session = mock<DesktopFido2UserInterfaceSession>();
        session.informRpIdNotAllowed.mockRejectedValue(
          new DOMException("not allowed", "NotAllowedError"),
        );
        fido2UserInterfaceService.newSession.mockResolvedValue(session);
        const request = {
          rpId,
          clientWindow: { position: { x: 0, y: 0 } },
          context: "ctx",
        } as any;
        const abortController = new AbortController();

        try {
          await expect(
            service.doPasskeyRegistration(request, abortController),
          ).rejects.toMatchObject({ name: "NotAllowedError" });
          await expect(service.doPasskeyAssertion(request, abortController)).rejects.toMatchObject({
            name: "NotAllowedError",
          });
          await expect(
            service.doPasskeyAssertionWithoutUserInterface(request, abortController),
          ).rejects.toMatchObject({ name: "NotAllowedError" });
        } finally {
          delete (global as any).ipc;
        }

        expect(fido2UserInterfaceService.newSession).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ rpId }),
          abortController,
        );
        expect(session.informRpIdNotAllowed.mock.calls).toEqual([
          ["registration"],
          ["assertion"],
          ["assertion"],
        ]);
        expect(fido2AuthenticatorService.makeCredential).not.toHaveBeenCalled();
        expect(fido2AuthenticatorService.getAssertion).not.toHaveBeenCalled();
      },
    );

    describe("syncing to the OS", () => {
      // Syncs one passkey per RP ID and returns the RP IDs that reached the OS.
      async function syncPasskeysFor(rpIds: string[]): Promise<string[]> {
        const runCommand = jest
          .fn()
          .mockImplementation(async ({ command }) =>
            command === "status"
              ? { type: "success", value: { state: { enabled: true }, support: { fido2: true } } }
              : { type: "success", value: { added: 0 } },
          );
        (global as any).ipc = { autofill: { desktopAutofill: { runCommand } } };
        const passkeyCipher = (rpId: string) =>
          ({
            id: rpId,
            type: CipherType.Login,
            isDeleted: false,
            login: {
              hasFido2Credentials: true,
              fido2Credentials: [{ credentialId: Utils.newGuid(), rpId, userName: "user" }],
            },
          }) as unknown as CipherView;

        try {
          await service.sync(rpIds.map(passkeyCipher));
        } finally {
          delete (global as any).ipc;
        }

        const syncCall = runCommand.mock.calls.find(([c]) => c.command === "sync");
        return syncCall[0].params.credentials.map((c: { cipherId: string }) => c.cipherId);
      }

      it.each([
        ["https://vault.bitwarden.com", "vault.bitwarden.com"],
        ["https://vault.bitwarden.eu", "Vault.Bitwarden.EU"],
        ["https://bitwarden.example.com", "bitwarden.example.com"],
        ["https://bitwarden.example.com/", "bitwarden.example.com"],
        ["https://Bitwarden.Example.COM", "bitwarden.example.com"],
        ["https://bitwarden.example.com:443", "bitwarden.example.com"],
      ])("does not sync passkeys for the vault at %s (RP ID %s)", async (url, rpId) => {
        webVaultUrl = url;

        await expect(syncPasskeysFor([rpId, "example.org"])).resolves.toEqual(["example.org"]);
      });

      it.each([
        ["https://example.com:8443", "example.com"],
        ["https://example.com/bitwarden", "example.com"],
        ["http://bitwarden.example.com", "bitwarden.example.com"],
        ["https://localhost", "localhost"],
        ["https://bitwarden.localhost", "bitwarden.localhost"],
        ["not a url", "bitwarden.example.com"],
      ])(
        "syncs passkeys for the host of a vault at %s, which can't be told apart from other services",
        async (url, rpId) => {
          webVaultUrl = url;

          await expect(syncPasskeysFor([rpId])).resolves.toEqual([rpId]);
        },
      );
    });

    it("passes other RP IDs, including the vault's parent domain, through to the authenticator", async () => {
      (global as any).ipc = {
        autofill: { desktopAutofill: { getAppWindowHandle: jest.fn().mockResolvedValue(null) } },
      };
      const authenticatorReached = new Error("authenticator reached");
      fido2AuthenticatorService.getAssertion.mockRejectedValue(authenticatorReached);

      try {
        await expect(
          service.doPasskeyAssertion(
            {
              rpId: "bitwarden.com",
              clientDataHash: [],
              allowedCredentials: [],
              userVerification: "preferred",
              clientWindow: { position: { x: 0, y: 0 } },
              context: "ctx",
            } as any,
            new AbortController(),
          ),
        ).rejects.toBe(authenticatorReached);
      } finally {
        delete (global as any).ipc;
      }
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

    it("tags an excluded credential match so the OS can report it to the relying party", async () => {
      const completeCallback = jest.fn();
      const error = new ExcludedCredentialMatched();

      const requestListener = registerListener<{ context: string }>(
        () => Promise.reject(error),
        (request) => request.context,
      );

      await requestListener(1, 2, { context: "txn-4" }, completeCallback);

      expect(completeCallback).toHaveBeenCalledWith(
        error,
        null,
        AutofillIpcErrorKind.ExcludedCredentialMatched,
      );
    });

    it("tags a missing credential so the OS can drop its stale credential identity", async () => {
      const completeCallback = jest.fn();
      const error = new CredentialNotFound();

      const requestListener = registerListener<{ context: string }>(
        () => Promise.reject(error),
        (request) => request.context,
      );

      await requestListener(1, 2, { context: "txn-5" }, completeCallback);

      expect(completeCallback).toHaveBeenCalledWith(
        error,
        null,
        AutofillIpcErrorKind.CredentialNotFound,
      );
    });
  });
});
