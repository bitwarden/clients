import { combineLatest, Subscription } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  AssertCredentialParams,
  CreateCredentialParams,
  Fido2ClientService,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { AbortManager } from "../../../vault/background/abort-manager";
import { BrowserFido2ParentWindowReference } from "../services/browser-fido2-user-interface.service";
import { ProxyRequestContext, WebauthnJsonUtils } from "../utils/webauthn-json-utils";

/**
 * Bridges Chrome's MV3 `chrome.webAuthenticationProxy` API into the existing
 * Bitwarden Fido2 client pipeline.
 *
 * Chrome 146+ introduced a native passkey selector that bypasses extension
 * script-level overrides of `navigator.credentials.{create,get}`, which means
 * the long-standing `fido2-page-script.ts` interception no longer catches every
 * WebAuthn call. The proxy API is Chrome's officially supported MV3 mechanism
 * for an extension to act as a WebAuthn credential provider; it survives the
 * new selector because Chrome explicitly routes the request to the attached
 * proxy extension instead of relying on JS-level monkey-patching.
 *
 * The proxy coexists safely with the existing page-script:
 *   - When the page-script's override is in effect, it intercepts the call at
 *     JS level and Chrome's WebAuthn implementation is never reached, so the
 *     proxy events never fire.
 *   - When Chrome's new selector bypasses the page-script override, Chrome
 *     routes the request to our proxy and we handle it here.
 *
 * Behind feature flag {@link FeatureFlag.UseWebAuthenticationProxy}.
 */
export class Fido2WebAuthnProxyBackground {
  private readonly abortManager = new AbortManager();
  private subscriptions: Subscription = new Subscription();
  private isAttached = false;
  private listenersWired = false;

  constructor(
    private readonly logService: LogService,
    private readonly fido2ClientService: Fido2ClientService<BrowserFido2ParentWindowReference>,
    private readonly vaultSettingsService: VaultSettingsService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Wires up event listeners (once) and starts reacting to feature flag, auth,
   * and passkey-setting changes to attach or detach the proxy as appropriate.
   * No-op when the API is unavailable (Firefox, Safari, old Chrome).
   */
  init(): void {
    if (!this.isProxyApiAvailable()) {
      return;
    }

    this.wireListeners();

    this.subscriptions.add(
      combineLatest([
        this.configService.getFeatureFlag$(FeatureFlag.UseWebAuthenticationProxy),
        this.authService.activeAccountStatus$,
        this.vaultSettingsService.enablePasskeys$,
      ]).subscribe(
        ([flag, status, enablePasskeys]) =>
          void this.reconcileAttachment(flag === true, status, enablePasskeys === true),
      ),
    );
  }

  destroy(): void {
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
    if (this.isAttached) {
      void this.runDetach();
    }
  }

  private isProxyApiAvailable(): boolean {
    return (
      typeof chrome !== "undefined" &&
      chrome?.webAuthenticationProxy != null &&
      typeof chrome.webAuthenticationProxy.attach === "function"
    );
  }

  private async reconcileAttachment(
    flagEnabled: boolean,
    status: AuthenticationStatus,
    enablePasskeys: boolean,
  ): Promise<void> {
    const shouldBeAttached =
      flagEnabled &&
      enablePasskeys &&
      status !== AuthenticationStatus.LoggedOut &&
      this.isProxyApiAvailable();

    if (shouldBeAttached && !this.isAttached) {
      await this.runAttach();
    } else if (!shouldBeAttached && this.isAttached) {
      await this.runDetach();
    }
  }

  private async runAttach(): Promise<void> {
    try {
      const error = await chrome.webAuthenticationProxy.attach();
      if (error) {
        // Most commonly: another extension is already attached as the proxy.
        this.logService.warning(`[Fido2WebAuthnProxy] Failed to attach: ${error}`);
        return;
      }
      this.isAttached = true;
    } catch (err) {
      this.logService.error(err);
    }
  }

  private async runDetach(): Promise<void> {
    try {
      await chrome.webAuthenticationProxy.detach();
    } catch (err) {
      this.logService.error(err);
    } finally {
      this.isAttached = false;
    }
  }

  private wireListeners(): void {
    if (this.listenersWired) {
      return;
    }
    this.listenersWired = true;

    const proxy = chrome.webAuthenticationProxy;
    proxy.onCreateRequest.addListener(this.handleCreateRequest);
    proxy.onGetRequest.addListener(this.handleGetRequest);
    proxy.onIsUvpaaRequest.addListener(this.handleIsUvpaaRequest);
    proxy.onRequestCanceled.addListener(this.handleRequestCanceled);
  }

  private readonly handleIsUvpaaRequest = (requestInfo: { requestId: number }) => {
    // Bitwarden vault acts as a virtual platform authenticator with user
    // verification, so always respond true.
    void chrome.webAuthenticationProxy.completeIsUvpaaRequest({
      requestId: requestInfo.requestId,
      isUvpaa: true,
    });
  };

  private readonly handleRequestCanceled = (requestId: number) => {
    this.abortManager.abort(String(requestId));
  };

  private readonly handleCreateRequest = (requestInfo: {
    requestId: number;
    requestDetailsJson: string;
  }) => {
    void this.processRequest("create", requestInfo);
  };

  private readonly handleGetRequest = (requestInfo: {
    requestId: number;
    requestDetailsJson: string;
  }) => {
    void this.processRequest("get", requestInfo);
  };

  private async processRequest(
    kind: "create" | "get",
    requestInfo: { requestId: number; requestDetailsJson: string },
  ): Promise<void> {
    const { requestId, requestDetailsJson } = requestInfo;
    try {
      const tab = await BrowserApi.getTabFromCurrentWindow();
      if (tab == null || tab.url == null) {
        await this.completeWithError(kind, requestId, {
          name: "NotAllowedError",
          message: "No focused tab for WebAuthn proxy request",
        });
        return;
      }

      const context = this.buildContext(tab.url);
      if (context == null) {
        await this.completeWithError(kind, requestId, {
          name: "SecurityError",
          message: "Active tab is not a valid WebAuthn origin",
        });
        return;
      }

      await this.abortManager.runWithAbortController(String(requestId), async (abortController) => {
        if (kind === "create") {
          const params: CreateCredentialParams = WebauthnJsonUtils.parseCreateRequest(
            requestDetailsJson,
            context,
          );
          const result = await this.fido2ClientService.createCredential(
            params,
            tab,
            abortController,
          );
          await chrome.webAuthenticationProxy.completeCreateRequest({
            requestId,
            responseJson: WebauthnJsonUtils.serializeCreateResponse(result),
          });
        } else {
          const params: AssertCredentialParams = WebauthnJsonUtils.parseGetRequest(
            requestDetailsJson,
            context,
          );
          const result = await this.fido2ClientService.assertCredential(
            params,
            tab,
            abortController,
          );
          await chrome.webAuthenticationProxy.completeGetRequest({
            requestId,
            responseJson: WebauthnJsonUtils.serializeGetResponse(result),
          });
        }
      });
    } catch (err) {
      this.logService.error(err);
      await this.completeWithError(kind, requestId, WebauthnJsonUtils.toProxyError(err));
    }
  }

  private async completeWithError(
    kind: "create" | "get",
    requestId: number,
    error: { name: string; message: string },
  ): Promise<void> {
    try {
      if (kind === "create") {
        await chrome.webAuthenticationProxy.completeCreateRequest({ requestId, error });
      } else {
        await chrome.webAuthenticationProxy.completeGetRequest({ requestId, error });
      }
    } catch (err) {
      this.logService.error(err);
    }
  }

  private buildContext(tabUrl: string): ProxyRequestContext | null {
    try {
      const parsed = new URL(tabUrl);
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
        return null;
      }
      return {
        origin: parsed.origin,
        // Chrome only routes WebAuthn calls to the proxy that have already
        // satisfied permissions-policy / same-origin checks at the platform
        // layer, so this is safe to default to true.
        sameOriginWithAncestors: true,
      };
    } catch {
      return null;
    }
  }
}
