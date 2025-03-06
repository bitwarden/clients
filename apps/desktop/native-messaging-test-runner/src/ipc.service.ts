/* eslint-disable no-console */
import { ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// eslint-disable-next-line no-restricted-imports
import { MessageCommon } from "../../src/models/native-messaging/message-common";
// eslint-disable-next-line no-restricted-imports
import { UnencryptedMessageResponse } from "../../src/models/native-messaging/unencrypted-message-response";

import Deferred from "./deferred";
import { race } from "./race";

const DEFAULT_MESSAGE_TIMEOUT = 10 * 1000; // 10 seconds

export type MessageHandler = (MessageCommon) => void;

export enum IPCConnectionState {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
}

export type IPCOptions = {
  overrideTimeout?: number;
};

export default class IPCService {
  // The current connection state of the socket.
  private connectionState: IPCConnectionState = IPCConnectionState.Disconnected;

  // Messages that have been sent, but have not yet received responses
  private pendingMessages = new Map<string, Deferred<UnencryptedMessageResponse>>();

  // A set of deferred promises that are awaiting socket connection
  private awaitingConnection = new Set<Deferred<void>>();

  // The IPC desktop_proxy process
  private process?: ChildProcess;
  private processOutputBuffer = Buffer.alloc(0);

  constructor(
    private socketName: string,
    private messageHandler: MessageHandler,
  ) {}

  async connect(): Promise<void> {
    console.log("[IPCService] connecting...");
    if (this.connectionState === IPCConnectionState.Connected) {
      // Socket is already connected. Don't throw, just allow the callsite to proceed
      return;
    }

    const deferredConnections = new Deferred<void>();

    this.awaitingConnection.add(deferredConnections);

    // If the current connection state is disconnected, we should start trying to connect.
    // The only other possible connection state at this point is "connecting" and if this
    // is the case, we just want to add a deferred promise to the awaitingConnection collection
    // and not try to initiate the connection again.
    if (this.connectionState === IPCConnectionState.Disconnected) {
      this._connect();
    }

    return deferredConnections.getPromise();
  }

  private _connect() {
    this.connectionState = IPCConnectionState.Connecting;

    const proxyPath = selectProxyPath();
    console.log(`[IPCService] connecting to proxy at ${proxyPath}`);

    this.process = spawn(proxyPath, process.argv.slice(1), {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: false,
    });

    this.process.stdout.on("data", (data: Buffer) => {
      this.processIpcMessage(data);
    });

    this.process.stderr.on("data", (data: Buffer) => {
      console.error(`proxy log: ${data}`);
    });

    this.process.on("error", (error) => {
      // Only makes sense as long as config.maxRetries stays set to 0. Otherwise this will be
      // invoked multiple times each time a connection error happens
      console.log("[IPCService] errored");
      console.log(
        "\x1b[33m Please make sure the desktop app is running locally and 'Allow DuckDuckGo browser integration' setting is enabled \x1b[0m",
      );
      this.awaitingConnection.forEach((deferred) => {
        console.log(`rejecting: ${deferred}`);
        deferred.reject(error);
      });
      this.awaitingConnection.clear();
    });

    this.process.on("exit", () => {
      console.log("[IPCService] disconnected");
      this.connectionState = IPCConnectionState.Disconnected;
    });
  }

  disconnect() {
    console.log("[IPCService] disconnecting...");
    if (this.connectionState !== IPCConnectionState.Disconnected) {
      this.process?.kill();
    }
  }

  async sendMessage(
    message: MessageCommon,
    options: IPCOptions = {},
  ): Promise<UnencryptedMessageResponse> {
    console.log("[IPCService] sendMessage");
    if (this.pendingMessages.has(message.messageId)) {
      throw new Error(`A message with the id: ${message.messageId} has already been sent.`);
    }

    // Creates a new deferred promise that allows us to convert a message received over the IPC socket
    // into a response for a message that we previously sent. This mechanism relies on the fact that we
    // create a unique message id and attach it with each message. Response messages are expected to
    // include the message id of the message they are responding to.
    const deferred = new Deferred<UnencryptedMessageResponse>();

    this.pendingMessages.set(message.messageId, deferred);

    this.sendIpcMessage(message);

    try {
      // Since we can not guarantee that a response message will ever be sent, we put a timeout
      // on messages
      return race({
        promise: deferred.getPromise(),
        timeout: options?.overrideTimeout ?? DEFAULT_MESSAGE_TIMEOUT,
        error: new Error(`Message: ${message.messageId} timed out`),
      });
    } catch (error) {
      // If there is a timeout, remove the message from the pending messages set
      // before triggering error handling elsewhere.
      this.pendingMessages.delete(message.messageId);
      throw error;
    }
  }

  // As we're using the desktop_proxy to communicate with the native messaging directly,
  // the messages need to follow Native Messaging Host protocol (uint32 size followed by message).
  // https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging#native-messaging-host-protocol
  private sendIpcMessage(message: MessageCommon) {
    const messageStr = JSON.stringify(message);
    const buffer = Buffer.alloc(4 + messageStr.length);
    buffer.writeUInt32LE(messageStr.length, 0);
    buffer.write(messageStr, 4);

    this.process?.stdin.write(buffer);
  }

  private processIpcMessage(data: Buffer) {
    this.processOutputBuffer = Buffer.concat([this.processOutputBuffer, data]);

    // We might receive more than one IPC message per data event, so we need to process them all
    // We continue as long as we have at least 4 + 1 bytes in the buffer, where the first 4 bytes
    // represent the message length and the 5th byte is the message
    while (this.processOutputBuffer.length > 4) {
      // Read the message length and ensure we have the full message
      const msgLength = this.processOutputBuffer.readUInt32LE(0);
      if (msgLength + 4 < this.processOutputBuffer.length) {
        return;
      }

      // Parse the message from the buffer
      const messageStr = this.processOutputBuffer.subarray(4, msgLength + 4).toString();
      const message = JSON.parse(messageStr);

      // Store the remaining buffer, which is part of the next message
      this.processOutputBuffer = this.processOutputBuffer.subarray(msgLength + 4);

      // Process the connect/disconnect messages separately
      if (message?.command === "connected") {
        console.log("[IPCService] connected");
        this.connectionState = IPCConnectionState.Connected;

        this.awaitingConnection.forEach((deferred) => {
          deferred.resolve(null);
        });
        this.awaitingConnection.clear();
        continue;
      } else if (message?.command === "disconnected") {
        console.log("[IPCService] disconnected");
        this.connectionState = IPCConnectionState.Disconnected;
        continue;
      }

      this.processMessage(message);
    }
  }

  private processMessage(message: any) {
    // If the message is a response to a previous message, resolve the deferred promise that
    // is awaiting that response. Otherwise, assume this was a new message that wasn't sent as a
    // response and invoke the message handler.
    if (message.messageId && this.pendingMessages.has(message.messageId)) {
      const deferred = this.pendingMessages.get(message.messageId);

      // In the future, this could be improved to add ability to reject, but most messages coming in are
      // encrypted at this point so we're unable to determine if they contain error info.
      deferred.resolve(message);

      this.pendingMessages.delete(message.messageId);
    } else {
      this.messageHandler(message);
    }
  }
}

function selectProxyPath(): string {
  const proxyExtension = process.platform === "win32" ? ".exe" : "";

  // If the PROXY_PATH environment variable is set, use that
  if (process.env.PROXY_PATH) {
    if (!fs.existsSync(process.env.PROXY_PATH)) {
      throw new Error(`PROXY_PATH is set to ${process.env.PROXY_PATH} but the file does not exist`);
    }
    return process.env.PROXY_PATH;
  }

  // Otherwise try the debug build if present
  const debugProxyPath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "..",
    "desktop_native",
    "target",
    "debug",
    `desktop_proxy${proxyExtension}`,
  );
  if (fs.existsSync(debugProxyPath)) {
    return debugProxyPath;
  }

  // On MacOS, try the release build (sandboxed)
  const macReleaseProxyPath = `/Applications/Bitwarden.app/Contents/MacOS/desktop_proxy${proxyExtension}`;
  if (process.platform === "darwin" && fs.existsSync(macReleaseProxyPath)) {
    return macReleaseProxyPath;
  }

  throw new Error("Could not find the desktop_proxy executable");
}
