import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IncomingMessage } from "@bitwarden/sdk-internal";

import { WebIpcTransport } from "./web-ipc.transport";

const message = {
  type: "bitwarden-ipc-message",
  message: { destination: { BrowserBackground: { id: "Own" } }, payload: [1], topic: "topic" },
};

describe("WebIpcTransport", () => {
  const receive = jest.fn<void, [IncomingMessage]>();

  const emit = (sender: Partial<chrome.runtime.MessageSender>) => {
    const listener = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls[0][0];
    listener(message, sender);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    new WebIpcTransport(mock<LogService>(), receive).init();
  });

  it("labels web page senders as Web", () => {
    emit({ tab: { id: 5 } as chrome.tabs.Tab, documentId: "doc", origin: "https://vault.test" });

    expect(receive.mock.calls[0][0].source).toEqual({
      Web: { tab_id: 5, document_id: "doc", origin: "https://vault.test" },
    });
  });

  it("ignores extension pages open in tabs", () => {
    emit({ tab: { id: 5 } as chrome.tabs.Tab, documentId: "doc", origin: "chrome-extension://id" });

    expect(receive).not.toHaveBeenCalled();
  });
});
