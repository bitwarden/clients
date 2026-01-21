// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Message, MessageTypes } from "./message";

const SENDER = "bitwarden-webauthn";

type PostMessageFunction = (message: MessageWithMetadata, remotePort: MessagePort) => void;

export type Channel = {
  addEventListener: (listener: (message: MessageEvent<MessageWithMetadata>) => void) => void;
  removeEventListener: (listener: (message: MessageEvent<MessageWithMetadata>) => void) => void;
  postMessage: PostMessageFunction;
};

export type Metadata = { SENDER: typeof SENDER; senderId: string };
export type MessageWithMetadata = Message & Metadata;
type Handler = (
  message: MessageWithMetadata,
  abortController?: AbortController,
) => void | Promise<Message | undefined>;

/**
 * A class that handles communication between the page and content script. It converts
 * the browser's broadcasting API into a request/response API with support for seamlessly
 * handling aborts and exceptions across separate execution contexts.
 */
export class Messenger {
  private messageEventListener: (event: MessageEvent<MessageWithMetadata>) => void | null = null;
  private onDestroy = new EventTarget();

  /**
   * Creates a messenger that uses the browser's `window.postMessage` API to initiate
   * requests in the content script. Every request will then create it's own
   * `MessageChannel` through which all subsequent communication will be sent through.
   *
   * @param window the window object to use for communication
   * @returns a `Messenger` instance
   */
  static forDOMCommunication(window: Window) {
    const windowOrigin = window.location.origin;

    return new Messenger({
      postMessage: (message, port) => window.postMessage(message, windowOrigin, [port]),
      addEventListener: (listener) => window.addEventListener("message", listener),
      removeEventListener: (listener) => window.removeEventListener("message", listener),
    });
  }

  /**
   * The handler that will be called when a message is received. The handler should return
   * a promise that resolves to the response message. If the handler throws an error, the
   * error will be sent back to the sender.
   */
  handler?: Handler;

  private messengerId = this.generateUniqueId();

  constructor(private broadcastChannel: Channel) {
    this.messageEventListener = this.createMessageEventListener();
    this.broadcastChannel.addEventListener(this.messageEventListener);
  }

  /**
   * Sends a request to the content script and returns the response.
   * AbortController signals will be forwarded to the content script.
   *
   * @param request data to send to the content script
   * @param abortSignal the abort controller that might be used to abort the request
   * @returns the response from the content script
   */
  async request(request: Message, abortSignal?: AbortSignal): Promise<Message> {
    const requestChannel = new MessageChannel();
    const { port1: localPort, port2: remotePort } = requestChannel;

    try {
      const promise = new Promise<Message>((resolve) => {
        localPort.onmessage = (event: MessageEvent<MessageWithMetadata>) => resolve(event.data);
      });

      const abortListener = () =>
        localPort.postMessage({
          metadata: { SENDER },
          type: MessageTypes.AbortRequest,
        });
      abortSignal?.addEventListener("abort", abortListener);

      this.broadcastChannel.postMessage(
        { ...request, SENDER, senderId: this.messengerId },
        remotePort,
      );
      const response = await promise;

      abortSignal?.removeEventListener("abort", abortListener);

      if (response.type === MessageTypes.ErrorResponse) {
        const error = new Error();
        Object.assign(error, JSON.parse(response.error));
        throw error;
      }

      return response;
    } finally {
      localPort.close();
    }
  }

  private createMessageEventListener() {
    return async (event: MessageEvent<MessageWithMetadata>) => {
      const windowOrigin = window.location.origin;
      if (event.origin !== windowOrigin || !this.handler) {
        return;
      }

      const message = event.data;
      const port = event.ports?.[0];
      if (message?.SENDER !== SENDER || message.senderId == this.messengerId || port == null) {
        return;
      }

      const abortController = new AbortController();
      port.onmessage = (event: MessageEvent<MessageWithMetadata>) => {
        if (event.data.type === MessageTypes.AbortRequest) {
          abortController.abort();
        }
      };

      const onDestroyListener = () => abortController.abort();
      this.onDestroy.addEventListener("destroy", onDestroyListener);

      try {
        const handlerResponse = await this.handler(message, abortController);
        port.postMessage({ ...handlerResponse, SENDER });
      } catch (error) {
        port.postMessage({
          SENDER,
          type: MessageTypes.ErrorResponse,
          error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
      } finally {
        this.onDestroy.removeEventListener("destroy", onDestroyListener);
        port.close();
      }
    };
  }

  /**
   * Cleans up the messenger by removing the message event listener
   */
  async destroy() {
    this.onDestroy.dispatchEvent(new Event("destroy"));

    if (this.messageEventListener) {
      await this.sendDisconnectCommand();
      this.broadcastChannel.removeEventListener(this.messageEventListener);
      this.messageEventListener = null;
    }
  }

  private async sendDisconnectCommand() {
    await this.request({ type: MessageTypes.DisconnectRequest });
  }

  private generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
