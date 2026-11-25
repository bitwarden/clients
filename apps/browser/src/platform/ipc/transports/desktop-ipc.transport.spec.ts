import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  IncomingMessage,
  IpcClient,
  ipcRequestDiscover,
  OutgoingMessage,
} from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

import { DesktopIpcTransport } from "./desktop-ipc.transport";
import { DESTINATION_UNREACHABLE_ERROR } from "./errors";

jest.mock("@bitwarden/sdk-internal", () => ({
  IncomingMessage: jest.fn(),
  ipcRequestDiscover: jest.fn(),
}));

jest.mock("../../browser/browser-api", () => ({
  BrowserApi: {
    permissionsGranted: jest.fn(),
    connectNative: jest.fn(),
  },
}));

function createPort() {
  const messageListeners: ((message: unknown) => void)[] = [];
  const disconnectListeners: (() => void)[] = [];
  const port = {
    postMessage: jest.fn(),
    disconnect: jest.fn(),
    onMessage: {
      addListener: jest.fn((listener) => messageListeners.push(listener)),
      removeListener: jest.fn(),
    },
    onDisconnect: {
      addListener: jest.fn((listener) => disconnectListeners.push(listener)),
      removeListener: jest.fn(),
    },
  } as unknown as chrome.runtime.Port;
  return {
    port,
    emit: (message: unknown) => messageListeners.forEach((listener) => listener(message)),
    disconnect: () => disconnectListeners.forEach((listener) => listener()),
  };
}

const toDesktop = {
  destination: "DesktopRenderer",
  payload: new Uint8Array([1, 2]),
  topic: "topic",
} as OutgoingMessage;

// Mirrors CONNECTION_TIMEOUT_MS in the transport.
const CONNECTION_TIMEOUT_MS = 5_000;

describe("DesktopIpcTransport", () => {
  const receive = jest.fn<void, [IncomingMessage]>();
  let transport: DesktopIpcTransport;
  let ports: ReturnType<typeof createPort>[];

  // Lets the async connect() run up to the point where it awaits the proxy.
  const settle = () => jest.advanceTimersByTimeAsync(0);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    ports = [];
    (BrowserApi.permissionsGranted as jest.Mock).mockResolvedValue(true);
    (BrowserApi.connectNative as jest.Mock).mockImplementation(() => {
      const port = createPort();
      ports.push(port);
      return port.port;
    });
    (ipcRequestDiscover as jest.Mock).mockResolvedValue({ version: "test" });
    transport = new DesktopIpcTransport(mock<IpcClient>(), mock<LogService>(), receive);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("rejects a send made while connecting when the proxy never reports a connection", async () => {
    transport.init();
    await settle();
    expect(ports).toHaveLength(1);

    const sent = transport.send(toDesktop);
    const assertion = expect(sent).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
    await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS);

    await assertion;
    expect(ports[0].port.disconnect).toHaveBeenCalled();
    expect(ports[0].port.postMessage).not.toHaveBeenCalled();
  });

  it("posts a send made while connecting once the proxy reports a connection", async () => {
    transport.init();
    await settle();

    const sent = transport.send(toDesktop);
    ports[0].emit({ command: "connected" });
    await sent;

    expect(ports[0].port.postMessage).toHaveBeenCalledWith({
      type: "bitwarden-ipc-message",
      message: {
        destination: "DesktopRenderer",
        payload: [1, 2],
        topic: "topic",
      },
    });
    expect(ports[0].port.disconnect).not.toHaveBeenCalled();
  });

  it("rejects a send made while connecting when the port disconnects", async () => {
    transport.init();
    await settle();

    const sent = transport.send(toDesktop);
    ports[0].disconnect();

    await expect(sent).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
    expect(ports[0].port.postMessage).not.toHaveBeenCalled();
  });

  it("rejects a send made while connecting when the connection attempt fails", async () => {
    let sent: Promise<void> | undefined;
    (BrowserApi.connectNative as jest.Mock).mockImplementation(() => {
      const port = createPort();
      ports.push(port);
      // Fail the attempt after it has entered the connecting state, with a send already waiting.
      (port.port.onDisconnect.addListener as jest.Mock).mockImplementation(() => {
        sent = transport.send(toDesktop);
        throw new Error("addListener failed");
      });
      return port.port;
    });

    transport.init();
    await settle();

    expect(sent).toBeDefined();
    await expect(sent).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
    expect(ports[0].port.disconnect).toHaveBeenCalled();
  });
});
