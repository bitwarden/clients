import * as crypto from "crypto";
import * as net from "net";
import * as os from "os";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcMessage, isForwardedIpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

const MAX_MESSAGE_SIZE = 1024 * 1024;
const CONNECTION_TIMEOUT_MS = 5_000;
const LINUX_FLATPAK_NATIVE_MESSAGING_PATHS = [
  "org.mozilla.firefox/.mozilla/native-messaging-hosts",
  "com.google.Chrome/config/google-chrome/NativeMessagingHosts",
  "org.chromium.Chromium/config/chromium/NativeMessagingHosts",
  "com.microsoft.Edge/config/microsoft-edge/NativeMessagingHosts",
];
const LINUX_NATIVE_MESSAGING_PATHS = [
  ".config/chromium/NativeMessagingHosts",
  ".config/google-chrome/NativeMessagingHosts",
  ".config/microsoft-edge/NativeMessagingHosts",
  ".mozilla/native-messaging-hosts",
];

/**
 * Returns the desktop IPC endpoints used by desktop_native/core/src/ipc/mod.rs.
 *
 * macOS has separate endpoints for the sandboxed App Store build and the
 * unsandboxed build, so both are attempted.
 */
export function getDesktopSocketPaths(
  platform = os.platform(),
  homeDir = os.homedir(),
  xdgCacheHome = process.env.XDG_CACHE_HOME,
): string[] {
  if (platform === "win32") {
    const hash = crypto.createHash("sha256").update(homeDir).digest("base64url");
    return [`\\\\.\\pipe\\${hash}.s.bw`];
  }

  if (platform === "darwin") {
    return [
      path.join(homeDir, "Library", "Group Containers", "LTZ2PFU5D6.com.bitwarden.desktop", "s.bw"),
      path.join(homeDir, "Library", "Caches", "com.bitwarden.desktop", "s.bw"),
    ];
  }

  const socketName = ".app.bw.socket";
  return [
    path.join(xdgCacheHome ?? path.join(homeDir, ".cache"), "com.bitwarden.desktop", "s.bw"),
    ...LINUX_FLATPAK_NATIVE_MESSAGING_PATHS.map((nativePath) =>
      path.join(homeDir, ".var", "app", nativePath, socketName),
    ),
    ...LINUX_NATIVE_MESSAGING_PATHS.map((nativePath) => path.join(homeDir, nativePath, socketName)),
  ];
}

export function encodeDesktopIpcFrame(message: IpcMessage): Buffer {
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

/** Direct socket transport for the SDK IPC client used by the CLI. */
export class CliDesktopIpcTransport {
  private socket?: net.Socket;
  private connection?: Promise<net.Socket>;
  private messageBuffer = Buffer.alloc(0);

  constructor(
    private logService: LogService,
    private receive: (message: IncomingMessage) => void,
    private socketPaths = getDesktopSocketPaths(),
    private onDisconnect?: () => void,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    const frame = encodeDesktopIpcFrame({
      type: "bitwarden-ipc-message",
      message: {
        destination: message.destination,
        payload: [...message.payload],
        topic: message.topic,
      },
    });
    const socket = await this.connect();

    await new Promise<void>((resolve, reject) => {
      socket.write(frame, (error) => (error ? reject(error) : resolve()));
    });
  }

  disconnect(): void {
    this.socket?.destroy();
    this.socket = undefined;
    this.connection = undefined;
    this.messageBuffer = Buffer.alloc(0);
    this.onDisconnect?.();
  }

  private async connect(): Promise<net.Socket> {
    if (this.socket != null && !this.socket.destroyed) {
      return this.socket;
    }

    this.connection ??= this.connectToFirstAvailablePath();
    try {
      return await this.connection;
    } catch (error) {
      this.connection = undefined;
      throw error;
    }
  }

  private async connectToFirstAvailablePath(): Promise<net.Socket> {
    let lastError: Error | undefined;

    for (const socketPath of this.socketPaths) {
      try {
        const socket = await this.connectToPath(socketPath);
        this.socket = socket;
        this.logService.info(`[IPC] Connected to Bitwarden Desktop at ${socketPath}`);
        return socket;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new Error(
      `Could not connect to the Bitwarden Desktop app${lastError ? `: ${lastError.message}` : ""}`,
    );
  }

  private connectToPath(socketPath: string): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(socketPath);
      let settled = false;

      const timeout = setTimeout(() => {
        settled = true;
        socket.destroy();
        reject(new Error(`Connection to ${socketPath} timed out`));
      }, CONNECTION_TIMEOUT_MS);

      socket.once("connect", () => {
        settled = true;
        clearTimeout(timeout);
        socket.on("data", (data) => this.processIncomingData(data));
        socket.on("close", () => this.handleDisconnect(socket));
        socket.on("error", (error) =>
          this.logService.info("[IPC] Bitwarden Desktop socket error", error),
        );
        resolve(socket);
      });

      socket.once("error", (error) => {
        if (!settled) {
          clearTimeout(timeout);
          socket.destroy();
          reject(error);
        }
      });
    });
  }

  private handleDisconnect(socket: net.Socket): void {
    if (this.socket === socket) {
      this.socket = undefined;
      this.connection = undefined;
      this.messageBuffer = Buffer.alloc(0);
      this.onDisconnect?.();
    }
  }

  private processIncomingData(data: Buffer): void {
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
