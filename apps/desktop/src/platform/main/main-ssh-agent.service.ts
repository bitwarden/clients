import { ipcMain } from "electron";
import { concatMap, delay, filter, firstValueFrom, from, race, take, timer } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { sshagent } from "@bitwarden/desktop-napi";

class AgentResponse {
  requestId: number;
  accepted: boolean;
  timestamp: Date;
}

export class MainSshAgentService {
  SIGN_TIMEOUT = 60_000;
  REQUEST_POLL_INTERVAL = 50;

  private requestResponses: AgentResponse[] = [];
  private request_id = 0;
  private agentState: sshagent.SshAgentState;

  constructor(
    private logService: LogService,
    private messagingService: MessagingService,
  ) {}

  init() {
    // handle sign request passing to UI
    sshagent
      .serve(async (err: Error, cipherId: string) => {
        // clear all old (> SIGN_TIMEOUT) requests
        this.requestResponses = this.requestResponses.filter(
          (response) => response.timestamp > new Date(Date.now() - this.SIGN_TIMEOUT),
        );

        this.request_id += 1;
        const id_for_this_request = this.request_id;
        this.messagingService.send("sshagent.signrequest", {
          cipherId,
          requestId: id_for_this_request,
        });

        const result = await firstValueFrom(
          race(
            from([false]).pipe(delay(this.SIGN_TIMEOUT)),

            //poll for response
            timer(0, this.REQUEST_POLL_INTERVAL).pipe(
              concatMap(() => from(this.requestResponses)),
              filter((response) => response.requestId == id_for_this_request),
              take(1),
              concatMap(() => from([true])),
            ),
          ),
        );

        if (!result) {
          return false;
        }

        const response = this.requestResponses.find(
          (response) => response.requestId == id_for_this_request,
        );

        this.requestResponses = this.requestResponses.filter(
          (response) => response.requestId != id_for_this_request,
        );

        return response.accepted;
      })
      .then((agentState: sshagent.SshAgentState) => {
        this.agentState = agentState;
        this.logService.info("SSH agent started");
      })
      .catch((e) => {
        this.logService.error("SSH agent encountered an error: ", e);
      });

    ipcMain.handle(
      "sshagent.setkeys",
      async (event: any, keys: { name: string; privateKey: string; cipherId: string }[]) => {
        if (this.agentState != null) {
          sshagent.setKeys(this.agentState, keys);
        }
      },
    );
    ipcMain.handle(
      "sshagent.signrequestresponse",
      async (event: any, { requestId, accepted }: { requestId: number; accepted: boolean }) => {
        this.requestResponses.push({ requestId, accepted, timestamp: new Date() });
      },
    );
    ipcMain.handle(
      "sshagent.generatekey",
      async (event: any, { keyAlgorithm }: { keyAlgorithm: string }): Promise<sshagent.SshKey> => {
        return await sshagent.generateKeypair(keyAlgorithm);
      },
    );
    ipcMain.handle(
      "sshagent.importkey",
      async (
        event: any,
        { privateKey, password }: { privateKey: string; password?: string },
      ): Promise<sshagent.SshKeyImportResult> => {
        return sshagent.importKey(privateKey, password);
      },
    );

    ipcMain.handle("sshagent.lock", async (event: any) => {
      if (this.agentState != null) {
        sshagent.lock(this.agentState);
      }
    });
  }
}
