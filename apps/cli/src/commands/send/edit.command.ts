import { SendService } from "@bitwarden/common/abstractions/send.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { SendType } from "@bitwarden/common/enums/sendType";
import { Guid } from "@bitwarden/common/types/guid";

import { Response } from "../../models/response";
import { SendResponse } from "../../models/response/send.response";
import { CliUtils } from "../../utils";

import { SendGetCommand } from "./get.command";

export class SendEditCommand {
  constructor(
    private sendService: SendService,
    private stateService: StateService,
    private getCommand: SendGetCommand
  ) {}

  async run(requestJson: string, cmdOptions: Record<string, any>): Promise<Response> {
    if (process.env.BW_SERVE !== "true" && (requestJson == null || requestJson === "")) {
      requestJson = await CliUtils.readStdin();
    }

    if (requestJson == null || requestJson === "") {
      return Response.badRequest("`requestJson` was not provided.");
    }

    let req: SendResponse = null;
    if (typeof requestJson !== "string") {
      req = requestJson;
      req.deletionDate = req.deletionDate == null ? null : new Date(req.deletionDate);
      req.expirationDate = req.expirationDate == null ? null : new Date(req.expirationDate);
    } else {
      try {
        const reqJson = Buffer.from(requestJson, "base64").toString();
        req = SendResponse.fromJson(reqJson);
      } catch (e) {
        return Response.badRequest("Error parsing the encoded request data.");
      }
    }

    const normalizedOptions = new Options(cmdOptions);
    req.id = normalizedOptions.itemId || req.id;

    if (req.id != null) {
      req.id = req.id.toLowerCase() as Guid;
    }

    const send = await this.sendService.get(req.id);

    if (send == null) {
      return Response.notFound();
    }

    if (send.type !== req.type) {
      return Response.badRequest("Cannot change a Send's type");
    }

    if (send.type === SendType.File && !(await this.stateService.getCanAccessPremium())) {
      return Response.error("Premium status is required to use this feature.");
    }

    let sendView = await send.decrypt();
    sendView = SendResponse.toView(req, sendView);

    if (typeof req.password !== "string" || req.password === "") {
      req.password = null;
    }

    try {
      const [encSend, encFileData] = await this.sendService.encrypt(sendView, null, req.password);
      // Add dates from template
      encSend.deletionDate = sendView.deletionDate;
      encSend.expirationDate = sendView.expirationDate;

      await this.sendService.saveWithServer([encSend, encFileData]);
    } catch (e) {
      return Response.error(e);
    }

    return await this.getCommand.run(send.id, {});
  }
}

class Options {
  itemId: Guid;

  constructor(passedOptions: Record<string, any>) {
    this.itemId = passedOptions?.itemId || passedOptions?.itemid;
  }
}
