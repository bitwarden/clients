import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcMessage } from "@bitwarden/common/platform/ipc";
import { Endpoint, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import {
  BrowserForegroundIpcTransport,
  FOREGROUND_IPC_PORT_NAME,
} from "./browser-foreground-ipc.transport";
import { DESTINATION_UNREACHABLE_ERROR } from "./errors";

function createPort(name = FOREGROUND_IPC_PORT_NAME, origin = "chrome-extension://id") {
  const messageListeners: ((message: unknown) => void)[] = [];
  const disconnectListeners: (() => void)[] = [];
  const port = {
    name,
    sender: { origin },
    postMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn((listener) => messageListeners.push(listener)),
      removeListener: jest.fn(),
    },
    onDisconnect: { addListener: jest.fn((listener) => disconnectListeners.push(listener)) },
  } as unknown as chrome.runtime.Port;
  return {
    port,
    emit: (message: unknown) => messageListeners.forEach((listener) => listener(message)),
    disconnect: () => disconnectListeners.forEach((listener) => listener()),
  };
}

function ipcMessage(destination: unknown, payload = [1, 2, 3]): IpcMessage {
  return {
    type: "bitwarden-ipc-message",
    message: { destination, payload, topic: "topic" },
  } as IpcMessage;
}

describe("BrowserForegroundIpcTransport", () => {
  const logService = mock<LogService>();
  const receive = jest.fn<void, [IncomingMessage]>();
  const onDisconnect = jest.fn<void, [Endpoint]>();
  let transport: BrowserForegroundIpcTransport;

  const connect = (port: chrome.runtime.Port) => {
    const onConnect = (chrome.runtime.onConnect.addListener as jest.Mock).mock.calls[0][0];
    onConnect(port);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transport = new BrowserForegroundIpcTransport(logService, receive, onDisconnect);
    transport.init();
  });

  it("assigns each port a new id and stamps it as the source", () => {
    transport.start();
    const first = createPort();
    const second = createPort();
    connect(first.port);
    connect(second.port);

    first.emit(ipcMessage({ BrowserBackground: { id: "Own" } }));
    second.emit(ipcMessage({ BrowserBackground: { id: "Own" } }));

    expect(receive.mock.calls[0][0].source).toEqual({ BrowserForeground: { id: 1 } });
    expect(receive.mock.calls[1][0].source).toEqual({ BrowserForeground: { id: 2 } });
    expect(receive.mock.calls[0][0].payload).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("does not reuse the id of a disconnected port", () => {
    transport.start();
    const first = createPort();
    connect(first.port);
    first.disconnect();
    const second = createPort();
    connect(second.port);

    second.emit(ipcMessage({ BrowserBackground: { id: "Own" } }));

    expect(receive.mock.calls[0][0].source).toEqual({ BrowserForeground: { id: 2 } });
  });

  it("holds messages until started", () => {
    const { port, emit } = createPort();
    connect(port);
    emit(ipcMessage({ BrowserBackground: { id: "Own" } }));

    expect(receive).not.toHaveBeenCalled();

    transport.start();

    expect(receive).toHaveBeenCalledTimes(1);
  });

  it("ignores ports with another name", () => {
    const { port } = createPort("other-port");
    connect(port);

    expect(port.onMessage.addListener).not.toHaveBeenCalled();
  });

  it("ignores ports from non-extension senders", () => {
    const { port } = createPort(FOREGROUND_IPC_PORT_NAME, "https://example.com");
    connect(port);

    expect(port.onMessage.addListener).not.toHaveBeenCalled();
  });

  it("ignores messages not addressed to the background", () => {
    transport.start();
    const { port, emit } = createPort();
    connect(port);

    emit(ipcMessage({ Web: { tab_id: 1, document_id: "doc" } }));
    emit({ command: "something" });

    expect(receive).not.toHaveBeenCalled();
  });

  it("sends to the port for the destination id", async () => {
    const { port } = createPort();
    connect(port);

    await transport.send({
      destination: { BrowserForeground: { id: 1 } },
      payload: new Uint8Array([4, 5]),
      topic: "topic",
    } as OutgoingMessage);

    expect(port.postMessage).toHaveBeenCalledWith(
      ipcMessage({ BrowserForeground: { id: 1 } }, [4, 5]),
    );
  });

  it("throws unreachable for unknown ids", async () => {
    await expect(
      transport.send({
        destination: { BrowserForeground: { id: 7 } },
        payload: new Uint8Array(),
      } as OutgoingMessage),
    ).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
  });

  it("removes the port and reports its endpoint on disconnect", async () => {
    const { port, disconnect } = createPort();
    connect(port);

    disconnect();

    expect(onDisconnect).toHaveBeenCalledWith({ BrowserForeground: { id: 1 } });
    await expect(
      transport.send({
        destination: { BrowserForeground: { id: 1 } },
        payload: new Uint8Array(),
      } as OutgoingMessage),
    ).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
  });
});
