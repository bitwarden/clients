// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable } from "@angular/core";
import { combineLatest, firstValueFrom, map } from "rxjs";

import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SendId } from "@bitwarden/common/types/guid";

import { SendPolicyService } from "../../services/send-policy.service";
import {
  SendFormConfig,
  SendFormConfigService,
  SendFormMode,
} from "../abstractions/send-form-config.service";

/**
 * Default implementation of the `SendFormConfigService`.
 */
@Injectable()
export class DefaultSendFormConfigService implements SendFormConfigService {
  private sendService: SendService = inject(SendService);
  private sendPolicyService: SendPolicyService = inject(SendPolicyService);

  async buildConfig(
    mode: SendFormMode,
    sendId?: SendId,
    sendType?: SendType,
  ): Promise<SendFormConfig> {
    const [areSendsAllowed, send] = await firstValueFrom(
      combineLatest([this.areSendsEnabled$, this.getSend(sendId)]),
    );

    return {
      mode,
      sendType: send?.type ?? sendType ?? SendType.Text,
      areSendsAllowed,
      originalSend: send,
    };
  }

  private areSendsEnabled$ = this.sendPolicyService.disableSend$.pipe(
    map((disableSend) => !disableSend),
  );

  private getSend(id?: SendId) {
    if (id == null) {
      return Promise.resolve(null);
    }
    return this.sendService.get$(id);
  }
}
