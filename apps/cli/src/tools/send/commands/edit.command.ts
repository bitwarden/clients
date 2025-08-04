// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";

import { Response } from "../../../models/response";
import { CliUtils } from "../../../utils";
import { SendResponse } from "../models/send.response";

import { SendGetCommand } from "./get.command";

export class SendEditCommand {
  constructor(
    private sendService: SendService,
    private getCommand: SendGetCommand,
    private sendApiService: SendApiService,
    private accountProfileService: BillingAccountProfileStateService,
    private accountService: AccountService,
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
        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        return Response.badRequest("Error parsing the encoded request data.");
      }
    }

    const normalizedOptions = new Options(cmdOptions);
    req.id = normalizedOptions.itemId || req.id;
    if (normalizedOptions.emails) {
      req.emails = normalizedOptions.emails;
      req.password = undefined;
    } else if (normalizedOptions.password) {
      req.emails = undefined;
      req.password = normalizedOptions.password;
    } else if (req.password && (typeof req.password !== "string" || req.password === "")) {
      req.password = undefined;
    }

    if (!req.id) {
      return Response.error("`itemid` was not provided.");
    }

    req.id = req.id.toLowerCase();
    const send = await this.sendService.getFromState(req.id);

    if (send == null) {
      return Response.notFound();
    }

    if (send.type !== req.type) {
      return Response.badRequest("Cannot change a Send's type");
    }

    const account = await firstValueFrom(this.accountService.activeAccount$);
    const canAccessPremium = await firstValueFrom(
      this.accountProfileService.hasPremiumFromAnySource$(account.id),
    );
    if (send.type === SendType.File && !canAccessPremium) {
      return Response.error("Premium status is required to use this feature.");
    }

    let sendView = await send.decrypt();
    sendView = SendResponse.toView(req, sendView);

    try {
      const [encSend, encFileData] = await this.sendService.encrypt(sendView, null, req.password);
      // Add dates from template
      encSend.deletionDate = sendView.deletionDate;
      encSend.expirationDate = sendView.expirationDate;

      await this.sendApiService.save([encSend, encFileData]);
    } catch (e) {
      return Response.error(e);
    }

    return await this.getCommand.run(send.id, {});
  }
}

class Options {
  itemId: string;
  password: string;
  emails: string[];

  constructor(passedOptions: Record<string, any>) {
    this.itemId = passedOptions?.itemId || passedOptions?.itemid;
    this.password = passedOptions.password;
    this.emails = passedOptions.email;
  }
}
