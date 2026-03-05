// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OptionValues } from "commander";
import * as inquirer from "inquirer";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  SendTokenService,
  SendAccessToken,
  emailRequired,
  emailAndOtpRequired,
  otpInvalid,
  passwordHashB64Required,
  passwordHashB64Invalid,
  sendIdInvalid,
  SendHashedPasswordB64,
  SendOtp,
  GetSendAccessTokenError,
  SendAccessDomainCredentials,
} from "@bitwarden/common/auth/send-access";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendAccess } from "@bitwarden/common/tools/send/models/domain/send-access";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
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
    private sendTokenService: SendTokenService,
    private configService: ConfigService,
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

    const sendEmailOtpEnabled = await this.configService.getFeatureFlag(FeatureFlag.SendEmailOTP);

    if (sendEmailOtpEnabled) {
      return await this.attemptV2Access(apiUrl, id, keyArray, options);
    } else {
      return await this.attemptV1Access(apiUrl, id, keyArray, options);
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

  private async attemptV1Access(
    apiUrl: string,
    id: string,
    keyArray: Uint8Array,
    options: OptionValues,
  ): Promise<Response> {
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
      return response;
    }

    if (options.obj != null) {
      return Response.success(new SendAccessResponse(response));
    }

    switch (response.type) {
      case SendType.Text:
        process.stdout.write(response?.text?.text);
        return Response.success();
      case SendType.File: {
        const downloadData = await this.sendApiService.getSendFileDownloadData(
          response,
          this.sendAccessRequest,
          apiUrl,
        );

        const decryptBufferFn = async (resp: globalThis.Response) => {
          const encBuf = await EncArrayBuffer.fromResponse(resp);
          return this.encryptService.decryptFileData(encBuf, this.decKey);
        };

        return await this.saveAttachmentToFile(
          downloadData.url,
          response?.file?.fileName,
          decryptBufferFn,
          options.output,
        );
      }
      default:
        return Response.success(new SendAccessResponse(response));
    }
  }

  private async attemptV2Access(
    apiUrl: string,
    id: string,
    keyArray: Uint8Array,
    options: OptionValues,
  ): Promise<Response> {
    let authType: AuthType = AuthType.None;

    const currentResponse = await this.getTokenWithRetry(id);

    if (currentResponse instanceof SendAccessToken) {
      return await this.accessSendWithToken(currentResponse, keyArray, apiUrl, options);
    }

    if (currentResponse.kind === "expected_server") {
      const error = currentResponse.error;

      if (emailRequired(error)) {
        authType = AuthType.Email;
      } else if (passwordHashB64Required(error)) {
        authType = AuthType.Password;
      } else if (sendIdInvalid(error)) {
        return Response.notFound();
      }
    } else {
      return this.handleError(currentResponse);
    }

    // Handle authentication based on type
    if (authType === AuthType.Email) {
      if (!this.canInteract) {
        return Response.badRequest("Email verification required. Run in interactive mode.");
      }
      return await this.handleEmailOtpAuth(id, keyArray, apiUrl, options);
    } else if (authType === AuthType.Password) {
      return await this.handlePasswordAuth(id, keyArray, apiUrl, options);
    }

    // The auth layer will immediately return a token for Sends with AuthType.None
    // If this code is reached, something has gone wrong
    if (authType === AuthType.None) {
      return Response.error("Could not determine authentication requirements");
    }

    return Response.error("Authentication failed");
  }

  private async getTokenWithRetry(
    sendId: string,
    credentials?: SendAccessDomainCredentials,
  ): Promise<SendAccessToken | GetSendAccessTokenError> {
    let expiredAttempts = 0;

    while (expiredAttempts < 3) {
      const response = credentials
        ? await firstValueFrom(this.sendTokenService.getSendAccessToken$(sendId, credentials))
        : await firstValueFrom(this.sendTokenService.tryGetSendAccessToken$(sendId));

      if (response instanceof SendAccessToken) {
        return response;
      }

      if (response.kind === "expired") {
        expiredAttempts++;
        continue;
      }

      // Not expired, return the response for caller to handle
      return response;
    }

    // After 3 expired attempts, return an error response
    return {
      kind: "unknown",
      error: "Send access token has expired and could not be refreshed",
    };
  }

  private handleError(error: GetSendAccessTokenError): Response {
    if (error.kind === "unexpected_server") {
      return Response.error("Server error: " + JSON.stringify(error.error));
    }

    return Response.error("Error: " + JSON.stringify(error.error));
  }

  private async promptForOtp(sendId: string, email: string): Promise<SendOtp> {
    const otpAnswer = await inquirer.createPromptModule({ output: process.stderr })({
      type: "input",
      name: "otp",
      message: "Enter the verification code sent to your email:",
    });
    return otpAnswer.otp;
  }

  private async promptForEmail(): Promise<string> {
    const emailAnswer = await inquirer.createPromptModule({ output: process.stderr })({
      type: "input",
      name: "email",
      message: "Enter your email address:",
      validate: (input: string) => {
        if (!input || !input.includes("@")) {
          return "Please enter a valid email address";
        }
        return true;
      },
    });
    return emailAnswer.email;
  }

  private async handleEmailOtpAuth(
    sendId: string,
    keyArray: Uint8Array,
    apiUrl: string,
    options: OptionValues,
  ): Promise<Response> {
    const email = await this.promptForEmail();

    const emailResponse = await this.getTokenWithRetry(sendId, {
      kind: "email",
      email: email,
    });

    if (emailResponse instanceof SendAccessToken) {
      /*
        At this point emailResponse should only be expected to be a GetSendAccessTokenError type,
        but TS must have a logical branch in case it is a SendAccessToken type. If a valid token is
        returned by the method above, something has gone wrong.
       */

      return Response.error("Unexpected server response");
    }

    if (emailResponse.kind === "expected_server") {
      const error = emailResponse.error;

      if (emailAndOtpRequired(error)) {
        const promptResponse = await this.promptForOtp(sendId, email);

        // Use retry helper for expired token handling
        const otpResponse = await this.getTokenWithRetry(sendId, {
          kind: "email_otp",
          email: email,
          otp: promptResponse,
        });

        if (otpResponse instanceof SendAccessToken) {
          return await this.accessSendWithToken(otpResponse, keyArray, apiUrl, options);
        }

        if (otpResponse.kind === "expected_server") {
          const error = otpResponse.error;

          if (otpInvalid(error)) {
            return Response.badRequest("Invalid email or verification code");
          }

          /*
            If the following evaluates to true, it means that the email address provided was not
            configured to be used for email OTP for this Send.

            To avoid leaking information that would allow email enumeration, instead return an
            error indicating that some component of the email OTP challenge was invalid.
           */
          if (emailAndOtpRequired(error)) {
            return Response.badRequest("Invalid email or verification code");
          }
        }
        return this.handleError(otpResponse);
      }
    }
    return this.handleError(emailResponse);
  }

  private async handlePasswordAuth(
    sendId: string,
    keyArray: Uint8Array,
    apiUrl: string,
    options: OptionValues,
  ): Promise<Response> {
    let password = options.password;

    if (password == null || password === "") {
      if (options.passwordfile) {
        password = await NodeUtils.readFirstLine(options.passwordfile);
      } else if (options.passwordenv && process.env[options.passwordenv]) {
        password = process.env[options.passwordenv];
      }
    }

    if ((password == null || password === "") && this.canInteract) {
      const answer = await inquirer.createPromptModule({ output: process.stderr })({
        type: "password",
        name: "password",
        message: "Send password:",
      });
      password = answer.password;
    }

    if (!password) {
      return Response.badRequest("Password required");
    }

    const passwordHashB64 = await this.getUnlockedPassword(password, keyArray);

    // Use retry helper for expired token handling
    const response = await this.getTokenWithRetry(sendId, {
      kind: "password",
      passwordHashB64: passwordHashB64 as SendHashedPasswordB64,
    });

    if (response instanceof SendAccessToken) {
      return await this.accessSendWithToken(response, keyArray, apiUrl, options);
    }

    if (response.kind === "expected_server") {
      const error = response.error;

      if (passwordHashB64Invalid(error)) {
        return Response.badRequest("Invalid password");
      }
    } else if (response.kind === "unexpected_server") {
      return Response.error("Server error: " + JSON.stringify(response.error));
    } else if (response.kind === "unknown") {
      return Response.error("Error: " + response.error);
    }

    return Response.error("Authentication failed");
  }

  private async accessSendWithToken(
    accessToken: SendAccessToken,
    keyArray: Uint8Array,
    apiUrl: string,
    options: OptionValues,
  ): Promise<Response> {
    try {
      const sendResponse = await this.sendApiService.postSendAccessV2(accessToken, apiUrl);

      const sendAccess = new SendAccess(sendResponse);
      this.decKey = await this.keyService.makeSendKey(keyArray);
      const decryptedView = await sendAccess.decrypt(this.decKey);

      if (options.obj != null) {
        return Response.success(new SendAccessResponse(decryptedView));
      }

      switch (decryptedView.type) {
        case SendType.Text:
          process.stdout.write(decryptedView?.text?.text);
          return Response.success();

        case SendType.File: {
          const downloadData = await this.sendApiService.getSendFileDownloadDataV2(
            decryptedView,
            accessToken,
            apiUrl,
          );

          const decryptBufferFn = async (resp: globalThis.Response) => {
            const encBuf = await EncArrayBuffer.fromResponse(resp);
            return this.encryptService.decryptFileData(encBuf, this.decKey);
          };

          return await this.saveAttachmentToFile(
            downloadData.url,
            decryptedView?.file?.fileName,
            decryptBufferFn,
            options.output,
          );
        }

        default:
          return Response.success(new SendAccessResponse(decryptedView));
      }
    } catch (e) {
      if (e instanceof ErrorResponse) {
        if (e.statusCode === 404) {
          return Response.notFound();
        }
      }
      return Response.error(e);
    }
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
