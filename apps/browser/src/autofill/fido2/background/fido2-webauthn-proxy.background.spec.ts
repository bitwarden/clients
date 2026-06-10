import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  AssertCredentialResult,
  CreateCredentialResult,
  FallbackRequestedError,
  Fido2ClientService,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";

import { flushPromises } from "../../../autofill/spec/testing-utils";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { BrowserFido2ParentWindowReference } from "../services/browser-fido2-user-interface.service";

import { Fido2PageScriptFallbackTracker } from "./fido2-page-script-fallback-tracker";
import { Fido2WebAuthnProxyBackground } from "./fido2-webauthn-proxy.background";

interface ProxyEvent<P> {
  listener?: (payload: P) => void;
  addListener: jest.Mock;
  removeListener: jest.Mock;
}

function makeEvent<P>(): ProxyEvent<P> {
  const ev: ProxyEvent<P> = {
    addListener: jest.fn((cb: (payload: P) => void) => {
      ev.listener = cb;
    }),
    removeListener: jest.fn(),
  };
  return ev;
}

describe("Fido2WebAuthnProxyBackground", () => {
  let logService: MockProxy<LogService>;
  let fido2ClientService: MockProxy<Fido2ClientService<BrowserFido2ParentWindowReference>>;
  let vaultSettingsService: MockProxy<VaultSettingsService>;
  let authService: MockProxy<AuthService>;
  let configService: MockProxy<ConfigService>;
  let fallbackTracker: Fido2PageScriptFallbackTracker;

  let enablePasskeys$: BehaviorSubject<boolean>;
  let authStatus$: BehaviorSubject<AuthenticationStatus>;
  let featureFlag$: BehaviorSubject<boolean>;

  let proxyApi: {
    attach: jest.Mock;
    detach: jest.Mock;
    completeCreateRequest: jest.Mock;
    completeGetRequest: jest.Mock;
    completeIsUvpaaRequest: jest.Mock;
    onCreateRequest: ProxyEvent<{ requestId: number; requestDetailsJson: string }>;
    onGetRequest: ProxyEvent<{ requestId: number; requestDetailsJson: string }>;
    onIsUvpaaRequest: ProxyEvent<{ requestId: number }>;
    onRequestCanceled: ProxyEvent<number>;
  };

  let bg: Fido2WebAuthnProxyBackground;

  const tabMock: chrome.tabs.Tab = mock<chrome.tabs.Tab>({
    id: 7,
    url: "https://example.com/login",
    windowId: 1,
  });

  beforeEach(() => {
    logService = mock<LogService>();
    fido2ClientService = mock<Fido2ClientService<BrowserFido2ParentWindowReference>>();
    vaultSettingsService = mock<VaultSettingsService>();
    authService = mock<AuthService>();
    configService = mock<ConfigService>();
    fallbackTracker = new Fido2PageScriptFallbackTracker();

    enablePasskeys$ = new BehaviorSubject<boolean>(true);
    authStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    featureFlag$ = new BehaviorSubject<boolean>(false);

    vaultSettingsService.enablePasskeys$ = enablePasskeys$;
    authService.activeAccountStatus$ = authStatus$;
    configService.getFeatureFlag$.mockImplementation((flag) => {
      if (flag === FeatureFlag.UseWebAuthenticationProxy) {
        return featureFlag$;
      }
      return new BehaviorSubject(false) as any;
    });

    proxyApi = {
      attach: jest.fn().mockResolvedValue(undefined),
      detach: jest.fn().mockResolvedValue(undefined),
      completeCreateRequest: jest.fn().mockResolvedValue(undefined),
      completeGetRequest: jest.fn().mockResolvedValue(undefined),
      completeIsUvpaaRequest: jest.fn().mockResolvedValue(undefined),
      onCreateRequest: makeEvent(),
      onGetRequest: makeEvent(),
      onIsUvpaaRequest: makeEvent(),
      onRequestCanceled: makeEvent(),
    };
    (global as any).chrome.webAuthenticationProxy = proxyApi;

    jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(tabMock);

    bg = new Fido2WebAuthnProxyBackground(
      logService,
      fido2ClientService,
      vaultSettingsService,
      authService,
      configService,
      fallbackTracker,
    );
  });

  afterEach(async () => {
    await bg.destroy();
    delete (global as any).chrome.webAuthenticationProxy;
    jest.restoreAllMocks();
  });

  describe("init", () => {
    it("is a no-op when chrome.webAuthenticationProxy is unavailable", () => {
      delete (global as any).chrome.webAuthenticationProxy;
      bg.init();
      expect(proxyApi.onCreateRequest.addListener).not.toHaveBeenCalled();
    });

    it("wires listeners when the API is available", () => {
      bg.init();
      expect(proxyApi.onCreateRequest.addListener).toHaveBeenCalled();
      expect(proxyApi.onGetRequest.addListener).toHaveBeenCalled();
      expect(proxyApi.onIsUvpaaRequest.addListener).toHaveBeenCalled();
      expect(proxyApi.onRequestCanceled.addListener).toHaveBeenCalled();
    });
  });

  describe("attach/detach lifecycle", () => {
    it("does not attach when feature flag is off", async () => {
      bg.init();
      await flushPromises();
      expect(proxyApi.attach).not.toHaveBeenCalled();
    });

    it("attaches when flag + auth + passkeys all hold", async () => {
      bg.init();
      featureFlag$.next(true);
      await flushPromises();
      expect(proxyApi.attach).toHaveBeenCalledTimes(1);
    });

    it("does not attach when the user is logged out", async () => {
      authStatus$.next(AuthenticationStatus.LoggedOut);
      bg.init();
      featureFlag$.next(true);
      await flushPromises();
      expect(proxyApi.attach).not.toHaveBeenCalled();
    });

    it("does not attach when passkeys are disabled", async () => {
      enablePasskeys$.next(false);
      bg.init();
      featureFlag$.next(true);
      await flushPromises();
      expect(proxyApi.attach).not.toHaveBeenCalled();
    });

    it("detaches when the flag flips off after being on", async () => {
      bg.init();
      featureFlag$.next(true);
      await flushPromises();
      featureFlag$.next(false);
      await flushPromises();
      expect(proxyApi.detach).toHaveBeenCalledTimes(1);
    });

    it("detaches when the user logs out", async () => {
      bg.init();
      featureFlag$.next(true);
      await flushPromises();
      authStatus$.next(AuthenticationStatus.LoggedOut);
      await flushPromises();
      expect(proxyApi.detach).toHaveBeenCalledTimes(1);
    });

    it("does not attach again if another extension owns the proxy", async () => {
      proxyApi.attach.mockResolvedValue("Another extension is already attached");
      bg.init();
      featureFlag$.next(true);
      await flushPromises();
      expect(logService.warning).toHaveBeenCalled();
    });

    it("converges to detached when state flips during an in-flight attach (TOCTOU)", async () => {
      let resolveAttach: () => void = () => undefined;
      proxyApi.attach.mockImplementation(
        () =>
          new Promise<undefined>((resolve) => {
            resolveAttach = () => resolve(undefined);
          }),
      );

      bg.init();
      featureFlag$.next(true);
      await flushPromises();
      expect(proxyApi.attach).toHaveBeenCalledTimes(1);
      // While attach is pending, the user logs out.
      authStatus$.next(AuthenticationStatus.LoggedOut);
      await flushPromises();
      // Resolve the attach: the second reconcile pass should now detach.
      resolveAttach();
      await flushPromises();
      expect(proxyApi.detach).toHaveBeenCalledTimes(1);
    });
  });

  describe("destroy", () => {
    it("removes listeners and detaches the proxy", async () => {
      bg.init();
      featureFlag$.next(true);
      await flushPromises();

      await bg.destroy();

      expect(proxyApi.onCreateRequest.removeListener).toHaveBeenCalled();
      expect(proxyApi.onGetRequest.removeListener).toHaveBeenCalled();
      expect(proxyApi.onIsUvpaaRequest.removeListener).toHaveBeenCalled();
      expect(proxyApi.onRequestCanceled.removeListener).toHaveBeenCalled();
      expect(proxyApi.detach).toHaveBeenCalled();
    });
  });

  describe("handleIsUvpaaRequest", () => {
    it("always reports isUvpaa=true", () => {
      bg.init();
      proxyApi.onIsUvpaaRequest.listener?.({ requestId: 1 });
      expect(proxyApi.completeIsUvpaaRequest).toHaveBeenCalledWith({ requestId: 1, isUvpaa: true });
    });
  });

  describe("handleCreateRequest", () => {
    const createOptions = {
      rp: { id: "example.com", name: "Example" },
      user: { id: "dXNlcg", name: "alice", displayName: "Alice" },
      challenge: "Y2hhbA",
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    };
    const createResult: CreateCredentialResult = {
      credentialId: "Y3JlZA",
      clientDataJSON: "Y2RhdGE",
      attestationObject: "YXR0",
      authData: "YXV0aA",
      publicKey: "cGs",
      publicKeyAlgorithm: -7,
      transports: ["internal"],
      extensions: {},
    };

    it("forwards to fido2ClientService and serializes the response", async () => {
      fido2ClientService.createCredential.mockResolvedValue(createResult);
      bg.init();

      proxyApi.onCreateRequest.listener?.({
        requestId: 42,
        requestDetailsJson: JSON.stringify(createOptions),
      });
      await flushPromises();

      expect(fido2ClientService.createCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "https://example.com",
          challenge: "Y2hhbA",
          rp: { id: "example.com", name: "Example" },
        }),
        tabMock,
        expect.any(AbortController),
      );
      expect(proxyApi.completeCreateRequest).toHaveBeenCalledWith({
        requestId: 42,
        responseJson: expect.any(String),
      });
      const sent = JSON.parse(proxyApi.completeCreateRequest.mock.calls[0][0].responseJson);
      expect(sent.id).toBe("Y3JlZA");
    });

    it("maps FallbackRequestedError to NotAllowedError so Chrome shows its picker", async () => {
      fido2ClientService.createCredential.mockRejectedValue(new FallbackRequestedError());
      bg.init();

      proxyApi.onCreateRequest.listener?.({
        requestId: 99,
        requestDetailsJson: JSON.stringify(createOptions),
      });
      await flushPromises();

      expect(proxyApi.completeCreateRequest).toHaveBeenCalledWith({
        requestId: 99,
        error: { name: "NotAllowedError", message: "Fallback to browser requested" },
      });
    });

    it("declines and falls back when rpId does not match the active tab hostname", async () => {
      bg.init();
      proxyApi.onCreateRequest.listener?.({
        requestId: 1,
        requestDetailsJson: JSON.stringify({
          ...createOptions,
          rp: { id: "other.com", name: "Other" },
        }),
      });
      await flushPromises();

      expect(fido2ClientService.createCredential).not.toHaveBeenCalled();
      expect(proxyApi.completeCreateRequest).toHaveBeenCalledWith({
        requestId: 1,
        error: { name: "NotAllowedError", message: expect.stringContaining("cannot be served") },
      });
    });

    it("accepts an rpId that is a parent domain of the active tab hostname", async () => {
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(
          mock<chrome.tabs.Tab>({ id: 7, url: "https://accounts.example.com/login", windowId: 1 }),
        );
      fido2ClientService.createCredential.mockResolvedValue(createResult);
      bg.init();

      proxyApi.onCreateRequest.listener?.({
        requestId: 2,
        requestDetailsJson: JSON.stringify({
          ...createOptions,
          rp: { id: "example.com", name: "Example" },
        }),
      });
      await flushPromises();

      expect(fido2ClientService.createCredential).toHaveBeenCalled();
    });

    it("declines for non-https tabs", async () => {
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(mock<chrome.tabs.Tab>({ id: 1, url: "chrome://newtab/" }));
      bg.init();

      proxyApi.onCreateRequest.listener?.({
        requestId: 1,
        requestDetailsJson: JSON.stringify(createOptions),
      });
      await flushPromises();

      expect(fido2ClientService.createCredential).not.toHaveBeenCalled();
      expect(proxyApi.completeCreateRequest).toHaveBeenCalledWith({
        requestId: 1,
        error: expect.objectContaining({ name: "NotAllowedError" }),
      });
    });

    it("short-circuits when the page-script just initiated a fallback for the tab", async () => {
      fallbackTracker.markFallbackInProgress(tabMock.id!);
      bg.init();

      proxyApi.onCreateRequest.listener?.({
        requestId: 3,
        requestDetailsJson: JSON.stringify(createOptions),
      });
      await flushPromises();

      expect(fido2ClientService.createCredential).not.toHaveBeenCalled();
      expect(proxyApi.completeCreateRequest).toHaveBeenCalledWith({
        requestId: 3,
        error: {
          name: "NotAllowedError",
          message: "Page-script fallback in progress",
        },
      });
    });
  });

  describe("handleGetRequest", () => {
    const getOptions = {
      challenge: "Y2hhbA",
      rpId: "example.com",
      allowCredentials: [{ id: "Y3JlZA", type: "public-key", transports: ["internal"] }],
    };
    const assertResult: AssertCredentialResult = {
      credentialId: "Y3JlZA",
      clientDataJSON: "Y2RhdGE",
      authenticatorData: "YXV0aA",
      signature: "c2ln",
      userHandle: "dWg",
    };

    it("forwards to fido2ClientService and serializes the response", async () => {
      fido2ClientService.assertCredential.mockResolvedValue(assertResult);
      bg.init();

      proxyApi.onGetRequest.listener?.({
        requestId: 7,
        requestDetailsJson: JSON.stringify(getOptions),
      });
      await flushPromises();

      expect(fido2ClientService.assertCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "https://example.com",
          challenge: "Y2hhbA",
          rpId: "example.com",
          allowedCredentials: [{ id: "Y3JlZA", transports: ["internal"] }],
        }),
        tabMock,
        expect.any(AbortController),
      );
      expect(proxyApi.completeGetRequest).toHaveBeenCalledWith({
        requestId: 7,
        responseJson: expect.any(String),
      });
    });

    it("aborts the in-flight controller when Chrome cancels the request", async () => {
      let externalAbort: AbortSignal | undefined;
      fido2ClientService.assertCredential.mockImplementation(
        async (_p, _t, abortController) =>
          new Promise<AssertCredentialResult>((_, reject) => {
            externalAbort = abortController!.signal;
            abortController!.signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      );
      bg.init();
      proxyApi.onGetRequest.listener?.({
        requestId: 5,
        requestDetailsJson: JSON.stringify(getOptions),
      });
      await flushPromises();
      expect(externalAbort?.aborted).toBe(false);

      proxyApi.onRequestCanceled.listener?.(5);
      await flushPromises();

      expect(externalAbort?.aborted).toBe(true);
      expect(proxyApi.completeGetRequest).toHaveBeenCalledWith({
        requestId: 5,
        error: expect.objectContaining({ name: "AbortError" }),
      });
    });

    it("honors a cancel that arrives before any awaits in the request handler", async () => {
      let resolveTabQuery: ((tab: chrome.tabs.Tab) => void) | undefined;
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockImplementation(
          () => new Promise<chrome.tabs.Tab>((resolve) => (resolveTabQuery = resolve)),
        );
      bg.init();

      proxyApi.onGetRequest.listener?.({
        requestId: 11,
        requestDetailsJson: JSON.stringify(getOptions),
      });
      // Cancel races ahead of the tab lookup resolving.
      proxyApi.onRequestCanceled.listener?.(11);
      resolveTabQuery?.(tabMock);
      await flushPromises();

      expect(fido2ClientService.assertCredential).not.toHaveBeenCalled();
      expect(proxyApi.completeGetRequest).toHaveBeenCalledWith({
        requestId: 11,
        error: expect.objectContaining({ name: "AbortError" }),
      });
    });
  });
});
