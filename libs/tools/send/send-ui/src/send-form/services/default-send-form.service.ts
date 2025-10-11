// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";

import { SendFormConfig } from "../abstractions/send-form-config.service";
import { SendFormService } from "../abstractions/send-form.service";

@Injectable()
export class DefaultSendFormService implements SendFormService {
  private accountService = inject(AccountService);
  private sendApiService: SendApiService = inject(SendApiService);
  private sendService = inject(SendService);

  async decryptSend(send: Send): Promise<SendView> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await send.decrypt(userId);
  }

  async saveSend(send: SendView, file: File | ArrayBuffer, config: SendFormConfig) {
    const sendData = await this.sendService.encrypt(send, file, send.password, null);
    const newSend = await this.sendApiService.save(sendData);
    return await this.decryptSend(newSend);
  }
}
