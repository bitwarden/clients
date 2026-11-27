import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcClient, OutgoingMessage } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

import { DesktopIpcTransport } from "./desktop-ipc.transport";
import { DESTINATION_UNREACHABLE_ERROR } from "./errors";

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  ipcRequestDiscover: jest.fn().mockResolvedValue({ version: "2026.11.0" }),
}));

// Mirrors CONNECTION_TIMEOUT_MS in the transport, which is not exported.
const CONNECTION_TIMEOUT_MS = 5_000;
const PROXY_CONNECTED = { command: "connected" };

type Listener<T> = (value: T) => void;

/** `send` spreads `payload`, so it needs a real iterable rather than an auto-stubbed mock. */
const OUTGOING_MESSAGE = {
  destination: "DesktopRenderer",
  payload: new Uint8Array([1, 2, 3]),
  topic: undefined,
} as unknown as OutgoingMessage;

/**
 * A native messaging port whose two events are driven by the test.
 *
 * `disconnect()` does not run the disconnect listeners: Chrome and Edge only fire `onDisconnect`
 * on the far end, not on the side that closed the port.
 */
function fakePort() {
  const messageListeners: Listener<unknown>[] = [];
  const disconnectListeners: Listener<void>[] = [];

  return {
    onMessage: { addListener: (l: Listener<unknown>) => messageListeners.push(l) },
    onDisconnect: { addListener: (l: Listener<void>) => disconnectListeners.push(l) },
    postMessage: jest.fn(),
    disconnect: jest.fn(),
    deliver: (message: unknown) => messageListeners.forEach((l) => l(message)),
    dropFromFarEnd: () => disconnectListeners.forEach((l) => l()),
  };
}

describe("DesktopIpcTransport", () => {
  let port: ReturnType<typeof fakePort>;
  let transport: DesktopIpcTransport;

  /** Starts the transport and lets `connect()` open the port and register its listeners. */
  async function startConnecting() {
    transport.init();
    await Promise.resolve();
  }

  /** Whether `promise` has settled, either way. */
  function settles(promise: Promise<unknown>): () => boolean {
    let settled = false;
    const mark = () => (settled = true);
    promise.then(mark, mark);

    return () => settled;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    port = fakePort();

    jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(true);
    jest.spyOn(BrowserApi, "connectNative").mockReturnValue(port as any);

    transport = new DesktopIpcTransport(mock<IpcClient>(), mock<LogService>(), jest.fn());
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("a send issued while a connection attempt is in flight", () => {
    it("rejects as unreachable when the attempt times out", async () => {
      await startConnecting();
      const send = transport.send(OUTGOING_MESSAGE);
      const hasSettled = settles(send);

      await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS + 1);

      expect(hasSettled()).toBe(true);
      await expect(send).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
      expect(port.disconnect).toHaveBeenCalled();
    });

    it("rejects as unreachable when the port disconnects mid-attempt", async () => {
      await startConnecting();
      const send = transport.send(OUTGOING_MESSAGE);
      const hasSettled = settles(send);

      port.dropFromFarEnd();
      await jest.advanceTimersByTimeAsync(0);

      expect(hasSettled()).toBe(true);
      await expect(send).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
    });

    it("message is sent if the proxy reports a connection", async () => {
      await startConnecting();
      const send = transport.send(OUTGOING_MESSAGE);

      port.deliver(PROXY_CONNECTED);
      await jest.advanceTimersByTimeAsync(0);

      await expect(send).resolves.toBeUndefined();
      expect(port.postMessage).toHaveBeenCalled();
    });
  });
});
