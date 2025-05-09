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
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { KeyService } from "@bitwarden/key-management";
import { NodeUtils } from "@bitwarden/node/node-utils";

import { SendDownload } from "../../../commands/send-download.command";
import { Response } from "../../../models/response";
import { SendAccessResponse } from "../models/send-access.response";
import { SendResponse } from "../models/send.response";

// Note: DownloadCommand is actually an abstract class
export class SendDownloadService extends SendDownload {
  private decKey: SymmetricCryptoKey;

  constructor(
    protected environmentService: EnvironmentService,
    encryptService: EncryptService,
    apiService: ApiService,
    protected platformUtilsService: PlatformUtilsService,
    private keyService: KeyService,
    private cryptoFunctionService: CryptoFunctionService,
    private sendApiService: SendApiService,
  ) {
    super(encryptService, apiService, environmentService, platformUtilsService);
  }

  async download(sends: SendView, options: OptionValues) {
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();

    const selector = async (s: SendView): Promise<Response> =>
      Response.success(new SendResponse(s, webVaultUrl));

    // only attempt to download if requested
    if (options?.file || options?.output || options?.raw) {
      // generate the send url
      const sendWithUrl = new SendResponse(sends, webVaultUrl);

      // create the url object - which will contain the id and the key
      const urlObject = this.createUrlObject(sendWithUrl.accessUrl);
      if (urlObject == null) {
        return Response.badRequest("Failed to parse the provided Send url");
      }

      // get the url for the api and along with the id and key
      const apiUrl = await this.getApiUrl(urlObject);
      const [id, key] = this.getIdAndKey(urlObject);
      if (Utils.isNullOrWhitespace(id) || Utils.isNullOrWhitespace(key)) {
        return Response.badRequest("Failed to parse url, the url provided is not a valid Send url");
      }

      const keyArray = Utils.fromUrlB64ToArray(key);
      const password =
        options.password ||
        (options.passwordfile && (await NodeUtils.readFirstLine(options.passwordfile))) ||
        (options.passwordenv && process.env[options.passwordenv]) ||
        "";

      const sendAccessRequest = new SendAccessRequest();
      if (password !== "") {
        sendAccessRequest.password = await this.getUnlockedPassword(password, keyArray);
      }

      // request the file from the server
      const response = await this.sendRequest(apiUrl, id, keyArray, sendAccessRequest);
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
            sendAccessRequest,
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

    return selector(sends);
  }

  private createUrlObject(url: string): URL | null {
    try {
      return new URL(url);
    } catch {
      return null;
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
    sendAccessRequest: SendAccessRequest,
  ): Promise<Response | SendAccessView> {
    try {
      const sendResponse = await this.sendApiService.postSendAccess(id, sendAccessRequest, url);

      const sendAccess = new SendAccess(sendResponse);
      this.decKey = await this.keyService.makeSendKey(key);
      return await sendAccess.decrypt(this.decKey);
    } catch (e) {
      if (e instanceof ErrorResponse) {
        if (e.statusCode === 401) {
          const answer: inquirer.Answers = await inquirer.createPromptModule({
            output: process.stderr,
          })({
            type: "password",
            name: "password",
            message: "Send password:",
          });

          // reattempt with new password
          sendAccessRequest.password = await this.getUnlockedPassword(answer.password, key);
          return await this.sendRequest(url, id, key, sendAccessRequest);
        } else if (e.statusCode === 405) {
          return Response.badRequest("Bad Request");
        } else if (e.statusCode === 404) {
          return Response.notFound();
        }
      }
      return Response.error(e);
    }
  }

  protected getIdAndKey(url: URL): [string, string] {
    const result = url.hash.slice(1).split("/").slice(-2);
    return [result[0], result[1]];
  }

  protected async getApiUrl(url: URL) {
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
}
