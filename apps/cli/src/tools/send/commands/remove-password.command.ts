// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { SendService } from "@bitwarden/common/tools/send/services//send.service.abstraction";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendDecryptionService } from "@bitwarden/common/tools/send/services/send-decryption.service";

import { Response } from "../../../models/response";
import { SendResponse } from "../models/send.response";

export class SendRemovePasswordCommand {
  constructor(
    private sendService: SendService,
    private sendApiService: SendApiService,
    private environmentService: EnvironmentService,
    private accountService: AccountService,
    private sendDecryptionService: SendDecryptionService,
  ) {}

  async run(id: string) {
    try {
      await this.sendApiService.removePassword(id);

      const updatedSend = await firstValueFrom(this.sendService.get$(id));
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const decSend = await this.sendDecryptionService.decryptSend(updatedSend, activeUserId);
      const env = await firstValueFrom(this.environmentService.environment$);
      const sendUrl = env.getSendUrl();
      const res = new SendResponse(decSend, sendUrl);
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }
}
