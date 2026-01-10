import { Observable, shareReplay } from "rxjs";

import { IpcClient, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

/**
 * Entry point for inter-process communication (IPC).
 *
 * - {@link IpcService.init} should be called in the initialization phase of the client.
 * - This service owns the underlying {@link IpcClient} lifecycle and starts it during initialization.
 *
 * ## Usage
 *
 * ### Publish / Subscribe
 * There are 2 main ways of sending and receiving messages over IPC in TypeScript:
 *
 * #### 1. TypeScript only JSON-based messages
 * This is the simplest form of IPC, where messages are sent as untyped JSON objects.
 * This is useful for simple message passing without the need for Rust code.
 *
 * ```typescript
 * // Send a message
 * await ipcService.send(OutgoingMessage.new_json_payload({ my: "data" }, "BrowserBackground", "my-topic"));
 *
 * // Receive messages
 * ipcService.messages$.subscribe((message: IncomingMessage) => {
 *  if (message.topic === "my-topic") {
 *    const data = incomingMessage.parse_payload_as_json();
 *    console.log("Received message:", data);
 *  }
 * });
 * ```
 *
 * #### 2. Rust compatible messages
 * If you need to send messages that can also be handled by Rust code you can use typed Rust structs
 * together with Rust functions to send and receive messages. For more information on typed structs
 * refer to `TypedOutgoingMessage` and `TypedIncomingMessage` in the SDK.
 *
 * For examples on how to use the RPC framework with Rust see the section below.
 *
 * ### RPC (Request / Response)
 * The RPC functionality is more complex than simple message passing and requires Rust code
 * to send and receive calls. For this reason, the service also exposes the underlying
 * {@link IpcClient} so it can be passed directly into Rust code.
 *
 * #### Rust code
 * ```rust
 *  #[wasm_bindgen(js_name = ipcRegisterPingHandler)]
 *  pub async fn ipc_register_ping_handler(ipc_client: &JsIpcClient) {
 *      ipc_client
 *          .client
 *           // See Rust docs for more information on how to implement a handler
 *          .register_rpc_handler(PingHandler::new())
 *          .await;
 *  }
 *
 *  #[wasm_bindgen(js_name = ipcRequestPing)]
 *  pub async fn ipc_request_ping(
 *      ipc_client: &JsIpcClient,
 *      destination: Endpoint,
 *      abort_signal: Option<AbortSignal>,
 *  ) -> Result<PingResponse, RequestError> {
 *      ipc_client
 *          .client
 *          .request(
 *              PingRequest,
 *              destination,
 *              abort_signal.map(|c| c.to_cancellation_token()),
 *          )
 *          .await
 *  }
 * ```
 *
 * #### TypeScript code
 * ```typescript
 * import { IpcService } from "@bitwarden/common/platform/ipc";
 * import { IpcClient, ipcRegisterPingHandler, ipcRequestPing } from "@bitwarden/sdk-internal";
 *
 * class MyService {
 *   constructor(private ipcService: IpcService) {}
 *
 *   async init() {
 *     await ipcRegisterPingHandler(this.ipcService.client);
 *   }
 *
 *   async ping(destination: Endpoint): Promise<PingResponse> {
 *     return await ipcRequestPing(this.ipcService.client, destination);
 *   }
 * }
 */
export abstract class IpcService {
  private _client?: IpcClient;

  /**
   * Access to the underlying {@link IpcClient} for advanced/Rust RPC usage.
   *
   * @throws If the service has not been initialized.
   */
  get client(): IpcClient {
    if (!this._client) {
      throw new Error("IpcService not initialized. Call init() first.");
    }
    return this._client;
  }

  private _messages$?: Observable<IncomingMessage>;

  /**
   * Hot stream of {@link IncomingMessage} from the IPC layer.
   *
   * @remarks
   * - Uses `shareReplay({ bufferSize: 0, refCount: true })`, so no events are replayed to late subscribers.
   *   Subscribe early if you must not miss messages.
   *
   * @throws If the service has not been initialized.
   */
  get messages$(): Observable<IncomingMessage> {
    if (!this._messages$) {
      throw new Error("IpcService not initialized. Call init() first.");
    }
    return this._messages$;
  }

  /**
   * Initializes the service and starts the IPC client.
   */
  abstract init(): Promise<void>;

  /**
   * Wires the provided {@link IpcClient}, starts it, and sets up the message stream.
   *
   * - Starts the client via `client.start()`.
   * - Subscribes to the client's receive loop and exposes it through {@link messages$}.
   * - Implementations may override `init` but should call this helper exactly once.
   */
  protected async initWithClient(client: IpcClient): Promise<void> {
    this._client = client;
    await this._client.start();

    this._messages$ = new Observable<IncomingMessage>((subscriber) => {
      let isSubscribed = true;
      const receiveLoop = async () => {
        const subscription = await this.client.subscribe();
        while (isSubscribed) {
          try {
            const message = await subscription.receive();
            subscriber.next(message);
          } catch (error) {
            subscriber.error(error);
            break;
          }
        }
      };
      void receiveLoop();

      return () => {
        isSubscribed = false;
      };
    }).pipe(shareReplay({ bufferSize: 0, refCount: true }));
  }

  /**
   * Sends an {@link OutgoingMessage} over IPC.
   *
   * @param message The message to send.
   * @throws If the service is not initialized or the underlying client fails to send.
   */
  async send(message: OutgoingMessage) {
    await this.client.send(message);
  }
}
