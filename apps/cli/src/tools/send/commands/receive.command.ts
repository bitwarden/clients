// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OptionValues } from "commander";
import * as inquirer from "inquirer";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendAccess } from "@bitwarden/common/tools/send/models/domain/send-access";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { KeyService } from "@bitwarden/key-management";
import { NodeUtils } from "@bitwarden/node/node-utils";

import { DownloadCommand } from "../../../commands/download.command";
import { Response } from "../../../models/response";
import { SendAccessResponse } from "../models/send-access.response";

export class SendReceiveCommand extends DownloadCommand {
  private canInteract: boolean;
  private decKey: SymmetricCryptoKey;
  private sendAccessRequest: SendAccessRequest;

  constructor(
    private keyService: KeyService,
    encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private sendApiService: SendApiService,
    apiService: ApiService,
  ) {
    super(encryptService, apiService);
  }

  async run(url: string, options: OptionValues): Promise<Response> {
    this.canInteract = process.env.BW_NOINTERACTION !== "true";

    let urlObject: URL;
    try {
      urlObject = new URL(url);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return Response.badRequest("Failed to parse the provided Send url");
    }

    const apiUrl = await this.getApiUrl(urlObject);
    const [id, key] = this.getIdAndKey(urlObject);

    if (Utils.isNullOrWhitespace(id) || Utils.isNullOrWhitespace(key)) {
      return Response.badRequest("Failed to parse url, the url provided is not a valid Send url");
    }

    const keyArray = Utils.fromUrlB64ToArray(key);
    this.sendAccessRequest = new SendAccessRequest();

    let password = options.password;
    if (password == null || password === "") {
      if (options.passwordfile) {
        password = await NodeUtils.readFirstLine(options.passwordfile);
      } else if (options.passwordenv && process.env[options.passwordenv]) {
        password = process.env[options.passwordenv];
      }
    }

    if (password != null && password !== "") {
      this.sendAccessRequest.password = await this.getUnlockedPassword(password, keyArray);
    }

    const response = await this.sendRequest(apiUrl, id, keyArray);

    if (response instanceof Response) {
      // Error scenario
      return response;
    }

    if (options.obj != null) {
      return Response.success(new SendAccessResponse(response));
    }

    switch (response.type) {
      case SendType.Text:
        // Write to stdout and response success so we get the text string only to stdout
        process.stdout.write(response?.text?.text);
        return Response.success();
      case SendType.File: {
        const downloadData = await this.sendApiService.getSendFileDownloadData(
          response,
          this.sendAccessRequest,
          apiUrl,
        );
        return await this.saveAttachmentToFile(
          downloadData.url,
          this.decKey,
          response?.file?.fileName,
          options.output,
        );
      }
      default:
        return Response.success(new SendAccessResponse(response));
    }
  }

  private getIdAndKey(url: URL): [string, string] {
    const result = url.hash.slice(1).split("/").slice(-2);
    return [result[0], result[1]];
  }

  private async getApiUrl(url: URL) {
    const env = await firstValueFrom(this.environmentService.environment$);
    const urls = env.getUrls();
    if (url.origin === "https://send.bitwarden.com") {
      return "https://api.bitwarden.com";
    } else if (url.origin === urls.api) {
      return url.origin;
    } else if (this.platformUtilsService.isDev() && url.origin === urls.webVault) {
      return urls.api;
    } else {
      return url.origin + "/api";
    }
  }

  private async getUnlockedPassword(password: string, keyArray: Uint8Array) {
    const passwordHash = await this.cryptoFunctionService.pbkdf2(
      password,
      keyArray,
      "sha256",
      100000,
    );
    return Utils.fromBufferToB64(passwordHash);
  }

  private async sendRequest(
    url: string,
    id: string,
    key: Uint8Array,
  ): Promise<Response | SendAccessView> {
    try {
      const sendResponse = await this.sendApiService.postSendAccess(
        id,
        this.sendAccessRequest,
        url,
      );

      const sendAccess = new SendAccess(sendResponse);
      this.decKey = await this.keyService.makeSendKey(key);
      return await sendAccess.decrypt(this.decKey);
    } catch (e) {
      if (e instanceof ErrorResponse) {
        if (e.statusCode === 401) {
          if (this.canInteract) {
            const answer: inquirer.Answers = await inquirer.createPromptModule({
              output: process.stderr,
            })({
              type: "password",
              name: "password",
              message: "Send password:",
            });

            // reattempt with new password
            this.sendAccessRequest.password = await this.getUnlockedPassword(answer.password, key);
            return await this.sendRequest(url, id, key);
          }

          return Response.badRequest("Incorrect or missing password");
        } else if (e.statusCode === 405) {
          return Response.badRequest("Bad Request");
        } else if (e.statusCode === 404) {
          return Response.notFound();
        }
      }
      return Response.error(e);
    }
  }
}
