import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { sshagent } from "@bitwarden/desktop-napi";

export class SSHAgent {
  private requestResponses: Map<string, boolean> = new Map();

  constructor(
    private logService: LogService,
    private messagingService: MessagingService,
  ) {}

  init() {
    this.logService.info("ts: Starting ssh agent");

    sshagent
      .generateEd25519()
      .then((key) => {
        this.logService.info("ts: SSH agent generated key", key);
      })
      .catch((e) => {
        this.logService.error("ts: SSH agent error", e);
      });

    sshagent
      .serve(async (err: Error, uuid: string) => {
        this.logService.info("ts: SSH agent callback");
        this.messagingService.send("sshagent.signrequest", { data: uuid });
        const start = Date.now();
        while (this.requestResponses.size === 0) {
          await new Promise((res) => setTimeout(res, 1000));
          this.logService.info("ts: SSH agent waiting for response");
          if (Date.now() - start > 60000) {
            this.logService.error("ts: SSH agent timeout");
            return false;
          }
        }

        const [id, accepted] = Array.from(this.requestResponses.entries())[0];
        this.logService.info("id, accepted", id, accepted);
        this.requestResponses.clear();

        return accepted;
      })
      .then((a) => {
        this.logService.info("ts: SSH serving...");
      })
      .catch((e) => {
        this.logService.error("ts: SSH agent error", e);
      });

    ipcMain.handle(
      "sshagent.setkeys",
      async (event: any, keys: { name: string; privateKey: string; uuid: string }[]) => {
        await sshagent.setKeys(keys);
      },
    );
    ipcMain.handle(
      "sshagent.signrequestresponse",
      async (event: any, { id, accepted }: { id: string; accepted: boolean }) => {
        this.logService.info("ts: SSH agent sign request response", id, accepted);
        this.requestResponses.set(id, accepted);
      },
    );
  }
}
