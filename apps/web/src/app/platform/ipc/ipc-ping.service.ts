import { Injectable } from "@angular/core";
import { filter, firstValueFrom } from "rxjs";

import { IpcService } from "@bitwarden/common/platform/ipc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OutgoingMessage } from "@bitwarden/sdk-internal";

/**
 * Example service that sends a "ping" message and waits for a "pong" response.
 * This is a simple example of how to use the IpcService to send and receive messages.
 */
@Injectable({ providedIn: "root" })
export class IpcPingService {
  constructor(private ipcService: IpcService) {}

  async init() {
    // Allow devs to call this function from the browser web console:
    // ```js
    //   await ping();
    // ```
    (window as any).ping = () => this.ping();
  }

  async ping() {
    const responsePromise = firstValueFrom(
      this.ipcService.messages$.pipe(
        filter((m) => Utils.fromBufferToUtf8(new Uint8Array(m.payload)) === "pong"),
      ),
    );

    // eslint-disable-next-line no-console
    console.log("Sending ping...");
    await this.ipcService.send(
      new OutgoingMessage(Utils.fromUtf8ToArray("ping"), "BrowserBackground"),
    );
    // eslint-disable-next-line no-console
    console.log("Waiting for pong...");
    const response = await responsePromise;
    // eslint-disable-next-line no-console
    console.log("Received pong:", response);
    return response;
  }
}
