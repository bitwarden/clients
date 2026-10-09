// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as path from "path";

import { OptionValues } from "commander";
import * as inquirer from "inquirer";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  SendTokenService,
  SendAccessToken,
  emailRequired,
  emailAndOtpRequired,
  passwordHashB64Required,
  passwordHashB64Invalid,
  sendIdInvalid,
  SendHashedPasswordB64,
  SendOtp,
  GetSendAccessTokenError,
  SendAccessDomainCredentials,
  TryGetSendAccessTokenError,
  normalizeSendAccessTokenError,
  toSdkSendAccessCredentials,
} from "@bitwarden/common/auth/send-access";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { toSdkDevice } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { InsecureUrlNotAllowedError } from "@bitwarden/common/services/api-errors";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SEND_KDF_ITERATIONS } from "@bitwarden/common/tools/send/send-kdf";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendDecryptionService } from "@bitwarden/common/tools/send/services/send-decryption.service";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
// eslint-disable-next-line no-restricted-imports
import {
  CryptoFunctionService,
  EncArrayBuffer,
  EncryptService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import { NodeUtils } from "@bitwarden/node/node-utils";
import {
  SendReceiveClient,
  isAccessSendError,
  isGetFileDownloadDataError,
} from "@bitwarden/sdk-internal";

import { DownloadCommand } from "../../../commands/download.command";
import { Response } from "../../../models/response";
import { SendAccessResponse } from "../models/send-access.response";

/** The server that owns a Send, resolved from its url. */
type SendServer = {
  apiUrl: string;
  identityUrl: string;
  /** A known Bitwarden region or the configured server, so the user needs no trust prompt. */
  trusted: boolean;
  /**
   * This Send lives on the configured server, so SendTokenService — which only ever mints against
   * the configured environment — is the correct minting authority. False for every other server,
   * including other Bitwarden regions.
   */
  isConfiguredServer: boolean;
};

/**
 * The network and cryptographic steps of receiving a Send, bound to the server that hosts it.
 * Prompting, retries, and output handling are the same whichever implementation is in use.
 */
type SendReceiver = {
  /** Requests an access token for the Send, with `credentials` when the Send is protected. */
  requestToken(
    sendId: string,
    credentials?: SendAccessDomainCredentials,
  ): Promise<SendAccessToken | TryGetSendAccessTokenError>;
  /** Derives the credential a password-protected Send's token request carries. */
  hashPassword(password: string): Promise<SendHashedPasswordB64>;
  /** Accesses the Send and decrypts it. */
  access(accessToken: SendAccessToken): Promise<SendAccessView>;
  /** Resolves where a file Send's encrypted contents can be downloaded from. */
  getFileDownloadUrl(send: SendAccessView, accessToken: SendAccessToken): Promise<string>;
  /** Decrypts a file Send's downloaded contents. Only valid after {@link access} resolves. */
  decryptFile(response: globalThis.Response): Promise<Uint8Array>;
};

export class SendReceiveCommand extends DownloadCommand {
  private canInteract: boolean;

  constructor(
    encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private sendApiService: SendApiService,
    apiService: ApiService,
    private sendTokenService: SendTokenService,
    private sendDecryptionService: SendDecryptionService,
    private appIdService: AppIdService,
    private configService: ConfigService,
    private userAgent: string,
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

    const sendServer = await this.resolveSendServer(urlObject);
    if (!sendServer.trusted) {
      if (!this.canInteract) {
        return Response.badRequest(
          "Send access will not be attempted: the domain in the Send URL does not match the configured domain. Run interactively in order to override.",
        );
      }

      if (!(await this.promptForDomainOverride(urlObject.origin))) {
        return Response.badRequest("Send access cancelled.");
      }
    }
    const [id, key] = this.getIdAndKey(urlObject);

    if (Utils.isNullOrWhitespace(id) || Utils.isNullOrWhitespace(key)) {
      return Response.badRequest("Failed to parse url, the url provided is not a valid Send url");
    }

    const keyArray = Utils.fromUrlB64ToArray(key);

    let receiveClient: SendReceiveClient | null;
    try {
      receiveClient = await this.createSendReceiveClient(sendServer);
    } catch (e) {
      return Response.error(e);
    }
    // One client serves the whole receive — token, access, and download — and is released after.
    try {
      const receiver =
        receiveClient != null
          ? this.sdkReceiver(receiveClient, sendServer, keyArray)
          : this.legacyReceiver(sendServer, keyArray);

      return await this.attemptAccess(receiver, id, options);
    } finally {
      receiveClient?.[Symbol.dispose]();
    }
  }

  private getIdAndKey(url: URL): [string, string] {
    const result = url.hash.slice(1).split("/").slice(-2);
    return [result[0], result[1]];
  }

  /**
   * Resolves which server owns the Send in the given url. The access token is minted by and spent
   * at the same server: a token from the configured server must never be sent to another host.
   */
  private async resolveSendServer(url: URL): Promise<SendServer> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const urls = env.getUrls();

    // Match the web vault origin as well as the send domain: send.bitwarden.com is a vanity host
    // that lands on https://vault.bitwarden.com/#/send/..., so the web vault origin is what a
    // recipient actually copies. Origins are compared exactly — a suffix match would let
    // send.bitwarden.com.example.test pass as Bitwarden cloud.
    const matchingRegion = this.environmentService
      .availableRegions()
      .find(
        (r) =>
          (r.urls.send != null && r.urls.send === url.origin) ||
          (r.urls.webVault != null && r.urls.webVault === url.origin),
      );
    if (matchingRegion != null) {
      // availableRegions() lists every region, not just the configured one, so a Send from another
      // region is trusted but must still be minted at its own identity server.
      return {
        apiUrl: matchingRegion.urls.api,
        identityUrl: matchingRegion.urls.identity,
        trusted: true,
        isConfiguredServer: matchingRegion.key === env.getRegion(),
      };
    }

    if (url.origin === urls.api) {
      return {
        apiUrl: url.origin,
        identityUrl: env.getIdentityUrl(),
        trusted: true,
        isConfiguredServer: true,
      };
    } else if (this.platformUtilsService.isDev() && url.origin === urls.webVault) {
      return {
        apiUrl: urls.api,
        identityUrl: env.getIdentityUrl(),
        trusted: true,
        isConfiguredServer: true,
      };
    } else if (url.origin === env.getWebVaultUrl()) {
      // Self-hosted servers without a dedicated Send domain link Sends from the web vault itself.
      return {
        apiUrl: env.getApiUrl(),
        identityUrl: env.getIdentityUrl(),
        trusted: true,
        isConfiguredServer: true,
      };
    } else {
      return {
        apiUrl: url.origin + "/api",
        identityUrl: url.origin + "/identity",
        trusted: false,
        isConfiguredServer: false,
      };
    }
  }

  private async promptForDomainOverride(sendOrigin: string): Promise<boolean> {
    const env = await firstValueFrom(this.environmentService.environment$);

    const answer = await inquirer.createPromptModule({ output: process.stderr })({
      type: "confirm",
      name: "proceed",
      message:
        `You are attempting to access a Send hosted on ${sendOrigin} but your CLI is configured for ` +
        `${env.getWebVaultUrl()}. Do not proceed if you do not trust ${sendOrigin}. Do you want to proceed?`,
      default: false,
    });

    return answer.proceed;
  }

  private async getUnlockedPassword(password: string, keyArray: Uint8Array) {
    const passwordHash = await this.cryptoFunctionService.pbkdf2(
      password,
      keyArray,
      "sha256",
      SEND_KDF_ITERATIONS,
    );
    return Utils.fromBufferToB64(passwordHash);
  }

  private async attemptAccess(
    receiver: SendReceiver,
    id: string,
    options: OptionValues,
  ): Promise<Response> {
    let authType: AuthType = AuthType.None;

    const currentResponse = await this.getTokenWithRetry(receiver, id);

    if (currentResponse instanceof SendAccessToken) {
      return await this.accessSendWithToken(currentResponse, receiver, options);
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
      return await this.handleEmailOtpAuth(id, receiver, options);
    } else if (authType === AuthType.Password) {
      return await this.handlePasswordAuth(id, receiver, options);
    }

    // The auth layer will immediately return a token for Sends with AuthType.None
    // If this code is reached, something has gone wrong
    if (authType === AuthType.None) {
      return Response.error("Could not determine authentication requirements");
    }

    return Response.error("Authentication failed");
  }

  private async getTokenWithRetry(
    receiver: SendReceiver,
    sendId: string,
    credentials?: SendAccessDomainCredentials,
  ): Promise<SendAccessToken | GetSendAccessTokenError> {
    let expiredAttempts = 0;

    while (expiredAttempts < 3) {
      const response = await receiver.requestToken(sendId, credentials);

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

  /**
   * Legacy token minting. SendTokenService always mints against the configured environment. For a
   * Send hosted elsewhere that would authenticate at one server and spend the token at another, so
   * those mints are done here against the Send's own server instead. This applies to other
   * Bitwarden regions too, not only untrusted hosts.
   */
  private async requestToken(
    sendServer: SendServer,
    sendId: string,
    credentials?: SendAccessDomainCredentials,
  ): Promise<SendAccessToken | TryGetSendAccessTokenError> {
    if (!sendServer.isConfiguredServer) {
      return await this.mintSendAccessToken(sendServer.identityUrl, sendId, credentials);
    }

    return credentials
      ? await firstValueFrom(this.sendTokenService.getSendAccessToken$(sendId, credentials))
      : await firstValueFrom(this.sendTokenService.tryGetSendAccessToken$(sendId));
  }

  /**
   * Requests a Send access token directly from the given identity server using the `send_access`
   * grant. Tokens obtained here are deliberately not cached: the server is not one the user has
   * configured, so a token from it must never be reachable by a later request to another server.
   */
  private async mintSendAccessToken(
    identityUrl: string,
    sendId: string,
    credentials?: SendAccessDomainCredentials,
  ): Promise<SendAccessToken | GetSendAccessTokenError> {
    // nativeFetch is the raw transport and skips the https-only check in ApiService.fetch. The form
    // body below carries the Send credentials, so enforce it here rather than sending them in clear.
    const insecure = this.insecureTokenUrlError(identityUrl);
    if (insecure != null) {
      return insecure;
    }

    // Defined in SendAccessConstants.TokenRequest in the server repo.
    const fields: Record<string, string> = {
      grant_type: "send_access",
      client_id: "send",
      scope: "api.send.access",
      send_id: sendId,
    };

    switch (credentials?.kind) {
      case "password":
        fields.password_hash_b64 = credentials.passwordHashB64;
        break;
      case "email":
        fields.email = credentials.email;
        break;
      case "email_otp":
        fields.email = credentials.email;
        fields.otp = credentials.otp;
        break;
    }

    let status: number;
    let body: any = null;
    try {
      const response = await this.apiService.nativeFetch(
        new Request(identityUrl + "/connect/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
            Accept: "application/json",
            "Device-Identifier": await this.appIdService.getAppId(),
          },
          body: Object.entries(fields)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&"),
        }),
      );

      status = response.status;
      if (response.headers.get("content-type")?.includes("json")) {
        body = await response.json();
      }
    } catch (e) {
      return { kind: "unknown", error: e instanceof Error ? e.message : String(e) };
    }

    if (status === 200 && body?.access_token != null) {
      // A missing or non-numeric expires_in would make expiresAt NaN, which isExpired() reads as
      // "not expired" forever.
      if (!Number.isFinite(body.expires_in)) {
        return { kind: "unknown", error: "Send access token response had no valid expires_in" };
      }
      return new SendAccessToken(body.access_token, Date.now() + body.expires_in * 1000);
    }

    if (status === 400 && body?.error != null) {
      // Same shape the SDK path produces, so the callers' error predicates still apply.
      return {
        kind: "expected_server",
        error: {
          error: body.error,
          error_description: body.error_description,
          send_access_error_type: body.send_access_error_type,
        },
      } as GetSendAccessTokenError;
    }

    return {
      kind: "unknown",
      error: `Unexpected response requesting a Send access token (${status})`,
    };
  }

  /**
   * The token request carries the Send's credentials, so it must not go out in clear. Neither raw
   * transport used to mint cross-instance tokens (nativeFetch, the SDK's HTTP client) enforces
   * https the way ApiService.fetch does.
   */
  private insecureTokenUrlError(identityUrl: string): GetSendAccessTokenError | null {
    if (this.isInsecureUrl(identityUrl)) {
      return {
        kind: "unknown",
        error: `Send access requires https, but the url was ${identityUrl}`,
      };
    }
    return null;
  }

  private isInsecureUrl(url: string): boolean {
    return !url.startsWith("https://") && !this.platformUtilsService.isDev();
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
    receiver: SendReceiver,
    options: OptionValues,
  ): Promise<Response> {
    const email = await this.promptForEmail();

    const emailResponse = await this.getTokenWithRetry(receiver, sendId, {
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
        const otpResponse = await this.getTokenWithRetry(receiver, sendId, {
          kind: "email_otp",
          email: email,
          otp: promptResponse,
        });

        if (otpResponse instanceof SendAccessToken) {
          return await this.accessSendWithToken(otpResponse, receiver, options);
        }

        if (otpResponse.kind === "expected_server") {
          const error = otpResponse.error;
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
    receiver: SendReceiver,
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

    let passwordHashB64: SendHashedPasswordB64;
    try {
      passwordHashB64 = await receiver.hashPassword(password);
    } catch (e) {
      return Response.error(e);
    }

    // Use retry helper for expired token handling
    const response = await this.getTokenWithRetry(receiver, sendId, {
      kind: "password",
      passwordHashB64,
    });

    if (response instanceof SendAccessToken) {
      return await this.accessSendWithToken(response, receiver, options);
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
    receiver: SendReceiver,
    options: OptionValues,
  ): Promise<Response> {
    try {
      const decryptedView = await receiver.access(accessToken);

      if (options.obj != null) {
        return Response.success(new SendAccessResponse(decryptedView));
      }

      switch (decryptedView.type) {
        case SendType.Text:
          process.stdout.write(decryptedView?.text?.text);
          return Response.success();

        case SendType.File: {
          const downloadUrl = await receiver.getFileDownloadUrl(decryptedView, accessToken);

          return await this.saveAttachmentToFile(
            downloadUrl,
            path.basename(decryptedView?.file?.fileName ?? `BitwardenSendFile-${Date.now()}`),
            (resp) => receiver.decryptFile(resp),
            options.output,
          );
        }

        default:
          return Response.success(new SendAccessResponse(decryptedView));
      }
    } catch (e) {
      if (this.isNotFound(e)) {
        return Response.notFound();
      }
      return Response.error(e);
    }
  }

  /**
   * Builds a receive-scoped SDK client pointed at the server that hosts a cross-instance Send, so
   * the access token is minted and spent at that server and nothing about the receive — the
   * password hash included — reaches the signed-in instance.
   *
   * Returns null — keeping SendTokenService and {@link SendApiService} — for a Send on the
   * configured server, which needs no client of its own, and while the SDK Sends flag is off.
   */
  private async createSendReceiveClient(sendServer: SendServer): Promise<SendReceiveClient | null> {
    if (sendServer.isConfiguredServer) {
      return null;
    }
    if (!(await this.configService.getFeatureFlag(FeatureFlag.Pm30110SdkSendsApi))) {
      return null;
    }

    await SdkLoadService.Ready;
    return new SendReceiveClient({
      apiUrl: sendServer.apiUrl,
      identityUrl: sendServer.identityUrl,
      userAgent: this.userAgent,
      deviceType: toSdkDevice(this.platformUtilsService.getDevice()),
      // Sent as the Device-Identifier header on every request, the token request included.
      deviceIdentifier: await this.appIdService.getAppId(),
      bitwardenClientVersion: await this.platformUtilsService.getApplicationVersionNumber(),
    });
  }

  /**
   * Receives through SendTokenService (configured server) or a direct token request (any other
   * server), then {@link SendApiService}, spending the token at the Send's own API.
   */
  private legacyReceiver(sendServer: SendServer, keyArray: Uint8Array): SendReceiver {
    const apiUrl = sendServer.apiUrl;
    let decKey: SymmetricCryptoKey;
    return {
      requestToken: (sendId, credentials) => this.requestToken(sendServer, sendId, credentials),
      hashPassword: async (password) =>
        (await this.getUnlockedPassword(password, keyArray)) as SendHashedPasswordB64,
      access: async (accessToken) => {
        const sendResponse = await this.sendApiService.postSendAccess(accessToken, apiUrl);
        const [view, key] = await this.sendDecryptionService.decryptSendAccess(
          sendResponse,
          keyArray,
        );
        decKey = key;
        return view;
      },
      getFileDownloadUrl: async (send, accessToken) =>
        (await this.sendApiService.getSendFileDownloadData(send, accessToken, apiUrl)).url,
      decryptFile: async (resp) => {
        const encBuf = await EncArrayBuffer.fromResponse(resp);
        return this.encryptService.decryptFileData(encBuf, decKey);
      },
    };
  }

  /**
   * Receives through a {@link SendReceiveClient}. Every request — token included — goes to the
   * server the client was built for, and hashing and decryption happen in the SDK using the key
   * from the Send url. Tokens are not cached, as with the legacy cross-instance mint.
   */
  private sdkReceiver(
    client: SendReceiveClient,
    sendServer: SendServer,
    keyArray: Uint8Array,
  ): SendReceiver {
    const keyB64 = Utils.fromArrayToUrlB64(keyArray);
    return {
      requestToken: async (sendId, credentials) => {
        const insecure = this.insecureTokenUrlError(sendServer.identityUrl);
        if (insecure != null) {
          return insecure;
        }
        try {
          const response = await client.request_send_access_token({
            sendId,
            sendAccessCredentials: toSdkSendAccessCredentials(credentials),
          });
          return SendAccessToken.fromSendAccessTokenResponse(response);
        } catch (e) {
          return normalizeSendAccessTokenError(e);
        }
      },
      hashPassword: async (password) =>
        client.hash_send_password(keyB64, password) as SendHashedPasswordB64,
      access: async (accessToken) => {
        // ApiService.fetch refuses non-https urls; the SDK's HTTP client does not.
        if (this.isInsecureUrl(sendServer.apiUrl)) {
          throw new InsecureUrlNotAllowedError(sendServer.apiUrl);
        }
        const response = await client.access_send(accessToken.token);
        return SendAccessView.fromSdk(client.decrypt_send_access(keyB64, response));
      },
      getFileDownloadUrl: async (send, accessToken) =>
        (await client.get_file_download_data(accessToken.token, send.file.id)).url,
      decryptFile: async (resp) =>
        client.decrypt_send_access_file(keyB64, new Uint8Array(await resp.arrayBuffer())),
    };
  }

  /**
   * SendApiService surfaces a missing Send as an {@link ErrorResponse}; the SDK surfaces it as the
   * NotFound variant of its access and file download data errors.
   */
  private isNotFound(e: unknown): boolean {
    if (e instanceof ErrorResponse) {
      return e.statusCode === 404;
    }
    return (isAccessSendError(e) || isGetFileDownloadDataError(e)) && e.variant === "NotFound";
  }
}
