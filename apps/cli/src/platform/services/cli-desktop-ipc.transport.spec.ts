import * as crypto from "crypto";
import * as os from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IncomingMessage } from "@bitwarden/sdk-internal";

import {
  CliDesktopIpcTransport,
  encodeDesktopIpcFrame,
  getDesktopSocketPaths,
} from "./cli-desktop-ipc.transport";

describe("getDesktopSocketPaths", () => {
  it("uses the desktop cache socket on Linux", () => {
    const paths = getDesktopSocketPaths("linux", "/home/alice", "/tmp/alice-cache");

    expect(paths[0]).toBe(path.join("/tmp/alice-cache", "com.bitwarden.desktop", "s.bw"));
    expect(paths).toContain(
      path.join(
        "/home/alice",
        ".var/app/com.google.Chrome/config/google-chrome/NativeMessagingHosts/.app.bw.socket",
      ),
    );
    expect(paths).toContain(
      path.join("/home/alice", ".config/chromium/NativeMessagingHosts/.app.bw.socket"),
    );
  });

  it("returns both sandboxed and unsandboxed macOS sockets", () => {
    expect(getDesktopSocketPaths("darwin", "/Users/alice")).toEqual([
      path.join(
        "/Users/alice",
        "Library",
        "Group Containers",
        "LTZ2PFU5D6.com.bitwarden.desktop",
        "s.bw",
      ),
      path.join("/Users/alice", "Library", "Caches", "com.bitwarden.desktop", "s.bw"),
    ]);
  });

  it("matches the desktop per-user Windows named pipe", () => {
    const home = "C:\\Users\\alice";
    const hash = crypto.createHash("sha256").update(home).digest("base64url");

    expect(getDesktopSocketPaths("win32", home)).toEqual([`\\\\.\\pipe\\${hash}.s.bw`]);
  });
});

describe("encodeDesktopIpcFrame", () => {
  it("writes the JSON IPC envelope with the desktop length prefix", () => {
    const frame = encodeDesktopIpcFrame({
      type: "bitwarden-ipc-message",
      message: {
        destination: "DesktopRenderer",
        payload: [1, 2, 3],
        topic: "test-topic",
      },
    });
    const payloadLength = os.endianness() === "LE" ? frame.readUInt32LE(0) : frame.readUInt32BE(0);

    expect(payloadLength).toBe(frame.length - 4);
    expect(JSON.parse(frame.subarray(4).toString("utf8"))).toEqual({
      type: "bitwarden-ipc-message",
      message: {
        destination: "DesktopRenderer",
        payload: [1, 2, 3],
        topic: "test-topic",
      },
    });
  });

  it("rejects messages larger than the desktop native messaging limit", () => {
    expect(() =>
      encodeDesktopIpcFrame({
        type: "bitwarden-ipc-message",
        message: {
          destination: "DesktopRenderer",
          payload: new Array(1024 * 1024).fill(1),
          topic: undefined,
        },
      }),
    ).toThrow("Desktop IPC message exceeds 1048576 bytes");
  });
});

describe("CliDesktopIpcTransport incoming frames", () => {
  const logService = mock<LogService>();
  const receive = jest.fn<void, [IncomingMessage]>();
  const transport = new CliDesktopIpcTransport(logService, receive, []);
  const processIncomingData = (
    transport as unknown as { processIncomingData(data: Buffer): void }
  ).processIncomingData.bind(transport);

  beforeEach(() => {
    jest.clearAllMocks();
    transport.disconnect();
  });

  it("buffers a fragmented frame before delivering it", () => {
    const frame = encodeDesktopIpcFrame({
      type: "bitwarden-ipc-message",
      message: {
        destination: "DesktopRenderer",
        payload: [1, 2, 3],
        topic: "fragmented",
      },
    });

    processIncomingData(frame.subarray(0, 2));
    expect(receive).not.toHaveBeenCalled();

    processIncomingData(frame.subarray(2));
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive.mock.calls[0][0].payload).toEqual(new Uint8Array([1, 2, 3]));
    expect(receive.mock.calls[0][0].source).toBe("DesktopMain");
    expect(receive.mock.calls[0][0].topic).toBe("fragmented");
  });

  it("delivers multiple frames received in one chunk", () => {
    const first = encodeDesktopIpcFrame({
      type: "bitwarden-ipc-message",
      message: { destination: "DesktopRenderer", payload: [1], topic: undefined },
    });
    const second = encodeDesktopIpcFrame({
      type: "bitwarden-ipc-message",
      message: { destination: "DesktopRenderer", payload: [2], topic: undefined },
    });

    processIncomingData(Buffer.concat([first, second]));

    expect(receive).toHaveBeenCalledTimes(2);
    expect(receive.mock.calls[0][0].payload).toEqual(new Uint8Array([1]));
    expect(receive.mock.calls[1][0].payload).toEqual(new Uint8Array([2]));
  });

  it("disconnects when a frame exceeds the maximum size", () => {
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
