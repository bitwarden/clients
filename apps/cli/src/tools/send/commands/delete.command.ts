import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendId } from "@bitwarden/common/types/guid";

import { Response } from "../../../models/response";

export class SendDeleteCommand {
  constructor(
    private sendService: SendService,
    private sendApiService: SendApiService,
  ) {}

  async run(id: string) {
    const sendId = id as SendId;
    const send = await this.sendService.getFromState(sendId);

    if (send == null) {
      return Response.notFound();
    }

    try {
      await this.sendApiService.delete(sendId);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }
}
