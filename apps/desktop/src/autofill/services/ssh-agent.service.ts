// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable, OnDestroy } from "@angular/core";
import { concatMap, firstValueFrom, Subject, takeUntil } from "rxjs";

import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { DialogService } from "@bitwarden/components";

import { ApproveSshRequestComponent } from "../components/approve-ssh-request";
import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";

/**
 * The renderer's SSH agent surface. The main process owns the agent (socket, signing, key
 * provisioning, and authorization decisions) and only asks the renderer to show the approval
 * dialog, so this is a pure dialog host.
 */
@Injectable({
  providedIn: "root",
})
export class SshAgentService implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private dialogService: DialogService,
    private messageListener: MessageListener,
  ) {}

  async init() {
    this.messageListener
      .messages$(new CommandDefinition(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST))
      .pipe(
        concatMap(async (message) => {
          const dialogRef = ApproveSshRequestComponent.open(
            this.dialogService,
            message.cipherName as string,
            message.application as string,
            message.isAgentForwarding as boolean,
            message.namespace as string,
          );

          const accepted = await firstValueFrom(dialogRef.closed);
          await ipc.autofill.sshAgent.signRequestResponse(message.requestId as number, accepted);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
