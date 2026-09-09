import { ChildProcessWithoutNullStreams } from "child_process";
import { EventEmitter } from "events";
import * as os from "os";
import { PassThrough } from "stream";

import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { CliDesktopIpcTransport, encodeNativeMessagingFrame } from "./cli-desktop-ipc.transport";

describe("encodeNativeMessagingFrame", () => {
  it("writes the JSON envelope with a native-endian length prefix", () => {
    const frame = encodeNativeMessagingFrame({ command: "connected" });
    const payloadLength = os.endianness() === "LE" ? frame.readUInt32LE(0) : frame.readUInt32BE(0);

    expect(payloadLength).toBe(frame.length - 4);
    expect(JSON.parse(frame.subarray(4).toString("utf8"))).toEqual({ command: "connected" });
  });

  it("rejects messages larger than the native-messaging limit", () => {
    expect(() =>
      encodeNativeMessagingFrame({
        message: {
          payload: new Array(1024 * 1024).fill(1),
        },
      }),
    ).toThrow("Desktop IPC message exceeds 1048576 bytes");
  });
});

describe("CliDesktopIpcTransport", () => {
  const logService = mock<LogService>();
  const receive = jest.fn<void, [IncomingMessage]>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts the proxy and waits for its connected message before sending", async () => {
    const proxy = createProxyProcess();
    const proxySpawner = jest.fn(() => proxy.process);
    const transport = new CliDesktopIpcTransport(
      logService,
      receive,
      undefined,
      () => "/installed/desktop_proxy",
      proxySpawner,
    );
    const outgoing = {
      destination: "DesktopRenderer",
      payload: new Uint8Array([1, 2, 3]),
      topic: "test-topic",
    } as OutgoingMessage;
    const written: Buffer[] = [];
    proxy.stdin.on("data", (data: Buffer) => written.push(data));

    const send = transport.send(outgoing);
    expect(proxySpawner).toHaveBeenCalledWith("/installed/desktop_proxy");
    expect(written).toHaveLength(0);

    proxy.stdout.write(encodeNativeMessagingFrame({ command: "connected" }));
    await send;

    expect(written).toHaveLength(1);
    expect(JSON.parse(written[0].subarray(4).toString("utf8"))).toEqual({
      type: "bitwarden-ipc-message",
      message: {
        destination: "DesktopRenderer",
        payload: [1, 2, 3],
        topic: "test-topic",
      },
    });
    transport.disconnect();
  });

  it("rejects the connection when the proxy exits before connecting", async () => {
    const proxy = createProxyProcess();
    const transport = new CliDesktopIpcTransport(
      logService,
      receive,
      undefined,
      () => "/installed/desktop_proxy",
      () => proxy.process,
    );

    const send = transport.send({
      destination: "DesktopRenderer",
      payload: new Uint8Array(),
    } as OutgoingMessage);
    proxy.process.emit("exit", 1, null);

    await expect(send).rejects.toThrow("Bitwarden Desktop proxy exited with code 1");
  });

  it("terminates the proxy and reports an explicit disconnect", async () => {
    const proxy = createProxyProcess();
    const onDisconnect = jest.fn();
    const transport = new CliDesktopIpcTransport(
      logService,
      receive,
      onDisconnect,
      () => "/installed/desktop_proxy",
      () => proxy.process,
    );
    const send = transport.send({
      destination: "DesktopRenderer",
      payload: new Uint8Array(),
    } as OutgoingMessage);
    proxy.stdout.write(encodeNativeMessagingFrame({ command: "connected" }));
    await send;

    transport.disconnect();

    expect(proxy.process.kill).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("buffers fragmented frames and delivers multiple SDK messages", () => {
    const transport = new CliDesktopIpcTransport(logService, receive);
    const processIncomingData = (
      transport as unknown as { processIncomingData(data: Buffer): void }
    ).processIncomingData.bind(transport);
    const first = encodeNativeMessagingFrame({
      type: "bitwarden-ipc-message",
      message: { destination: "DesktopRenderer", payload: [1], topic: "first" },
    });
    const second = encodeNativeMessagingFrame({
      type: "bitwarden-ipc-message",
      message: { destination: "DesktopRenderer", payload: [2], topic: "second" },
    });

    processIncomingData(first.subarray(0, 2));
    expect(receive).not.toHaveBeenCalled();

    processIncomingData(Buffer.concat([first.subarray(2), second]));
    expect(receive).toHaveBeenCalledTimes(2);
    expect(receive.mock.calls[0][0].payload).toEqual(new Uint8Array([1]));
    expect(receive.mock.calls[1][0].payload).toEqual(new Uint8Array([2]));
  });

  it("disconnects when a frame exceeds the maximum size", () => {
    const transport = new CliDesktopIpcTransport(logService, receive);
    const processIncomingData = (
      transport as unknown as { processIncomingData(data: Buffer): void }
    ).processIncomingData.bind(transport);
    const header = Buffer.alloc(4);
    if (os.endianness() === "LE") {
      header.writeUInt32LE(1024 * 1024 + 1);
    } else {
      header.writeUInt32BE(1024 * 1024 + 1);
    }
    const disconnect = jest.spyOn(transport, "disconnect");

    processIncomingData(header);

    expect(logService.error).toHaveBeenCalledWith("[IPC] Desktop message exceeds 1048576 bytes");
    expect(disconnect).toHaveBeenCalled();
  });
});

function createProxyProcess() {
  const process = new EventEmitter() as ChildProcessWithoutNullStreams;
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  Object.assign(process, {
    stdin,
    stdout,
    stderr,
    kill: jest.fn(() => true),
  });
  return { process, stdin, stdout, stderr };
}
