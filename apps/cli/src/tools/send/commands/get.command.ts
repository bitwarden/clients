// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OptionValues } from "commander";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

import { DownloadCommand } from "../../../commands/download.command";
import { Response } from "../../../models/response";
import { SendResponse } from "../models/send.response";

import { SendReceiveCommand } from "./receive.command";

export class SendGetCommand extends DownloadCommand {
  constructor(
    private sendService: SendService,
    private environmentService: EnvironmentService,
    private searchService: SearchService,
    encryptService: EncryptService,
    apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private keyService: KeyService,
    private cryptoFunctionService: CryptoFunctionService,
    private sendApiService: SendApiService,
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

    if (options?.file || options?.output || options?.raw) {
      const sendWithUrl = new SendResponse(sends, webVaultUrl);
      const receiveCommand = new SendReceiveCommand(
        this.keyService,
        this.encryptService,
        this.cryptoFunctionService,
        this.platformUtilsService,
        this.environmentService,
        this.sendApiService,
        this.apiService,
      );
      return await receiveCommand.run(sendWithUrl.accessUrl, options);
    }

    return selector(sends);
  }

  private async getSendView(id: string): Promise<SendView | SendView[]> {
    if (Utils.isGuid(id)) {
      const send = await this.sendService.getFromState(id);
      if (send != null) {
        return await send.decrypt();
      }
    } else if (id.trim() !== "") {
      let sends = await this.sendService.getAllDecryptedFromState();
      sends = this.searchService.searchSends(sends, id);
      if (sends.length > 1) {
        return sends;
      } else if (sends.length > 0) {
        return sends[0];
      }
    }
  }
}
