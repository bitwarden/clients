import { mock, mockDeep } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { BrowserApi } from "../browser/browser-api";

import { BackgroundMemoryStorageService } from "./background-memory-storage.service";

describe("BackgroundMemoryStorageService connection validation", () => {
  const runtimeId = "test-extension";
  const legacySender = { id: runtimeId, origin: "null" };
  const originalSafariApi = BrowserApi.isSafariApi;
  const originalId = Object.getOwnPropertyDescriptor(chrome.runtime, "id");
  let storage: BackgroundMemoryStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    BrowserApi.isSafariApi = true;
    Object.defineProperty(chrome.runtime, "id", { configurable: true, value: runtimeId });
    jest.spyOn(BrowserApi, "isManifestVersion").mockImplementation((version) => version === 2);
    jest.spyOn(BrowserApi, "isBackgroundPage").mockReturnValue(true);
    storage = new BackgroundMemoryStorageService(mock<LogService>());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    BrowserApi.isSafariApi = originalSafariApi;
    if (originalId) {
      Object.defineProperty(chrome.runtime, "id", originalId);
    } else {
      delete (chrome.runtime as { id?: string }).id;
    }
  });

  function connect(sender: chrome.runtime.MessageSender | undefined, name = "session") {
    const port = mockDeep<chrome.runtime.Port>();
    port.name = name;
    port.sender = sender;
    const listeners = jest.mocked(chrome.runtime.onConnect.addListener).mock.calls;
    listeners[listeners.length - 1][0](port);
    return port;
  }

  it("initializes the observed Safari 17 popup connection and answers its storage request", async () => {
    await storage.save("test-key", "test-value");
    const port = connect(legacySender);

    expect(port.postMessage).toHaveBeenCalledWith({
      action: "initialization",
      data: ["test-key"],
      originator: "background",
    });
    const listener = jest.mocked(port.onMessage.addListener).mock.calls[0][0];
    await listener(
      { id: "request", action: "get", key: "test-key", originator: "foreground" },
      port,
    );
    expect(port.postMessage).toHaveBeenLastCalledWith({
      id: "request",
      key: "test-key",
      data: JSON.stringify("test-value"),
      originator: "background",
    });
  });

  it("preserves acceptance of normally validated extension senders", () => {
    const port = connect({ origin: chrome.runtime.getURL("") });
    expect(port.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing sender", undefined],
    ["missing ID", { origin: "null" }],
    ["empty ID", { id: "", origin: "null" }],
    ["foreign extension", { ...legacySender, id: "other-extension" }],
    ["missing origin", { id: runtimeId }],
    ["actual null origin", { ...legacySender, origin: null }],
    ["foreign origin", { ...legacySender, origin: "https://example.com" }],
    ["tab sender", { ...legacySender, tab: { id: 1 } }],
    ["present but undefined tab", { ...legacySender, tab: undefined }],
    ["top-level content script", { ...legacySender, frameId: 0 }],
    ["subframe", { ...legacySender, frameId: 1 }],
    ["present but undefined frame", { ...legacySender, frameId: undefined }],
    ["foreign URL", { ...legacySender, url: "https://example.com" }],
    ["present but undefined URL", { ...legacySender, url: undefined }],
    ["additional document metadata", { ...legacySender, documentId: "document" }],
    ["unknown sender metadata", { ...legacySender, unexpected: true }],
  ])("rejects %s without registering a storage receiver", (_name, sender) => {
    const port = connect(sender as chrome.runtime.MessageSender | undefined);
    expect(port.onMessage.addListener).not.toHaveBeenCalled();
    expect(port.onDisconnect.addListener).not.toHaveBeenCalled();
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it("rejects the legacy metadata outside Safari", () => {
    BrowserApi.isSafariApi = false;
    expect(connect(legacySender).onMessage.addListener).not.toHaveBeenCalled();
  });

  it("rejects the legacy metadata outside Manifest V2", () => {
    jest.mocked(BrowserApi.isManifestVersion).mockReturnValue(false);
    expect(connect(legacySender).onMessage.addListener).not.toHaveBeenCalled();
  });

  it("does not enable other port names", () => {
    expect(connect(legacySender, "other-port").onMessage.addListener).not.toHaveBeenCalled();
  });
});
