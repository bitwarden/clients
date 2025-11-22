import { mock } from "jest-mock-extended";

import { BrowserApi } from "../../platform/browser/browser-api";

export function triggerTestFailure() {
  expect(true).toBe("Test has failed.");
}

const scheduler = typeof setImmediate === "function" ? setImmediate : setTimeout;
export function flushPromises() {
  return new Promise(function (resolve) {
    scheduler(resolve);
  });
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
