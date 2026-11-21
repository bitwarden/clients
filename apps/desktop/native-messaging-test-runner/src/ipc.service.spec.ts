import { spawn } from "child_process";
import { EventEmitter } from "events";

import IPCService from "./ipc.service";

jest.mock("child_process", () => ({ spawn: jest.fn() }));

const RESPONSE_TIMEOUT_MS = 100;

/** A desktop_proxy stand-in: the test writes its stdout. */
function fakeProxy() {
  const proxy = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: { write: jest.fn() },
    kill: jest.fn(),
  });
  jest.mocked(spawn).mockReturnValue(proxy as any);

  return proxy;
}

/** One native messaging frame: a little-endian uint32 length, then the JSON message. */
function frame(message: object): Buffer {
  const json = Buffer.from(JSON.stringify(message));
  const length = Buffer.alloc(4);
  length.writeUInt32LE(json.length, 0);

  return Buffer.concat([length, json]);
}

describe("IPCService", () => {
  let proxy: ReturnType<typeof fakeProxy>;
  let ipc: IPCService;

  beforeEach(() => {
    // Any existing file passes selectProxyPath; the proxy itself is faked.
    process.env.PROXY_PATH = __filename;
    proxy = fakeProxy();
    ipc = new IPCService("bitwarden", jest.fn());
  });

  afterEach(() => {
    delete process.env.PROXY_PATH;
  });

  it("handles every message in a chunk holding several", async () => {
    const connected = ipc.connect();
    proxy.stdout.emit("data", frame({ command: "connected" }));
    await connected;

    const response = ipc.sendMessage({ messageId: "1", version: 1 } as any, {
      overrideTimeout: RESPONSE_TIMEOUT_MS,
    });
    proxy.stdout.emit(
      "data",
      Buffer.concat([frame({ messageId: "1", version: 1 }), frame({ messageId: "2" })]),
    );

    await expect(response).resolves.toEqual({ messageId: "1", version: 1 });
  });

  it("waits for the rest of a message split across chunks", async () => {
    const connected = ipc.connect();
    const message = frame({ command: "connected" });

    proxy.stdout.emit("data", message.subarray(0, 10));
    proxy.stdout.emit("data", message.subarray(10));

    await expect(connected).resolves.toBeNull();
  });
});
