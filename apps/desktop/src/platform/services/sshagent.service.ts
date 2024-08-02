import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DialogService } from "@bitwarden/components";

@Injectable({
  providedIn: "root",
})
export class SSHAgentService {
  constructor(
    private cipherService: CipherService,
    private logService: LogService,
    private dialogService: DialogService,
    private messageListener: MessageListener,
  ) {
    this.messageListener
      .messages$(new CommandDefinition("sshagent.signrequest"))
      .subscribe((message: any) => {
        const uuid = message.data;
        (async () => {
          const result = await this.dialogService.openSimpleDialog({
            title: "SSH Agent",
            content: "Allow SSH Agent to sign the request? uuid: " + uuid,
            acceptButtonText: "Allow",
            cancelButtonText: "Deny",
            type: "primary",
          });
          this.logService.info("ssh agent dialog res", result);
          await ipc.platform.sshagent.signRequestResponse("", result);
          this.logService.info("ssh agent dialog res sent");
        })()
          .then(() => {})
          .catch(() => {});
      });

    setInterval(async () => {
      const ciphers = await this.cipherService.getAllDecrypted();
      if (ciphers == null) {
        await ipc.platform.sshagent.setKeys([]);
        return;
      }

      const noteCiphers = ciphers.filter((cipher) => cipher.type == CipherType.SSHKey);
      const keys = noteCiphers.map((cipher) => {
        return {
          name: cipher.name,
          privateKey: cipher.sshKey.privateKey,
          uuid: cipher.id,
        };
      });
      await ipc.platform.sshagent.setKeys(keys);
    }, 20000);
  }
}
