import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Message } from "@bitwarden/common/platform/messaging";
// eslint-disable-next-line no-restricted-imports -- applies the tag an ingest boundary applies
import { tagAsExternal } from "@bitwarden/common/platform/messaging/internal";

import { BrowserApi } from "../../platform/browser/browser-api";
import {
  LockedVaultPendingNotificationsData,
  RETRY_SENDER,
} from "../background/abstractions/notification.background";

export function triggerTestFailure() {
  expect(true).toBe("Test has failed.");
}

const scheduler = typeof setImmediate === "function" ? setImmediate : setTimeout;
export function flushPromises() {
  return new Promise(function (resolve) {
    scheduler(resolve);
  });
}

/**
 * Applies the tag that `fromChromeRuntimeMessaging` stamps on a message as it crosses into this
 * context, so a test can hand a consumer something indistinguishable from a foreign message.
 */
export function tagAsExternalMessage<T extends Message<Record<string, unknown>>>(message: T): T {
  // `tagAsExternal` is an rxjs operator, so it is applied through a synchronous stream. It tags in
  // place, which is why the original object comes back tagged.
  of(message).pipe(tagAsExternal()).subscribe();
  return message;
}

/**
 * Returns the retry a consumer would receive from another context: the same payload minus its
 * {@link RETRY_SENDER}, which no serializer copies.
 *
 * Asserts that everything else made the trip, so a consumer that then does nothing did so
 * because the sender is missing rather than because the payload arrived empty. Keep fixtures
 * JSON-safe — `jest-mock-extended` proxies serialize to nothing.
 *
 * Pairs with {@link tagAsExternalMessage}: a genuinely foreign retry is both tagged at ingest
 * and stripped of its sender. Use whichever guard is under test, or both.
 */
export function crossContextBoundary(
  retry: LockedVaultPendingNotificationsData,
): LockedVaultPendingNotificationsData {
  // JSON stands in for the real boundary because `structuredClone` is absent from this Jest
  // environment. It is strictly more destructive, so it can only under-report a surviving
  // property.
  // FIXME: Once the environment includes `structuredClone`, replace the JSON processing with it.
  const crossed = JSON.parse(JSON.stringify(retry)) as LockedVaultPendingNotificationsData;

  expect(crossed.target).toBe(retry.target);
  expect(crossed.commandToRetry.message).toEqual(retry.commandToRetry.message);
  expect(crossed.commandToRetry[RETRY_SENDER]).toBeUndefined();

  return crossed;
}

export function postWindowMessage(
  data: any,
  origin: string = BrowserApi.getRuntimeURL("")?.slice(0, -1),
  source: Window | MessageEventSource | null = window,
) {
  globalThis.dispatchEvent(new MessageEvent("message", { data, origin, source }));
}

export function sendMockExtensionMessage(
  message: any,
  sender?: chrome.runtime.MessageSender,
  sendResponse?: CallableFunction,
) {
  (chrome.runtime.onMessage.addListener as unknown as jest.SpyInstance).mock.calls.forEach(
    (call) => {
      const callback = call[0];
      callback(
        message || {},
        sender || mock<chrome.runtime.MessageSender>(),
        sendResponse || jest.fn(),
      );
    },
  );
}

export function triggerRuntimeOnConnectEvent(port: chrome.runtime.Port) {
  (chrome.runtime.onConnect.addListener as unknown as jest.SpyInstance).mock.calls.forEach(
    (call) => {
      const callback = call[0];
      callback(port);
    },
  );
}

export function sendPortMessage(port: chrome.runtime.Port, message: any) {
  (port.onMessage.addListener as unknown as jest.SpyInstance).mock.calls.forEach((call) => {
    const callback = call[0];
    callback(message || {}, port);
  });
}

export function triggerPortOnConnectEvent(port: chrome.runtime.Port) {
  (chrome.runtime.onConnect.addListener as unknown as jest.SpyInstance).mock.calls.forEach(
    (call) => {
      const callback = call[0];
      callback(port);
    },
  );
}

export function triggerPortOnMessageEvent(port: chrome.runtime.Port, message: any) {
  (port.onMessage.addListener as unknown as jest.SpyInstance).mock.calls.forEach((call) => {
    const callback = call[0];
    callback(message, port);
  });
}

export function triggerPortOnDisconnectEvent(port: chrome.runtime.Port) {
  (port.onDisconnect.addListener as unknown as jest.SpyInstance).mock.calls.forEach((call) => {
    const callback = call[0];
    callback(port);
  });
}

export function triggerWindowOnFocusedChangedEvent(windowId: number) {
  (chrome.windows.onFocusChanged.addListener as unknown as jest.SpyInstance).mock.calls.forEach(
    (call) => {
      const callback = call[0];
      callback(windowId);
    },
  );
}

export function triggerTabOnActivatedEvent(activeInfo: chrome.tabs.OnActivatedInfo) {
  (chrome.tabs.onActivated.addListener as unknown as jest.SpyInstance).mock.calls.forEach(
    (call) => {
      const callback = call[0];
      callback(activeInfo);
    },
  );
}

export function triggerTabOnReplacedEvent(addedTabId: number, removedTabId: number) {
  (chrome.tabs.onReplaced.addListener as unknown as jest.SpyInstance).mock.calls.forEach((call) => {
    const callback = call[0];
    callback(addedTabId, removedTabId);
  });
}

export function triggerTabOnUpdatedEvent(
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab,
) {
  (chrome.tabs.onUpdated.addListener as unknown as jest.SpyInstance).mock.calls.forEach((call) => {
    const callback = call[0];
    callback(tabId, changeInfo, tab);
  });
}

export function triggerTabOnRemovedEvent(tabId: number, removeInfo: chrome.tabs.OnRemovedInfo) {
  (chrome.tabs.onRemoved.addListener as unknown as jest.SpyInstance).mock.calls.forEach((call) => {
    const callback = call[0];
    callback(tabId, removeInfo);
  });
}

export function triggerOnAlarmEvent(alarm: chrome.alarms.Alarm) {
  (chrome.alarms.onAlarm.addListener as unknown as jest.SpyInstance).mock.calls.forEach((call) => {
    const callback = call[0];
    callback(alarm);
  });
}

export function triggerWebNavigationOnCommittedEvent(
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
) {
  (chrome.webNavigation.onCommitted.addListener as unknown as jest.SpyInstance).mock.calls.forEach(
    (call) => {
      const callback = call[0];
      callback(details);
    },
  );
}

export function triggerWebNavigationOnCompletedEvent(
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
) {
  (chrome.webNavigation.onCompleted.addListener as unknown as jest.SpyInstance).mock.calls.forEach(
    (call) => {
      const callback = call[0];
      callback(details);
    },
  );
}

export function triggerWebRequestOnBeforeRequestEvent(
  details: chrome.webRequest.WebRequestDetails,
) {
  (chrome.webRequest.onBeforeRequest.addListener as unknown as jest.SpyInstance).mock.calls.forEach(
    (call) => {
      const callback = call[0];
      callback(details);
    },
  );
}

export function triggerWebRequestOnBeforeRedirectEvent(
  details: chrome.webRequest.WebRequestDetails,
) {
  (
    chrome.webRequest.onBeforeRedirect.addListener as unknown as jest.SpyInstance
  ).mock.calls.forEach((call) => {
    const callback = call[0];
    callback(details);
  });
}

export function triggerWebRequestOnCompletedEvent(details: chrome.webRequest.OnCompletedDetails) {
  (chrome.webRequest.onCompleted.addListener as unknown as jest.SpyInstance).mock.calls.forEach(
    (call) => {
      const callback = call[0];
      callback(details);
    },
  );
}

export function mockQuerySelectorAllDefinedCall() {
  const originalDocumentQuerySelectorAll = document.querySelectorAll;
  globalThis.document.querySelectorAll = function (selector: string) {
    return originalDocumentQuerySelectorAll.call(
      document,
      selector === ":defined" ? "*" : selector,
    );
  };

  const originalShadowRootQuerySelectorAll = ShadowRoot.prototype.querySelectorAll;
  ShadowRoot.prototype.querySelectorAll = function (selector: string) {
    return originalShadowRootQuerySelectorAll.call(this, selector === ":defined" ? "*" : selector);
  };

  const originalElementQuerySelectorAll = Element.prototype.querySelectorAll;
  Element.prototype.querySelectorAll = function (selector: string) {
    return originalElementQuerySelectorAll.call(this, selector === ":defined" ? "*" : selector);
  };

  return {
    mockRestore: () => {
      document.querySelectorAll = originalDocumentQuerySelectorAll;
      ShadowRoot.prototype.querySelectorAll = originalShadowRootQuerySelectorAll;
      Element.prototype.querySelectorAll = originalElementQuerySelectorAll;
    },
  };
}
