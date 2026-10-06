import { PERMISSIONS_POLICY_REPORT_COMMAND } from "../../content/iframe-allow-reporter";
import { IframeAllowAttribute } from "../../content/iframe-allow-scraper";

import { IframeAllowCacheBackground } from "./iframe-allow-cache.background";
import { PermissionsPolicyHeaderCacheBackground } from "./permissions-policy-header-cache.background";
import {
  DefaultPermissionsPolicyParser,
  PermissionsPolicyParser,
} from "./permissions-policy-parser";
import { WebAuthnPermissionsPolicyBackground } from "./webauthn-permissions-policy.background";

type RuntimeMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
) => boolean | void | Promise<unknown>;

/**
 * Orchestrator for the Permissions Policy machinery on the background side.
 *
 * Owns the two caches (response headers + iframe `allow=` attributes), wires
 * them into the `WebAuthnPermissionsPolicyBackground` helper, and listens for
 * scrape reports from content scripts to populate the iframe-allow cache.
 *
 * The FIDO2 background calls `isFeatureAllowedForFrame(...)` on this class
 * when deciding whether to surface a passkey ceremony.
 */
export class PermissionsPolicyBackground {
  private readonly headerCache: PermissionsPolicyHeaderCacheBackground;
  private readonly iframeAllowCache: IframeAllowCacheBackground;
  private readonly helper: WebAuthnPermissionsPolicyBackground;
  private messageListener?: RuntimeMessageListener;

  constructor(
    private readonly chromeWebRequest: typeof chrome.webRequest,
    private readonly chromeTabs: typeof chrome.tabs,
    private readonly chromeWebNavigation: typeof chrome.webNavigation,
    private readonly chromeRuntime: typeof chrome.runtime,
    parser: PermissionsPolicyParser = new DefaultPermissionsPolicyParser(),
  ) {
    this.headerCache = new PermissionsPolicyHeaderCacheBackground(
      this.chromeWebRequest,
      this.chromeTabs,
    );
    this.iframeAllowCache = new IframeAllowCacheBackground(this.chromeTabs);
    this.helper = new WebAuthnPermissionsPolicyBackground(
      this.headerCache,
      this.iframeAllowCache,
      this.chromeWebNavigation,
      parser,
    );
  }

  /**
   * Starts the caches and registers the runtime message listener. Idempotent.
   */
  init(): void {
    this.headerCache.startListening();
    this.iframeAllowCache.startListening();

    if (this.messageListener != null) {
      return;
    }
    this.messageListener = (message, sender) => {
      this.handleMessage(message, sender);
    };
    this.chromeRuntime.onMessage.addListener(this.messageListener);
  }

  /**
   * Removes listeners; intended for tests and for full extension teardown.
   */
  destroy(): void {
    this.headerCache.stopListening();
    this.iframeAllowCache.stopListening();
    if (this.messageListener != null) {
      this.chromeRuntime.onMessage.removeListener(this.messageListener);
      this.messageListener = undefined;
    }
  }

  /**
   * Returns whether the requested WebAuthn feature is allowed for the given
   * frame, applying the full Permissions Policy delegation algorithm against
   * the cached headers and iframe `allow=` attributes.
   */
  async isFeatureAllowedForFrame(
    tabId: number,
    frameId: number,
    feature: string,
  ): Promise<boolean> {
    return this.helper.isFeatureAllowedForFrame(tabId, frameId, feature);
  }

  private handleMessage(message: unknown, sender: chrome.runtime.MessageSender): void {
    if (!isFrameAttributesReport(message)) {
      return;
    }
    const tabId = sender.tab?.id;
    if (tabId == null) {
      return;
    }
    // Content scripts in the top frame report `frameId: 0`; nested frames
    // report their own id. Either way the report describes the iframes that
    // the **sender** frame contains, so we key by the sender's frame id.
    const parentFrameId = sender.frameId ?? 0;
    this.iframeAllowCache.recordReport(tabId, parentFrameId, message.iframes);
  }
}

type FrameAttributesReport = {
  command: typeof PERMISSIONS_POLICY_REPORT_COMMAND;
  iframes: IframeAllowAttribute[];
};

function isFrameAttributesReport(message: unknown): message is FrameAttributesReport {
  if (message == null || typeof message !== "object") {
    return false;
  }
  const candidate = message as Partial<FrameAttributesReport>;
  if (candidate.command !== PERMISSIONS_POLICY_REPORT_COMMAND) {
    return false;
  }
  if (!Array.isArray(candidate.iframes)) {
    return false;
  }
  return candidate.iframes.every(isIframeAllowAttribute);
}

function isIframeAllowAttribute(value: unknown): value is IframeAllowAttribute {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<IframeAllowAttribute>;
  return (
    typeof candidate.src === "string" &&
    typeof candidate.allow === "string" &&
    typeof candidate.srcdoc === "boolean"
  );
}
