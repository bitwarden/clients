import * as net from "net";
import * as os from "os";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

/**
 * Platform-specific IPC socket service for connecting to the Bitwarden desktop app.
 *
 * The desktop app listens on a Unix domain socket (macOS/Linux) or named pipe (Windows).
 * This service provides a platform-agnostic way to connect and communicate with it.
 */
export class IpcSocketService {
  private socket: net.Socket | null = null;
  private messageBuffer: Buffer = Buffer.alloc(0);
  private messageHandler: ((message: unknown) => void) | null = null;
  private disconnectHandler: (() => void) | null = null;

  constructor(private logService: LogService) {}

  /**
   * Get the IPC socket path for the current platform.
   * This mirrors the logic in desktop_native/core/src/ipc/mod.rs
   *
   * On macOS, the Desktop app can be sandboxed (Mac App Store) or non-sandboxed.
   * We try the sandboxed App Group path first, then fall back to the cache directory.
   */
  getSocketPath(): string {
    const platform = os.platform();

    if (platform === "win32") {
      // Windows uses named pipes with a hash of the home directory
      // Format: \\.\pipe\<hash>.s.bw
      const crypto = require("crypto");
      const homeDir = os.homedir();
      const hash = crypto.createHash("sha256").update(homeDir).digest();
      // Use URL-safe base64 without padding (like Rust's URL_SAFE_NO_PAD)
      const hashB64 = hash
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      return `\\\\.\\pipe\\${hashB64}.s.bw`;
    }

    if (platform === "darwin") {
      return this.getMacSocketPath();
    }

    // Linux: use XDG cache directory or fallback
    // ~/.cache/com.bitwarden.desktop/s.bw
    const cacheDir =
      process.env.XDG_CACHE_HOME != null
        ? process.env.XDG_CACHE_HOME
        : path.join(os.homedir(), ".cache");
    return path.join(cacheDir, "com.bitwarden.desktop", "s.bw");
  }

  /**
   * Get the socket path on macOS.
   * The Desktop app can be sandboxed (Mac App Store) or non-sandboxed.
   * We check both paths and return the one that exists.
   */
  private getMacSocketPath(): string {
    const fs = require("fs");
    const homeDir = os.homedir();

    // Path for sandboxed Desktop app (Mac App Store version)
    // Uses App Group: ~/Library/Group Containers/LTZ2PFU5D6.com.bitwarden.desktop/s.bw
    const sandboxedPath = path.join(
      homeDir,
      "Library",
      "Group Containers",
      "LTZ2PFU5D6.com.bitwarden.desktop",
      "s.bw",
    );

    // Path for non-sandboxed Desktop app
    // Uses cache: ~/Library/Caches/com.bitwarden.desktop/s.bw
    const nonSandboxedPath = path.join(
      homeDir,
      "Library",
      "Caches",
      "com.bitwarden.desktop",
      "s.bw",
    );

    // Check sandboxed path first (most common for Mac App Store users)
    try {
      fs.accessSync(sandboxedPath);
      this.logService.debug(`[IPC] Using sandboxed socket path: ${sandboxedPath}`);
      return sandboxedPath;
    } catch {
      // Socket not found at sandboxed path
    }

    // Check non-sandboxed path
    try {
      fs.accessSync(nonSandboxedPath);
      this.logService.debug(`[IPC] Using non-sandboxed socket path: ${nonSandboxedPath}`);
      return nonSandboxedPath;
    } catch {
      // Socket not found at non-sandboxed path either
    }

    // Default to sandboxed path (will fail with clear error message)
    this.logService.debug(`[IPC] Socket not found, defaulting to: ${sandboxedPath}`);
    return sandboxedPath;
  }

  /**
   * Check if the desktop app socket exists (quick availability check).
   */
  async isSocketAvailable(): Promise<boolean> {
    const socketPath = this.getSocketPath();
    const fs = await import("fs/promises");
    try {
      await fs.access(socketPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Connect to the desktop app's IPC socket.
   */
  async connect(): Promise<void> {
    if (this.socket != null) {
      return;
    }

    const socketPath = this.getSocketPath();
    this.logService.debug(`[IPC] Connecting to socket at: ${socketPath}`);

    return new Promise((resolve, reject) => {
      const socket = net.createConnection(socketPath);

      socket.on("connect", () => {
        this.logService.debug("[IPC] Socket connected");
        this.socket = socket;
        resolve();
      });

      socket.on("data", (data: Buffer) => {
        this.processIncomingData(data);
      });

      socket.on("error", (err) => {
        this.logService.error("[IPC] Socket error:", err);
        if (this.socket == null) {
          reject(new Error(`Failed to connect to desktop app: ${err.message}`));
        }
      });

      socket.on("close", () => {
        this.logService.debug("[IPC] Socket closed");
        this.socket = null;
        this.messageBuffer = Buffer.alloc(0);
        if (this.disconnectHandler) {
          this.disconnectHandler();
        }
      });

      // Timeout for initial connection
      socket.setTimeout(5000, () => {
        if (this.socket == null) {
          socket.destroy();
          reject(new Error("Connection to desktop app timed out"));
        }
      });
    });
  }

  /**
   * Disconnect from the socket.
   */
  disconnect(): void {
    if (this.socket != null) {
      this.socket.destroy();
      this.socket = null;
    }
    this.messageBuffer = Buffer.alloc(0);
  }

  /**
   * Check if currently connected.
   */
  isConnected(): boolean {
    return this.socket != null && !this.socket.destroyed;
  }

  /**
   * Set the handler for incoming messages.
   */
  onMessage(handler: (message: unknown) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Set the handler for disconnect events.
   */
  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }

  /**
   * Send a message to the desktop app.
   * Uses length-delimited protocol: 4-byte little-endian length prefix + JSON payload.
   */
  sendMessage(message: unknown): void {
    if (this.socket == null || this.socket.destroyed) {
      throw new Error("Not connected to desktop app");
    }

    const messageStr = JSON.stringify(message);
    const messageBytes = Buffer.from(messageStr, "utf8");

    // Create buffer with 4-byte length prefix (little-endian, native for Node.js on most platforms)
    const buffer = Buffer.alloc(4 + messageBytes.length);
    buffer.writeUInt32LE(messageBytes.length, 0);
    messageBytes.copy(buffer, 4);

    this.socket.write(buffer);
    this.logService.debug(`[IPC] Sent message: ${messageStr.substring(0, 100)}...`);
  }

  /**
   * Process incoming data from the socket.
   * Messages are length-delimited: 4-byte LE length + JSON payload.
   */
  private processIncomingData(data: Buffer): void {
    this.messageBuffer = Buffer.concat([this.messageBuffer, data]);

    // Process all complete messages in the buffer
    while (this.messageBuffer.length >= 4) {
      const messageLength = this.messageBuffer.readUInt32LE(0);

      // Check if we have the full message
      if (this.messageBuffer.length < 4 + messageLength) {
        break;
      }

      // Extract and parse the message
      const messageBytes = this.messageBuffer.subarray(4, 4 + messageLength);
      const messageStr = messageBytes.toString("utf8");

      // Update buffer to remove processed message
      this.messageBuffer = this.messageBuffer.subarray(4 + messageLength);

      try {
        const message = JSON.parse(messageStr);
        this.logService.debug(`[IPC] Received message: ${messageStr.substring(0, 100)}...`);

        if (this.messageHandler) {
          this.messageHandler(message);
        }
      } catch (e) {
        this.logService.error("[IPC] Failed to parse message:", e);
      }
    }
  }
}
