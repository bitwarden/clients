/**
 * Captures `Permissions-Policy` response headers as documents load and exposes
 * them keyed by (tabId, frameId) for the WebAuthn gate to consult.
 *
 * Reads from `chrome.webRequest.onHeadersReceived` (with `responseHeaders` in
 * `extraInfoSpec`) so the policy is available before the FIDO2 ceremony fires.
 * This is the data source layer for the rest of the Permissions Policy machinery
 * and is parser-independent — it stores the raw header string(s), and the parser
 * is invoked lazily when consumers ask for a structured view.
 *
 * Lifecycle: the cache is in-memory only. Behavior differs by extension manifest:
 *   - MV3 (Chrome/Edge, MV3 Safari): the background runs in a service worker that
 *     can terminate when idle. When it restarts, the cache is empty. Subsequent
 *     navigations repopulate it.
 *   - MV2 (Firefox today): the background is a persistent page that lives for the
 *     browser session, so the cache effectively persists until browser close.
 * In either case, consumers fall back to the document's content-script gate
 * (defense-in-depth from PM-37768) when no entry is cached.
 *
 * Cross-browser notes:
 * - Safari 18.4+ supports `extraInfoSpec: ["responseHeaders"]`. On older Safari,
 *   the listener still registers but never receives headers, so the cache stays
 *   empty and the system degrades to the content-script gate.
 * - Firefox and Chromium fully support this path.
 */
// Match the listener signature that `chrome.webRequest.onHeadersReceived.addListener`
// expects. The return type is `BlockingResponse | undefined` rather than `void`, so
// we always return `undefined` explicitly.
type OnHeadersReceivedListener = (
  details: chrome.webRequest.OnHeadersReceivedDetails,
) => chrome.webRequest.BlockingResponse | undefined;

export class PermissionsPolicyHeaderCacheBackground {
  private readonly cache = new Map<string, string>();
  private handleHeadersReceived?: OnHeadersReceivedListener;
  private handleTabRemoved?: (tabId: number) => void;

  constructor(
    private readonly webRequest: typeof chrome.webRequest,
    private readonly tabs: typeof chrome.tabs,
  ) {}

  /**
   * Begins listening for response headers and tab removals. Safe to call more
   * than once; subsequent calls are no-ops.
   */
  startListening(): void {
    if (this.handleHeadersReceived != null) {
      return;
    }

    this.handleHeadersReceived = (details) => {
      this.recordHeaders(details);
      return undefined;
    };
    this.webRequest.onHeadersReceived.addListener(
      this.handleHeadersReceived,
      { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
      ["responseHeaders"],
    );

    this.handleTabRemoved = (tabId) => this.clearTab(tabId);
    this.tabs.onRemoved.addListener(this.handleTabRemoved);
  }

  /**
   * Removes registered listeners. Intended for tests and for explicit teardown
   * in test harnesses; the background service worker doesn't otherwise need to
   * stop listening.
   */
  stopListening(): void {
    if (this.handleHeadersReceived != null) {
      this.webRequest.onHeadersReceived.removeListener(this.handleHeadersReceived);
      this.handleHeadersReceived = undefined;
    }
    if (this.handleTabRemoved != null) {
      this.tabs.onRemoved.removeListener(this.handleTabRemoved);
      this.handleTabRemoved = undefined;
    }
  }

  /**
   * Returns the combined raw `Permissions-Policy` header value for the given
   * frame, or `undefined` when no header was observed. An undefined return means
   * the spec's default allowlists apply — consumers should not treat it as a deny.
   */
  getRawHeader(tabId: number, frameId: number): string | undefined {
    return this.cache.get(this.key(tabId, frameId));
  }

  /**
   * Drops the cache entry for a specific frame. Useful for tests; in normal
   * operation, new headers from a navigation overwrite the previous entry and
   * tab close clears everything for the tab.
   */
  invalidate(tabId: number, frameId: number): void {
    this.cache.delete(this.key(tabId, frameId));
  }

  /**
   * Returns the number of cached entries. Exposed for tests; not part of the
   * stable consumer API.
   */
  size(): number {
    return this.cache.size;
  }

  private recordHeaders(details: chrome.webRequest.OnHeadersReceivedDetails): void {
    // Non-tab requests (e.g. service-worker initiated fetches, prerender frames
    // that aren't yet bound to a tab) report tabId === -1 and aren't relevant.
    if (details.tabId < 0) {
      return;
    }

    const key = this.key(details.tabId, details.frameId);
    const headerValues = (details.responseHeaders ?? [])
      .filter((header) => header.name.toLowerCase() === "permissions-policy")
      .map((header) => header.value)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    if (headerValues.length === 0) {
      // New navigation for this frame with no Permissions-Policy header. Drop
      // any stale entry so consumers fall back to the spec's default allowlists.
      this.cache.delete(key);
      return;
    }

    // Per RFC 8941 §3.1, multiple instances of a header field combine as a
    // single value with `, ` between them. The parser expects this concatenated
    // form.
    this.cache.set(key, headerValues.join(", "));
  }

  private clearTab(tabId: number): void {
    const prefix = `${tabId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  private key(tabId: number, frameId: number): string {
    return `${tabId}:${frameId}`;
  }
}
