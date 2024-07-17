import { inject, Injectable } from "@angular/core";

import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service";
import { InternalSendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";

import { SendFormConfig } from "../abstractions/send-form-config.service";
import { SendFormService } from "../abstractions/send-form.service";

@Injectable()
export class DefaultSendFormService implements SendFormService {
  private sendApiService: SendApiService = inject(SendApiService);
  private sendService: InternalSendService = inject(SendService);

  async decryptSend(send: Send): Promise<SendView> {
    return await send.decrypt();
  }

  async saveSend(
    send: SendView,
    file: File | ArrayBuffer,
    config: SendFormConfig,
  ): Promise<SendView> {
    const sendData = await this.sendService.encrypt(send, file, send.password, null);
    const savedSend = await this.sendApiService.save(sendData);
    return await savedSend.decrypt();
  }
}
