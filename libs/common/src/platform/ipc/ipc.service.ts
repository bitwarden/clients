import { Observable, shareReplay } from "rxjs";

import { IpcClient, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

export abstract class IpcService {
  private _client?: IpcClient;
  get client(): IpcClient {
    if (!this._client) {
      throw new Error("IpcService not initialized");
    }
    return this._client;
  }

  private _messages$?: Observable<IncomingMessage>;
  protected get messages$(): Observable<IncomingMessage> {
    if (!this._messages$) {
      throw new Error("IpcService not initialized");
    }
    return this._messages$;
  }

  abstract init(): Promise<void>;

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

  async send(message: OutgoingMessage) {
    await this.client.send(message);
  }
}
