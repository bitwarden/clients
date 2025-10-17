// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ipcMain } from "electron";
import { concatMap, delay, filter, firstValueFrom, from, race, take, timer } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { sshagent, sshagent_v2 } from "@bitwarden/desktop-napi";

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
  private agentStateV1: sshagent.SshAgentState;
  private agentStateV2: sshagent_v2.SshAgentState;

  constructor(
    private logService: LogService,
    private messagingService: MessagingService,
  ) {
    ipcMain.handle("sshagent.init", async (event: any, message: any) => {
      if (message.version === 2) {
        this.init_v2();
      } else {
        this.init_v1();
      }
    });

    ipcMain.handle("sshagent.isloaded", async (event: any) => {
      return this.agentStateV1 != null && this.agentStateV2 != null;
    });

    ipcMain.handle(
      "sshagent.setkeys",
      async (event: any, keys: { name: string; privateKey: string; cipherId: string }[]) => {
        if (this.agentStateV1 != null && (await sshagent.isRunning(this.agentStateV1))) {
          sshagent.setKeys(this.agentStateV1, keys);
        }
        if (this.agentStateV2 != null && (await sshagent_v2.isRunning(this.agentStateV2))) {
          sshagent_v2.setKeys(this.agentStateV2, keys);
        }
      },
    );
    ipcMain.handle(
      "sshagent.signrequestresponse",
      async (event: any, { requestId, accepted }: { requestId: number; accepted: boolean }) => {
        this.requestResponses.push({ requestId, accepted, timestamp: new Date() });
      },
    );

    ipcMain.handle("sshagent.lock", async (event: any) => {
      if (this.agentStateV1 != null && (await sshagent.isRunning(this.agentStateV1))) {
        sshagent.lock(this.agentStateV1);
      }
      if (this.agentStateV2 != null && (await sshagent_v2.isRunning(this.agentStateV2))) {
        sshagent_v2.lock(this.agentStateV2);
      }
    });

    ipcMain.handle("sshagent.clearkeys", async (event: any) => {
      if (this.agentStateV1 != null) {
        sshagent.clearKeys(this.agentStateV1);
      }
      if (this.agentStateV2 != null) {
        sshagent_v2.clearKeys(this.agentStateV2);
      }
    });

    ipcMain.handle("sshagent.stop", async (event: any) => {
      if (this.agentStateV2 != null) {
        sshagent_v2.stop(this.agentStateV2);
        this.agentStateV2 = null;
      }
    });
  }

  init_v1() {
    // handle sign request passing to UI
    sshagent
      .serve(async (err: Error, sshUiRequest: sshagent.SshUiRequest) => {
        // clear all old (> SIGN_TIMEOUT) requests
        this.requestResponses = this.requestResponses.filter(
          (response) => response.timestamp > new Date(Date.now() - this.SIGN_TIMEOUT),
        );

        this.request_id += 1;
        const id_for_this_request = this.request_id;
        this.messagingService.send("sshagent.signrequest", {
          cipherId: sshUiRequest.cipherId,
          isListRequest: sshUiRequest.isList,
          requestId: id_for_this_request,
          processName: sshUiRequest.processName,
          isAgentForwarding: sshUiRequest.isForwarding,
          namespace: sshUiRequest.namespace,
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
        this.agentStateV1 = agentState;
        this.logService.info("SSH agent started");
      })
      .catch((e) => {
        this.logService.error("SSH agent encountered an error: ", e);
      });
  }

  init_v2() {
    // handle sign request passing to UI
    sshagent_v2
      .serve(async (err: Error, sshUiRequest: sshagent_v2.SshUiRequest) => {
        // clear all old (> SIGN_TIMEOUT) requests
        this.requestResponses = this.requestResponses.filter(
          (response) => response.timestamp > new Date(Date.now() - this.SIGN_TIMEOUT),
        );

        this.request_id += 1;
        const id_for_this_request = this.request_id;
        this.messagingService.send("sshagent.signrequest", {
          cipherId: sshUiRequest.cipherId,
          isListRequest: sshUiRequest.isList,
          requestId: id_for_this_request,
          processName: sshUiRequest.processName,
          isAgentForwarding: sshUiRequest.isForwarding,
          namespace: sshUiRequest.namespace,
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
      .then((agentState: sshagent_v2.SshAgentState) => {
        this.agentStateV2 = agentState;
        this.logService.info("SSH agent started");
      })
      .catch((e) => {
        this.logService.error("SSH agent encountered an error: ", e);
      });
  }
}
