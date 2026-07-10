import { FrameNode, isWebAuthnFeatureAllowedForFrame } from "./frame-policy-resolver";
import { IframeAllowCacheBackground } from "./iframe-allow-cache.background";
import { PermissionsPolicyHeaderCacheBackground } from "./permissions-policy-header-cache.background";
import { PermissionsPolicyParser } from "./permissions-policy-parser";
import { resolveSelfInPolicy } from "./permissions-policy-semantics";
import { ResolvedPermissionsPolicy } from "./types";

/**
 * Background-side entry point for the WebAuthn Permissions Policy gate.
 *
 * This class is the single thing the FIDO2 background code calls when it needs
 * to know: "is `publickey-credentials-{create,get}` allowed for the frame that
 * initiated this ceremony?" It wires together:
 *
 *   - The header cache (response headers per frame, keyed by tab + frame id).
 *   - The iframe-allow cache (parent-scraped `allow=` attributes).
 *   - The frame tree (from `chrome.webNavigation.getAllFrames`).
 *   - The parser (header / `allow=` syntax → structured shape).
 *   - The resolver (frame-chain delegation algorithm).
 *
 * The parser is injected and required. Production callers construct this
 * class through `PermissionsPolicyBackground`, which passes a
 * `DefaultPermissionsPolicyParser`. Tests that want to exercise resolver
 * behavior without parser side effects pass `NoOpPermissionsPolicyParser`
 * explicitly.
 */
export class WebAuthnPermissionsPolicyBackground {
  constructor(
    private readonly headerCache: PermissionsPolicyHeaderCacheBackground,
    private readonly iframeAllowCache: IframeAllowCacheBackground,
    private readonly webNavigation: typeof chrome.webNavigation,
    private readonly parser: PermissionsPolicyParser,
  ) {}

  /**
   * Returns whether the requested WebAuthn feature is allowed for the given
   * frame. `feature` should be `publickey-credentials-create` or
   * `publickey-credentials-get`.
   *
   * Fails open (returns `true`) when the frame tree can't be resolved or the
   * requesting frame's URL is unparseable — these are unusual states where
   * we'd rather not block legitimate use; the content-script gate provides
   * defense-in-depth either way.
   */
  async isFeatureAllowedForFrame(
    tabId: number,
    frameId: number,
    feature: string,
  ): Promise<boolean> {
    const frames = await this.getAllFrames(tabId);
    if (frames == null) {
      return true;
    }

    const requestingFrame = frames.find((f) => f.frameId === frameId);
    if (requestingFrame == null) {
      return true;
    }

    const frameNode = this.buildFrameNode(tabId, requestingFrame, frames);
    if (frameNode == null) {
      return true;
    }

    return isWebAuthnFeatureAllowedForFrame(frameNode, feature);
  }

  private async getAllFrames(
    tabId: number,
  ): Promise<chrome.webNavigation.GetAllFrameResultDetails[] | null> {
    // Use the callback form so this works cross-browser. On Firefox, `chrome.*`
    // WebExtension APIs are callback-only — `await`ing the no-callback form
    // resolves to `undefined`. Chrome supports both. This mirrors
    // `BrowserApi.getAllFrameDetails`.
    try {
      return await new Promise<chrome.webNavigation.GetAllFrameResultDetails[] | null>((resolve) =>
        this.webNavigation.getAllFrames({ tabId }, (details) => resolve(details ?? null)),
      );
    } catch {
      return null;
    }
  }

  /**
   * Recursively builds the FrameNode chain from `frame` up to the top-level
   * frame in the tab. Returns null when an ancestor's URL can't be parsed
   * into an origin (rare; non-http(s) ancestors aren't expected for our
   * WebAuthn use case).
   */
  private buildFrameNode(
    tabId: number,
    frame: chrome.webNavigation.GetAllFrameResultDetails,
    allFrames: chrome.webNavigation.GetAllFrameResultDetails[],
  ): FrameNode | null {
    const origin = this.parseOrigin(frame.url);
    if (origin == null) {
      return null;
    }

    const declared = this.parseDeclaredPolicy(tabId, frame.frameId, origin);

    if (frame.parentFrameId < 0) {
      // Top-level frame: no container, no parent.
      return { origin, declared, container: new Map(), parent: null };
    }

    const parentFrame = allFrames.find((f) => f.frameId === frame.parentFrameId);
    if (parentFrame == null) {
      // Parent not found — treat as top-level for resolver purposes; the
      // resolver will only consult declared in that case.
      return { origin, declared, container: new Map(), parent: null };
    }

    const parentOrigin = this.parseOrigin(parentFrame.url);
    if (parentOrigin == null) {
      return null;
    }

    const container = this.parseContainerPolicy(tabId, frame, parentOrigin, origin);
    const parent = this.buildFrameNode(tabId, parentFrame, allFrames);

    return { origin, declared, container, parent };
  }

  private parseDeclaredPolicy(
    tabId: number,
    frameId: number,
    frameOrigin: string,
  ): ResolvedPermissionsPolicy {
    const raw = this.headerCache.getRawHeader(tabId, frameId);
    if (raw == null) {
      return new Map();
    }
    // Resolve `self` tokens to the frame's own origin. Without this, the
    // delegation algorithm would misinterpret `self` in an ancestor's declared
    // policy as matching the descendant's requesting origin when recursing.
    return resolveSelfInPolicy(this.parser.parseHeader(raw), frameOrigin);
  }

  private parseContainerPolicy(
    tabId: number,
    frame: chrome.webNavigation.GetAllFrameResultDetails,
    parentOrigin: string,
    iframeOrigin: string,
  ): ResolvedPermissionsPolicy {
    const rawAttribute = this.iframeAllowCache.getAllowForChildFrame(
      tabId,
      frame.parentFrameId,
      frame.url,
    );
    if (rawAttribute == null) {
      return new Map();
    }
    return this.parser.parseAllowAttribute(rawAttribute, iframeOrigin, parentOrigin);
  }

  private parseOrigin(url: string | undefined): string | null {
    if (url == null || url.length === 0) {
      return null;
    }
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }
}
