// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OptionValues } from "commander";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { isGuid } from "@bitwarden/guid";

import { DownloadCommand } from "../../../commands/download.command";
import { Response } from "../../../models/response";
import { SendResponse } from "../models/send.response";

export class SendGetCommand extends DownloadCommand {
  constructor(
    private sendService: SendService,
    private environmentService: EnvironmentService,
    private searchService: SearchService,
    encryptService: EncryptService,
    apiService: ApiService,
    private accountService: AccountService,
  ) {
    super(encryptService, apiService);
  }

  async run(id: string, options: OptionValues) {
    const serveCommand = process.env.BW_SERVE === "true";
    if (serveCommand && !Utils.isGuid(id)) {
      return Response.badRequest("`" + id + "` is not a GUID.");
    }

    let sends = await this.getSendView(id);
    if (sends == null) {
      return Response.notFound();
    }

    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();
    let filter = (s: SendView) => true;
    let selector = async (s: SendView): Promise<Response> =>
      Response.success(new SendResponse(s, webVaultUrl));
    if (!serveCommand && options?.text != null) {
      filter = (s) => {
        return filter(s) && s.text != null;
      };
      selector = async (s) => {
        // Write to stdout and response success so we get the text string only to stdout
        process.stdout.write(s.text.text);
        return Response.success();
      };
    }

    if (Array.isArray(sends)) {
      if (filter != null) {
        sends = sends.filter(filter);
      }
      if (sends.length > 1) {
        return Response.multipleResults(sends.map((s) => s.id));
      }
      if (sends.length > 0) {
        return selector(sends[0]);
      } else {
        return Response.notFound();
      }
    }

    return selector(sends);
  }

  private async getSendView(id: string): Promise<SendView | SendView[]> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (isGuid(id)) {
      const send = await this.sendService.getFromState(id);
      if (send != null) {
        return await send.decrypt(activeUserId);
      }
    } else if (id.trim() !== "") {
      let sends = await this.sendService.getAllDecryptedFromState(activeUserId);
      sends = this.searchService.searchSends(sends, id);
      if (sends.length > 1) {
        return sends;
      } else if (sends.length > 0) {
        return sends[0];
      }
    }
  }
}
