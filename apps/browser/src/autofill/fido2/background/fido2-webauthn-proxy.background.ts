import { combineLatest, from, Subject, Subscription } from "rxjs";
import { concatMap, takeUntil } from "rxjs/operators";

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
import { BrowserFido2ParentWindowReference } from "../services/browser-fido2-user-interface.service";
import { ProxyRequestContext, WebauthnJsonUtils } from "../utils/webauthn-json-utils";

import { Fido2PageScriptFallbackTracker } from "./fido2-page-script-fallback-tracker";

type RequestKind = "create" | "get";

interface InFlightRequest {
  abortController: AbortController;
  kind: RequestKind;
}

/**
 * Bridges Chrome's MV3 `chrome.webAuthenticationProxy` API into the existing
 * Bitwarden Fido2 client pipeline.
 *
 * Chrome 146+ introduced a native passkey selector that bypasses extension
 * script-level overrides of `navigator.credentials.{create,get}`, which means
 * the long-standing `fido2-page-script.ts` interception no longer catches
 * every WebAuthn call. The proxy API is Chrome's officially supported MV3
 * mechanism for an extension to act as a WebAuthn credential provider; it
 * survives the new selector because Chrome explicitly routes the request to
 * the attached proxy extension instead of relying on JS-level monkey-patching.
 *
 * The proxy coexists with the existing page-script:
 *   - When the page-script's override is in effect it intercepts the call at
 *     JS level and Chrome's WebAuthn implementation is never reached, so the
 *     proxy events never fire.
 *   - When Chrome's new selector bypasses the page-script override Chrome
 *     routes the request to our proxy and we handle it here.
 *   - When the page-script flow falls back to the native API (user dismissed
 *     the Bitwarden picker), the page-script marks the tab via
 *     {@link Fido2PageScriptFallbackTracker} and the proxy short-circuits so
 *     Chrome's native picker handles the fallback call.
 *
 * Behind feature flag {@link FeatureFlag.UseWebAuthenticationProxy}.
 */
export class Fido2WebAuthnProxyBackground {
  private readonly inFlightRequests = new Map<number, InFlightRequest>();
  private readonly canceledRequestIds = new Set<number>();
  private readonly destroyed$ = new Subject<void>();
  private subscriptions = new Subscription();
  private isAttached = false;
  private listenersWired = false;

  constructor(
    private readonly logService: LogService,
    private readonly fido2ClientService: Fido2ClientService<BrowserFido2ParentWindowReference>,
    private readonly vaultSettingsService: VaultSettingsService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly pageScriptFallbackTracker: Fido2PageScriptFallbackTracker,
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

    // concatMap serializes attach/detach calls so concurrent state changes
    // (e.g., logout while attach is in flight) cannot interleave and leave
    // the proxy in the wrong state. We re-read the latest state inside the
    // handler so queued-but-stale emissions still settle on the right action.
    let latestFlag = false;
    let latestStatus: AuthenticationStatus | undefined;
    let latestPasskeys = false;

    this.subscriptions.add(
      combineLatest([
        this.configService.getFeatureFlag$(FeatureFlag.UseWebAuthenticationProxy),
        this.authService.activeAccountStatus$,
        this.vaultSettingsService.enablePasskeys$,
      ])
        .pipe(
          concatMap(([flag, status, enablePasskeys]) => {
            latestFlag = flag === true;
            latestStatus = status;
            latestPasskeys = enablePasskeys === true;
            return from(
              this.reconcileAttachment(() => ({
                flagEnabled: latestFlag,
                status: latestStatus,
                enablePasskeys: latestPasskeys,
              })),
            );
          }),
          takeUntil(this.destroyed$),
        )
        .subscribe({
          error: (err: unknown) => this.logService.error(err),
        }),
    );
  }

  async destroy(): Promise<void> {
    this.destroyed$.next();
    this.destroyed$.complete();
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
    this.unwireListeners();
    if (this.isAttached) {
      await this.runDetach();
    }
    // Abort any still-in-flight requests so awaiting callers don't dangle.
    for (const request of this.inFlightRequests.values()) {
      request.abortController.abort();
    }
    this.inFlightRequests.clear();
    this.canceledRequestIds.clear();
  }

  private isProxyApiAvailable(): boolean {
    return (
      typeof chrome !== "undefined" &&
      chrome?.webAuthenticationProxy != null &&
      typeof chrome.webAuthenticationProxy.attach === "function"
    );
  }

  private async reconcileAttachment(
    readLatest: () => {
      flagEnabled: boolean;
      status: AuthenticationStatus | undefined;
      enablePasskeys: boolean;
    },
  ): Promise<void> {
    const desired = readLatest();
    const shouldBeAttached =
      desired.flagEnabled &&
      desired.enablePasskeys &&
      desired.status != null &&
      desired.status !== AuthenticationStatus.LoggedOut &&
      this.isProxyApiAvailable();

    if (shouldBeAttached && !this.isAttached) {
      await this.runAttach();
    } else if (!shouldBeAttached && this.isAttached) {
      await this.runDetach();
    }

    // Re-check after the async hop. If state flipped while we were attaching
    // or detaching, run one more reconcile pass to converge.
    const after = readLatest();
    const shouldBeAttachedAfter =
      after.flagEnabled &&
      after.enablePasskeys &&
      after.status != null &&
      after.status !== AuthenticationStatus.LoggedOut &&
      this.isProxyApiAvailable();

    if (shouldBeAttachedAfter !== this.isAttached) {
      if (shouldBeAttachedAfter) {
        await this.runAttach();
      } else {
        await this.runDetach();
      }
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

  private unwireListeners(): void {
    if (!this.listenersWired || !this.isProxyApiAvailable()) {
      return;
    }
    this.listenersWired = false;

    const proxy = chrome.webAuthenticationProxy;
    proxy.onCreateRequest.removeListener(this.handleCreateRequest);
    proxy.onGetRequest.removeListener(this.handleGetRequest);
    proxy.onIsUvpaaRequest.removeListener(this.handleIsUvpaaRequest);
    proxy.onRequestCanceled.removeListener(this.handleRequestCanceled);
  }

  private readonly handleIsUvpaaRequest = (requestInfo: { requestId: number }): void => {
    // Bitwarden vault acts as a virtual platform authenticator with user
    // verification, so always respond true.
    void chrome.webAuthenticationProxy.completeIsUvpaaRequest({
      requestId: requestInfo.requestId,
      isUvpaa: true,
    });
  };

  private readonly handleRequestCanceled = (requestId: number): void => {
    const inFlight = this.inFlightRequests.get(requestId);
    if (inFlight != null) {
      inFlight.abortController.abort();
      return;
    }
    // Cancellation arrived before the request handler had a chance to run
    // (or after we already finished). Remember it so an arriving handler can
    // bail out immediately. The set is small and per-event because Chrome
    // does not retransmit canceled ids.
    this.canceledRequestIds.add(requestId);
  };

  private readonly handleCreateRequest = (requestInfo: {
    requestId: number;
    requestDetailsJson: string;
  }): void => {
    void this.processRequest("create", requestInfo);
  };

  private readonly handleGetRequest = (requestInfo: {
    requestId: number;
    requestDetailsJson: string;
  }): void => {
    void this.processRequest("get", requestInfo);
  };

  private async processRequest(
    kind: RequestKind,
    requestInfo: { requestId: number; requestDetailsJson: string },
  ): Promise<void> {
    const { requestId, requestDetailsJson } = requestInfo;

    // Register an AbortController synchronously so a cancellation event that
    // races our async setup work is never silently dropped.
    const abortController = new AbortController();
    this.inFlightRequests.set(requestId, { abortController, kind });
    if (this.canceledRequestIds.delete(requestId)) {
      abortController.abort();
    }

    try {
      const tab = await BrowserApi.getTabFromCurrentWindow();
      if (tab == null || tab.url == null || tab.id == null) {
        await this.completeWithError(kind, requestId, {
          name: "NotAllowedError",
          message: "No focused tab for WebAuthn proxy request",
        });
        return;
      }

      if (this.pageScriptFallbackTracker.consumeIfPending(tab.id)) {
        // The page-script just fell back to the native API for this tab.
        // Bail out so Chrome's native picker handles that call instead of
        // re-entering Bitwarden and re-prompting the user.
        await this.completeWithError(kind, requestId, {
          name: "NotAllowedError",
          message: "Page-script fallback in progress",
        });
        return;
      }

      const context = this.buildContext(tab.url, requestDetailsJson, kind);
      if (context == null) {
        // Either the tab is not a valid WebAuthn origin or the request's rpId
        // does not match the top-level tab's hostname (likely a cross-origin
        // iframe request, which the proxy cannot serve safely - the page-script
        // path covers that case in the iframe's MAIN world). Surface
        // NotAllowedError so Chrome falls back to its native picker.
        await this.completeWithError(kind, requestId, {
          name: "NotAllowedError",
          message: "Request origin cannot be served by Bitwarden proxy",
        });
        return;
      }

      if (abortController.signal.aborted) {
        // Canceled while we awaited tab lookup.
        await this.completeWithError(kind, requestId, {
          name: "AbortError",
          message: "Request canceled",
        });
        return;
      }

      if (kind === "create") {
        const params: CreateCredentialParams = WebauthnJsonUtils.parseCreateRequest(
          requestDetailsJson,
          context,
        );
        const result = await this.fido2ClientService.createCredential(params, tab, abortController);
        await chrome.webAuthenticationProxy.completeCreateRequest({
          requestId,
          responseJson: WebauthnJsonUtils.serializeCreateResponse(result),
        });
      } else {
        const params: AssertCredentialParams = WebauthnJsonUtils.parseGetRequest(
          requestDetailsJson,
          context,
        );
        const result = await this.fido2ClientService.assertCredential(params, tab, abortController);
        await chrome.webAuthenticationProxy.completeGetRequest({
          requestId,
          responseJson: WebauthnJsonUtils.serializeGetResponse(result),
        });
      }
    } catch (err) {
      this.logService.error(err);
      await this.completeWithError(kind, requestId, WebauthnJsonUtils.toProxyError(err));
    } finally {
      this.inFlightRequests.delete(requestId);
    }
  }

  private async completeWithError(
    kind: RequestKind,
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

  private buildContext(
    tabUrl: string,
    requestDetailsJson: string,
    kind: RequestKind,
  ): ProxyRequestContext | null {
    let parsed: URL;
    try {
      parsed = new URL(tabUrl);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      return null;
    }

    const rpId = this.extractRpId(requestDetailsJson, kind);
    if (rpId != null && !this.isRegistrableSuffix(parsed.hostname, rpId)) {
      // rpId is not the top-level hostname or a parent domain of it. Most
      // likely a cross-origin iframe call: the actual frame origin is unknown
      // to us, so signing a clientDataJSON with the top-level origin would
      // produce a credential the RP rejects. Decline so Chrome's native
      // picker handles it.
      return null;
    }

    return {
      origin: parsed.origin,
      // We've validated rpId against the top-level origin above, so the
      // request is consistent with a top-frame call (the only case the proxy
      // serves). sameOriginWithAncestors=true matches that.
      sameOriginWithAncestors: true,
    };
  }

  private extractRpId(requestDetailsJson: string, kind: RequestKind): string | undefined {
    try {
      const parsed = JSON.parse(requestDetailsJson) as { rp?: { id?: string }; rpId?: string };
      return kind === "create" ? parsed?.rp?.id : parsed?.rpId;
    } catch {
      return undefined;
    }
  }

  /**
   * Returns true when {@link rpId} equals {@link hostname} or is a parent
   * domain of it. WebAuthn's stricter "registrable domain suffix" check is
   * already enforced by Chrome before the proxy event reaches us, so the
   * lighter suffix check here is enough to detect the cross-origin-iframe
   * mismatch we care about.
   */
  private isRegistrableSuffix(hostname: string, rpId: string): boolean {
    const host = hostname.toLowerCase();
    const id = rpId.toLowerCase();
    return host === id || host.endsWith("." + id);
  }
}
