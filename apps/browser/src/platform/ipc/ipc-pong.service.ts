import { IpcService } from "@bitwarden/common/platform/ipc";
import { Utils } from "@bitwarden/common/platform/misc/utils";

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
      if (Utils.fromBufferToUtf8(new Uint8Array(message.data)) === "ping") {
        void this.ipcService.send({
          data: Array.from(Utils.fromUtf8ToArray("pong")),
          destination: message.source,
        });
      }
    });
  }
}
