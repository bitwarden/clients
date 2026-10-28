import { Observable, map } from "rxjs";

import { fromChromeEvent } from "../../platform/browser/from-chrome-event";

/**
 * Typed, payload-projecting wrappers over the Chrome tab and window events the autofill background
 * consumes, built on the platform {@link fromChromeEvent} primitive.
 *
 * Each factory returns a fresh cold, unicast stream: every subscription registers its own listener,
 * so N subscribers add N listeners. The streams never complete; unsubscription is the only teardown.
 * Error propagation on `chrome.runtime.lastError` is inherited from {@link fromChromeEvent}.
 *
 * Single-argument events pass their argument through; multi-argument events merge into one object,
 * so `(tabId, info)` becomes `{ tabId, ...info }`.
 */

/** Emits `{ tabId, windowId }` each time a tab becomes active in a window (`chrome.tabs.onActivated`). */
export const tabActivated$ = (): Observable<chrome.tabs.OnActivatedInfo> =>
  fromChromeEvent(chrome.tabs.onActivated).pipe(map(([activeInfo]) => activeInfo));

/** Emits the created `Tab` each time a tab is opened (`chrome.tabs.onCreated`). */
export const tabCreated$ = (): Observable<chrome.tabs.Tab> =>
  fromChromeEvent(chrome.tabs.onCreated).pipe(map(([tab]) => tab));

/** Emits `{ tabId, isWindowClosing, windowId }` each time a tab is closed (`chrome.tabs.onRemoved`). */
export const tabRemoved$ = (): Observable<{ tabId: number } & chrome.tabs.OnRemovedInfo> =>
  fromChromeEvent(chrome.tabs.onRemoved).pipe(
    map(([tabId, removeInfo]) => ({ tabId, ...removeInfo })),
  );

/**
 * Emits `{ tabId, newWindowId, newPosition }` each time a tab is attached to a window
 * (`chrome.tabs.onAttached`) — e.g. dragged between windows. Pairs with {@link tabDetached$}.
 */
export const tabAttached$ = (): Observable<{ tabId: number } & chrome.tabs.OnAttachedInfo> =>
  fromChromeEvent(chrome.tabs.onAttached).pipe(
    map(([tabId, attachInfo]) => ({ tabId, ...attachInfo })),
  );

/**
 * Emits `{ tabId, oldWindowId, oldPosition }` each time a tab is detached from a window
 * (`chrome.tabs.onDetached`). Pairs with {@link tabAttached$}.
 */
export const tabDetached$ = (): Observable<{ tabId: number } & chrome.tabs.OnDetachedInfo> =>
  fromChromeEvent(chrome.tabs.onDetached).pipe(
    map(([tabId, detachInfo]) => ({ tabId, ...detachInfo })),
  );

/**
 * Emits the newly-focused window id each time window focus changes
 * (`chrome.windows.onFocusChanged`).
 *
 * `chrome.windows.WINDOW_ID_NONE` (`-1`) is passed through unfiltered. It usually means focus left
 * the browser entirely, but some Linux window managers emit it spuriously immediately before a
 * switch from one Chrome window to another — so treat a lone `-1` as advisory, not a definitive
 * blur. Consumers own how to interpret it.
 */
export const windowFocusChanged$ = (): Observable<number> =>
  fromChromeEvent(chrome.windows.onFocusChanged).pipe(map(([windowId]) => windowId));

/** Emits the closed window's id each time a window is removed (`chrome.windows.onRemoved`). */
export const windowRemoved$ = (): Observable<number> =>
  fromChromeEvent(chrome.windows.onRemoved).pipe(map(([windowId]) => windowId));
