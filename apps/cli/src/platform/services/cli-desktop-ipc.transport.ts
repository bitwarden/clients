import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as os from "os";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  IpcMessage,
  isForwardedIpcMessage,
  isIpcMessage,
  isProxyConnectedMessage,
} from "@bitwarden/common/platform/ipc";
import { IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { resolveDesktopProxyPath } from "./cli-desktop-proxy-path";

const MAX_MESSAGE_SIZE = 1024 * 1024;
const CONNECTION_TIMEOUT_MS = 5_000;
const DRAIN_TIMEOUT_MS = 500;

type SpawnProxy = (proxyPath: string) => ChildProcessWithoutNullStreams;

const spawnProxy: SpawnProxy = (proxyPath) =>
  spawn(proxyPath, [], {
    stdio: "pipe",
    shell: false,
  });

export function encodeNativeMessagingFrame(message: IpcMessage | object): Buffer {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  if (payload.length > MAX_MESSAGE_SIZE) {
    throw new Error(`Desktop IPC message exceeds ${MAX_MESSAGE_SIZE} bytes`);
  }

  const frame = Buffer.allocUnsafe(4 + payload.length);
  if (os.endianness() === "LE") {
    frame.writeUInt32LE(payload.length, 0);
  } else {
    frame.writeUInt32BE(payload.length, 0);
  }
  payload.copy(frame, 4);
  return frame;
}

/** SDK IPC transport backed by the Bitwarden Desktop native-messaging proxy. */
export class CliDesktopIpcTransport {
  private proxy?: ChildProcessWithoutNullStreams;
  private connection?: Promise<void>;
  private connected = false;
  private messageBuffer = Buffer.alloc(0);

  constructor(
    private logService: LogService,
    private receive: (message: IncomingMessage) => void,
    private onDisconnect?: () => void,
    private proxyPathResolver = resolveDesktopProxyPath,
    private proxySpawner: SpawnProxy = spawnProxy,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    await this.connect();

    const proxy = this.proxy;
    if (proxy == null || !this.connected) {
      throw new Error("Bitwarden Desktop proxy disconnected before the message could be sent");
    }

    const frame = encodeNativeMessagingFrame({
      type: "bitwarden-ipc-message",
      message: {
        destination: message.destination,
        payload: [...message.payload],
        topic: message.topic,
      },
    });

    await new Promise<void>((resolve, reject) => {
      proxy.stdin.write(frame, (error) => (error ? reject(error) : resolve()));
    });
  }

  /**
   * Closes the proxy's input and gives it a moment to relay what is already in the pipe before
   * {@link disconnect} kills it.
   *
   * `send` only awaits the write into the proxy's stdin, so killing the child straight afterwards
   * can discard the frame before it reaches the desktop app's socket. That is the whole payload
   * of a `bw lock`.
   */
  async drain(timeoutMs: number = DRAIN_TIMEOUT_MS): Promise<void> {
    const proxy = this.proxy;
    if (proxy == null) {
      this.disconnect();
      return;
    }

    proxy.stdin.end();
    await Promise.race([
      new Promise<void>((resolve) => proxy.once("exit", () => resolve())),
      // Unreferenced so the wait itself can never be what holds the process open.
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs).unref()),
    ]);

    this.disconnect();
  }

  disconnect(): void {
    const proxy = this.proxy;
    const wasConnected = proxy != null || this.connection != null;

    this.proxy = undefined;
    this.connection = undefined;
    this.connected = false;
    this.messageBuffer = Buffer.alloc(0);
    proxy?.kill();

    if (wasConnected) {
      this.onDisconnect?.();
    }
  }

  private async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.connection ??= this.startProxy();
    try {
      await this.connection;
    } catch (error) {
      this.connection = undefined;
      throw error;
    }
  }

  private startProxy(): Promise<void> {
    const proxyPath = this.proxyPathResolver();
    const proxy = this.proxySpawner(proxyPath);
    this.proxy = proxy;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        fail(new Error(`Connection to Bitwarden Desktop via ${proxyPath} timed out`));
        proxy.kill();
      }, CONNECTION_TIMEOUT_MS);

      const succeed = () => {
        if (settled || this.proxy !== proxy) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        this.connected = true;
        this.logService.info(`[IPC] Connected to Bitwarden Desktop via ${proxyPath}`);
        resolve();
      };

      const fail = (error: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(error);
        }
        this.handleProxyDisconnect(proxy);
      };

      proxy.stdout.on("data", (data: Buffer) => this.processIncomingData(data, succeed));
      proxy.stderr.on("data", (data: Buffer) =>
        this.logService.debug(`[IPC] Desktop proxy: ${data.toString("utf8").trimEnd()}`),
      );
      proxy.once("error", (error) => fail(error));
      proxy.once("exit", (code, signal) =>
        fail(
          new Error(
            `Bitwarden Desktop proxy exited${code != null ? ` with code ${code}` : ""}${
              signal != null ? ` from signal ${signal}` : ""
            }`,
          ),
        ),
      );
    });
  }

  private handleProxyDisconnect(proxy: ChildProcessWithoutNullStreams): void {
    if (this.proxy !== proxy) {
      return;
    }

    this.proxy = undefined;
    this.connection = undefined;
    this.connected = false;
    this.messageBuffer = Buffer.alloc(0);
    this.onDisconnect?.();
  }

  private processIncomingData(data: Buffer, onConnected: () => void = () => {}): void {
    this.messageBuffer = Buffer.concat([this.messageBuffer, data]);

    while (this.messageBuffer.length >= 4) {
      const messageLength = this.readFrameLength(this.messageBuffer);
      if (messageLength > MAX_MESSAGE_SIZE) {
        this.logService.error(`[IPC] Desktop message exceeds ${MAX_MESSAGE_SIZE} bytes`);
        this.disconnect();
        return;
      }

      if (this.messageBuffer.length < 4 + messageLength) {
        return;
      }

      const payload = this.messageBuffer.subarray(4, 4 + messageLength);
      this.messageBuffer = this.messageBuffer.subarray(4 + messageLength);

      try {
        const message: unknown = JSON.parse(payload.toString("utf8"));
        if (isProxyConnectedMessage(message)) {
          onConnected();
          continue;
        }
        if (!isIpcMessage(message) && !isForwardedIpcMessage(message)) {
          continue;
        }

        this.receive(
          new IncomingMessage(
            new Uint8Array(message.message.payload),
            message.message.destination,
            isForwardedIpcMessage(message) ? message.originalSource : "DesktopMain",
            message.message.topic,
          ),
        );
      } catch (error) {
        this.logService.info("[IPC] Ignoring malformed Bitwarden Desktop message", error);
      }
    }
  }

  private readFrameLength(buffer: Buffer): number {
    return os.endianness() === "LE" ? buffer.readUInt32LE(0) : buffer.readUInt32BE(0);
  }
}
