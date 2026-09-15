import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { IPC_CONTENT_SCRIPT_PORT_NAME } from "../ipc-content-script-port-name";

import { DESTINATION_UNREACHABLE_ERROR } from "./errors";
import { WebIpcTransport } from "./web-ipc.transport";

jest.mock("@bitwarden/sdk-internal", () => ({
  // Capture the constructor arguments so tests can assert the source is derived from the
  // browser-provided sender rather than the message body.
  IncomingMessage: jest.fn().mockImplementation((payload, destination, source, topic) => ({
    payload,
    destination,
    source,
    topic,
  })),
}));

interface FakePort {
  name: string;
  sender?: chrome.runtime.MessageSender;
  postMessage: jest.Mock;
  disconnect: jest.Mock;
  onMessage: { addListener: jest.Mock; emit: (message: unknown) => void };
  onDisconnect: { addListener: jest.Mock; emit: () => void };
}

function createFakePort(name: string, sender?: chrome.runtime.MessageSender): FakePort {
  const messageListeners: ((message: unknown) => void)[] = [];
  const disconnectListeners: (() => void)[] = [];
  return {
    name,
    sender,
    postMessage: jest.fn(),
    disconnect: jest.fn(),
    onMessage: {
      addListener: jest.fn((cb) => messageListeners.push(cb)),
      emit: (message) => messageListeners.forEach((cb) => cb(message)),
    },
    onDisconnect: {
      addListener: jest.fn((cb) => disconnectListeners.push(cb)),
      emit: () => disconnectListeners.forEach((cb) => cb()),
    },
  };
}

function webDestination(tabId: number, documentId: string) {
  return { Web: { tab_id: tabId, document_id: documentId, origin: "" } };
}

describe("WebIpcTransport", () => {
  let logService: MockProxy<LogService>;
  let receive: jest.Mock;
  let connectListener: (port: chrome.runtime.Port) => void;
  let transport: WebIpcTransport;

  beforeEach(() => {
    jest.clearAllMocks();
    logService = mock<LogService>();
    receive = jest.fn();

    (globalThis as any).chrome = {
      runtime: {
        onConnect: {
          addListener: jest.fn((cb) => {
            connectListener = cb;
          }),
        },
      },
      tabs: { TAB_ID_NONE: -1 },
    };

    transport = new WebIpcTransport(logService, receive);
    transport.init();
  });

  function connect(port: FakePort) {
    connectListener(port as unknown as chrome.runtime.Port);
  }

  const sender = (
    tabId: number | undefined,
    documentId: string | undefined,
    origin = "https://page.example",
  ): chrome.runtime.MessageSender =>
    ({
      tab: tabId === undefined ? undefined : { id: tabId },
      documentId,
      origin,
    }) as chrome.runtime.MessageSender;

  describe("handleConnect", () => {
    it("ignores ports with a different name", () => {
      const port = createFakePort("some-other-port", sender(1, "doc-1"));
      connect(port);

      expect(port.onMessage.addListener).not.toHaveBeenCalled();
    });

    it("ignores connections without a tab", () => {
      const port = createFakePort(IPC_CONTENT_SCRIPT_PORT_NAME, sender(undefined, "doc-1"));
      connect(port);

      expect(port.onMessage.addListener).not.toHaveBeenCalled();
    });

    it("ignores connections without a documentId and warns", () => {
      const port = createFakePort(IPC_CONTENT_SCRIPT_PORT_NAME, sender(1, undefined));
      connect(port);

      expect(port.onMessage.addListener).not.toHaveBeenCalled();
      expect(logService.warning).toHaveBeenCalled();
    });
  });

  describe("incoming messages", () => {
    it("forwards a BrowserBackground message with the source taken from the port sender", () => {
      const port = createFakePort(
        IPC_CONTENT_SCRIPT_PORT_NAME,
        sender(7, "doc-7", "https://page.example"),
      );
      connect(port);

      port.onMessage.emit({
        type: "bitwarden-ipc-message",
        message: { destination: { BrowserBackground: undefined }, payload: [1, 2], topic: "t" },
        // Forged provenance a page might try to smuggle in the body.
        command: "unlockCompleted",
        data: { commandToRetry: { sender: { tab: { id: 999 } } } },
      });

      expect(receive).toHaveBeenCalledTimes(1);
      expect(IncomingMessage).toHaveBeenCalledWith(
        new Uint8Array([1, 2]),
        { BrowserBackground: undefined },
        { Web: { tab_id: 7, document_id: "doc-7", origin: "https://page.example" } },
        "t",
      );
    });

    it("ignores messages that are not IPC messages", () => {
      const port = createFakePort(IPC_CONTENT_SCRIPT_PORT_NAME, sender(1, "doc-1"));
      connect(port);

      port.onMessage.emit({ command: "unlockCompleted" });

      expect(receive).not.toHaveBeenCalled();
    });

    it("ignores IPC messages not destined for BrowserBackground", () => {
      const port = createFakePort(IPC_CONTENT_SCRIPT_PORT_NAME, sender(1, "doc-1"));
      connect(port);

      port.onMessage.emit({
        type: "bitwarden-ipc-message",
        message: { destination: { Web: {} }, payload: [], topic: undefined },
      });

      expect(receive).not.toHaveBeenCalled();
    });
  });

  describe("send", () => {
    const outgoing = (tabId: number, documentId: string): OutgoingMessage =>
      ({
        destination: webDestination(tabId, documentId),
        payload: new Uint8Array([9]),
        topic: "t",
      }) as unknown as OutgoingMessage;

    it("delivers to the port registered for the destination document", async () => {
      const port = createFakePort(IPC_CONTENT_SCRIPT_PORT_NAME, sender(3, "doc-3"));
      connect(port);

      await transport.send(outgoing(3, "doc-3"));

      expect(port.postMessage).toHaveBeenCalledWith({
        type: "bitwarden-ipc-message",
        message: { destination: webDestination(3, "doc-3"), payload: [9], topic: "t" },
      });
    });

    it("throws when no port is registered for the destination document", async () => {
      await expect(transport.send(outgoing(3, "doc-missing"))).rejects.toThrow(
        DESTINATION_UNREACHABLE_ERROR,
      );
    });

    it("throws when the registered port belongs to a different tab", async () => {
      const port = createFakePort(IPC_CONTENT_SCRIPT_PORT_NAME, sender(3, "doc-3"));
      connect(port);

      await expect(transport.send(outgoing(4, "doc-3"))).rejects.toThrow(
        DESTINATION_UNREACHABLE_ERROR,
      );
    });

    it("throws for non-Web destinations", async () => {
      await expect(
        transport.send({ destination: "DesktopMain" } as unknown as OutgoingMessage),
      ).rejects.toThrow("Destination not supported.");
    });

    it("stops delivering after the port disconnects", async () => {
      const port = createFakePort(IPC_CONTENT_SCRIPT_PORT_NAME, sender(3, "doc-3"));
      connect(port);
      port.onDisconnect.emit();

      await expect(transport.send(outgoing(3, "doc-3"))).rejects.toThrow(
        DESTINATION_UNREACHABLE_ERROR,
      );
    });
  });
});
