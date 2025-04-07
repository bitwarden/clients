import { Observable, shareReplay } from "rxjs";

import { IpcClient, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

export abstract class IpcService {
  protected client: IpcClient;

  messages$: Observable<IncomingMessage>;

  async init(): Promise<void> {
    this.messages$ = new Observable<IncomingMessage>((subscriber) => {
      let isSubscribed = true;

      const receiveLoop = async () => {
        while (isSubscribed) {
          try {
            const message = await this.client.receive();
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
