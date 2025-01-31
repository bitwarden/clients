/* eslint-disable no-console */
// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { homedir } from "os";

import * as NodeIPC from "node-ipc";

// eslint-disable-next-line no-restricted-imports
import { MessageCommon } from "../../src/models/native-messaging/message-common";
// eslint-disable-next-line no-restricted-imports
import { UnencryptedMessageResponse } from "../../src/models/native-messaging/unencrypted-message-response";

import Deferred from "./deferred";
import { race } from "./race";

NodeIPC.config.id = "native-messaging-test-runner";
NodeIPC.config.maxRetries = 0;
NodeIPC.config.silent = true;

const DESKTOP_APP_PATH = `${homedir}/tmp/app.bitwarden`;
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

    NodeIPC.connectTo(this.socketName, DESKTOP_APP_PATH, () => {
      // Process incoming message
      this.getSocket().on("message", (message: any) => {
        this.processMessage(message);
      });

      this.getSocket().on("error", (error: Error) => {
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

      this.getSocket().on("connect", () => {
        console.log("[IPCService] connected");
        this.connectionState = IPCConnectionState.Connected;

        this.awaitingConnection.forEach((deferred) => {
          deferred.resolve(null);
        });
        this.awaitingConnection.clear();
      });

      this.getSocket().on("disconnect", () => {
        console.log("[IPCService] disconnected");
        this.connectionState = IPCConnectionState.Disconnected;
      });
    });
  }

  disconnect() {
    console.log("[IPCService] disconnecting...");
    if (this.connectionState !== IPCConnectionState.Disconnected) {
      NodeIPC.disconnect(this.socketName);
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

    this.getSocket().emit("message", message);

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

  private getSocket() {
    return NodeIPC.of[this.socketName];
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
