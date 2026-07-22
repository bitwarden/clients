import { IframeAllowAttribute } from "../../content/iframe-allow-scraper";

/**
 * Background-side cache of iframe `allow=` attributes scraped from parent
 * documents.
 *
 * The cache is populated by reports from the FIDO2 content script: each frame's
 * content script scrapes its document's `<iframe>` elements and posts the
 * resulting `IframeAllowAttribute[]` to the background. We store the report
 * keyed by the **parent** frame's `(tabId, frameId)` — i.e. the frame that
 * contained the iframe elements.
 *
 * When the resolver needs the `allow=` attribute for a specific child frame X,
 * it asks `getAllowForChildFrame(tabId, X.parentFrameId, X.url)`. The cache
 * looks up the parent's report and returns the attribute of the iframe entry
 * whose `src` matches X's URL.
 *
 * Lifecycle matches `PermissionsPolicyHeaderCacheBackground`: in-memory only,
 * cleared on tab close, repopulated by the next scrape report on navigation.
 *
 * URL matching: the browser may follow redirects when loading an iframe, so
 * the `iframe.src` attribute in the parent's DOM and the frame's `url` in the
 * frame tree can differ. Lookup first tries exact string equality, then falls
 * back to an origin-level match — Permissions Policy container delegation is
 * defined at origin granularity, so an origin match preserves correct
 * semantics for the common case (redirect within the same origin, or path
 * normalization inserting a trailing slash).
 *
 * Limitations (deferred):
 * - Iframe navigations after first scrape (e.g. `iframe.src = '...'` in JS)
 *   leave the cache stale until the next scrape report. Lookup falls back to
 *   "no entry" → resolver uses the container default.
 * - `srcdoc` iframes have no URL to match on; the scraper marks them, but
 *   `getAllowForChildFrame` returns undefined for them — same handling.
 * - Multiple iframes with the same origin but different `allow` attributes
 *   resolve to the first matching entry when only origins match. Rare in
 *   practice (a page delegating differently to same-origin iframes).
 */
export class IframeAllowCacheBackground {
  private readonly cache = new Map<string, readonly IframeAllowAttribute[]>();
  private handleTabRemoved?: (tabId: number) => void;

  constructor(private readonly tabs: typeof chrome.tabs) {}

  /**
   * Registers cleanup listeners. Idempotent — calling twice is a no-op.
   */
  startListening(): void {
    if (this.handleTabRemoved != null) {
      return;
    }
    this.handleTabRemoved = (tabId) => this.clearTab(tabId);
    this.tabs.onRemoved.addListener(this.handleTabRemoved);
  }

  /**
   * Removes listeners. Mainly for test teardown.
   */
  stopListening(): void {
    if (this.handleTabRemoved != null) {
      this.tabs.onRemoved.removeListener(this.handleTabRemoved);
      this.handleTabRemoved = undefined;
    }
  }

  /**
   * Records a content-script report of the iframe `allow=` attributes scraped
   * from a parent frame's document. Overwrites any prior entry for the same
   * (tabId, parentFrameId) — newer reports win, matching navigation semantics.
   */
  recordReport(
    tabId: number,
    parentFrameId: number,
    iframes: readonly IframeAllowAttribute[],
  ): void {
    if (tabId < 0) {
      return;
    }
    this.cache.set(this.key(tabId, parentFrameId), iframes);
  }

  /**
   * Returns the `allow=` attribute for the iframe in `parentFrameId` whose
   * `src` matches `childUrl`. Returns `undefined` when no parent report is
   * cached, when no iframe in the report matches, or when the matching iframe
   * has no `allow` attribute set (the empty-string case is treated as absent).
   *
   * Returning `undefined` does *not* mean "denied" — it means "no information",
   * so the resolver applies the container default (`self` = parent's origin,
   * which denies cross-origin iframes).
   */
  getAllowForChildFrame(
    tabId: number,
    parentFrameId: number,
    childUrl: string,
  ): string | undefined {
    const report = this.cache.get(this.key(tabId, parentFrameId));
    if (report == null) {
      return undefined;
    }
    let match = report.find((iframe) => iframe.src === childUrl && iframe.src.length > 0);
    if (match == null) {
      const childOrigin = safeOrigin(childUrl);
      if (childOrigin != null) {
        match = report.find(
          (iframe) => iframe.src.length > 0 && safeOrigin(iframe.src) === childOrigin,
        );
      }
    }
    if (match == null || match.allow.length === 0) {
      return undefined;
    }
    return match.allow;
  }

  /**
   * Drops the report for the given parent frame. Useful for tests; in normal
   * operation, new reports overwrite and tab close clears the whole tab.
   */
  invalidate(tabId: number, parentFrameId: number): void {
    this.cache.delete(this.key(tabId, parentFrameId));
  }

  /**
   * Number of cached reports. Exposed for tests; not part of the stable API.
   */
  size(): number {
    return this.cache.size;
  }

  private clearTab(tabId: number): void {
    const prefix = `${tabId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  private key(tabId: number, parentFrameId: number): string {
    return `${tabId}:${parentFrameId}`;
  }
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
