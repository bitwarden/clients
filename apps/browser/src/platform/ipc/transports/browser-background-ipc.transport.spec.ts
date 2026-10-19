import { IpcMessage } from "@bitwarden/common/platform/ipc";
import { IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { BrowserBackgroundIpcTransport } from "./browser-background-ipc.transport";
import {
  FOREGROUND_IPC_PORT_NAME,
  FOREGROUND_IPC_WAKE_PORT_NAME,
} from "./browser-foreground-ipc.transport";
import { DESTINATION_UNREACHABLE_ERROR } from "./errors";

function createPort() {
  const messageListeners: ((message: unknown) => void)[] = [];
  const disconnectListeners: (() => void)[] = [];
  const port = {
    postMessage: jest.fn(),
    onMessage: { addListener: jest.fn((listener) => messageListeners.push(listener)) },
    onDisconnect: { addListener: jest.fn((listener) => disconnectListeners.push(listener)) },
  } as unknown as chrome.runtime.Port;
  return {
    port,
    emit: (message: unknown) => messageListeners.forEach((listener) => listener(message)),
    disconnect: () => disconnectListeners.forEach((listener) => listener()),
  };
}

function createIncomingPort(name: string) {
  return { name, disconnect: jest.fn() } as unknown as chrome.runtime.Port;
}

const toBackground = {
  destination: { BrowserBackground: { id: "Own" } },
  payload: new Uint8Array([1, 2]),
  topic: "topic",
} as OutgoingMessage;

describe("BrowserBackgroundIpcTransport", () => {
  const receive = jest.fn<void, [IncomingMessage]>();
  let transport: BrowserBackgroundIpcTransport;
  let ports: ReturnType<typeof createPort>[];

  beforeEach(() => {
    jest.clearAllMocks();
    ports = [];
    (chrome.runtime.connect as jest.Mock).mockImplementation(() => {
      const port = createPort();
      ports.push(port);
      return port.port;
    });
    transport = new BrowserBackgroundIpcTransport(receive);
  });

  const incomingConnect = (port: chrome.runtime.Port) => {
    const onConnect = (chrome.runtime.onConnect.addListener as jest.Mock).mock.calls[0][0];
    onConnect(port);
  };

  it("connects on init", () => {
    transport.init();

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: FOREGROUND_IPC_PORT_NAME });
  });

  it("reuses the port opened by init when sending", async () => {
    transport.init();

    await transport.send(toBackground);

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
    expect(ports[0].port.postMessage).toHaveBeenCalled();
  });

  it("reconnects when woken by the background after a disconnect", () => {
    transport.init();
    ports[0].disconnect();
    const wakePort = createIncomingPort(FOREGROUND_IPC_WAKE_PORT_NAME);

    incomingConnect(wakePort);

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
    expect(chrome.runtime.connect).toHaveBeenLastCalledWith({ name: FOREGROUND_IPC_PORT_NAME });
    expect(wakePort.disconnect).toHaveBeenCalled();
  });

  it("keeps the existing port when woken while connected", () => {
    transport.init();
    const wakePort = createIncomingPort(FOREGROUND_IPC_WAKE_PORT_NAME);

    incomingConnect(wakePort);

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
    expect(wakePort.disconnect).toHaveBeenCalled();
  });

  it("ignores unrelated incoming ports", () => {
    transport.init();
    ports[0].disconnect();
    const otherPort = createIncomingPort("session");

    incomingConnect(otherPort);

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
    expect(otherPort.disconnect).not.toHaveBeenCalled();
  });

  it("connects on first send and reuses the port", async () => {
    expect(chrome.runtime.connect).not.toHaveBeenCalled();

    await transport.send(toBackground);
    await transport.send(toBackground);

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: FOREGROUND_IPC_PORT_NAME });
    expect(ports[0].port.postMessage).toHaveBeenCalledWith({
      type: "bitwarden-ipc-message",
      message: {
        destination: { BrowserBackground: { id: "Own" } },
        payload: [1, 2],
        topic: "topic",
      },
    } satisfies IpcMessage);
  });

  it("labels incoming messages as coming from the background", async () => {
    await transport.send(toBackground);

    ports[0].emit({
      type: "bitwarden-ipc-message",
      message: { destination: { BrowserForeground: { id: 3 } }, payload: [9], topic: "topic" },
    });

    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive.mock.calls[0][0].source).toEqual({ BrowserBackground: { id: "Own" } });
    expect(receive.mock.calls[0][0].payload).toEqual(new Uint8Array([9]));
  });

  it("ignores messages not addressed to a foreground", async () => {
    await transport.send(toBackground);

    ports[0].emit({
      type: "bitwarden-ipc-message",
      message: { destination: "DesktopMain", payload: [9], topic: "topic" },
    });

    expect(receive).not.toHaveBeenCalled();
  });

  it("reconnects on the next send after a disconnect", async () => {
    await transport.send(toBackground);

    ports[0].disconnect();
    await transport.send(toBackground);

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
    expect(ports[1].port.postMessage).toHaveBeenCalled();
  });

  it("throws unreachable when posting fails", async () => {
    (chrome.runtime.connect as jest.Mock).mockImplementationOnce(() => {
      const port = createPort();
      (port.port.postMessage as jest.Mock).mockImplementation(() => {
        throw new Error("Attempting to use a disconnected port object");
      });
      return port.port;
    });

    await expect(transport.send(toBackground)).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
    await transport.send(toBackground);

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
  });
});
