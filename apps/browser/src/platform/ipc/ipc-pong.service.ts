import { IpcService } from "@bitwarden/common/platform/ipc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OutgoingMessage } from "@bitwarden/sdk-internal";

/**
 * Example service that responds to "ping" messages with "pong".
 * This is a simple example of how to use the IpcService to send and receive messages.
 * It listens for incoming messages and sends a response back to the sender.
 */
export class IpcPongService {
  constructor(private ipcService: IpcService) {}

  /** Must be initalized after IpcService */
  async init() {
    this.ipcService.messages$.subscribe((message) => {
      if (Utils.fromBufferToUtf8(new Uint8Array(message.payload)) === "ping") {
        void this.ipcService.send(
          new OutgoingMessage(Utils.fromUtf8ToArray("pong"), message.source),
        );
      }
    });
  }
}
