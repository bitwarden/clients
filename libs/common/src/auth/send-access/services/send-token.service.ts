import { defer, firstValueFrom, from, Observable } from "rxjs";
import { Jsonify } from "type-fest";

import {
  SendHashedPassword,
  SendPasswordService,
} from "../../../key-management/sends/send-password.service";
import {
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  SEND_ACCESS_DISK,
} from "../../../platform/state";
import { SendAccessTokenRequest } from "../../models/request/identity-token/send-access-token.request";
import { SendTokenApiService } from "../abstractions/send-token-api.service";
import {
  SendAccessCredentials,
  SendTokenService as SendTokenServiceAbstraction,
} from "../abstractions/send-token.service";
import { SendAccessToken } from "../models/send-access-token";

import { SendTokenApiError } from "./send-token-api.service";

// TODO: add JSDocs
// TODO: add tests for this service.
export const SEND_ACCESS_TOKEN_DICT = KeyDefinition.record<SendAccessToken, string>(
  SEND_ACCESS_DISK,
  "accessTokenDict",
  {
    deserializer: (sendAccessTokenJson: Jsonify<SendAccessToken>) => {
      return SendAccessToken.fromJson(sendAccessTokenJson);
    },
  },
);

type CredentialsRequiredApiError = Extract<
  SendTokenApiError,
  "password-required" | "email-and-otp-required" | "unknown-error"
>;

function isCredentialsRequiredApiError(
  error: SendTokenApiError,
): error is CredentialsRequiredApiError {
  return (
    error === "password-hash-required" ||
    error === "email-and-otp-required" ||
    error === "unknown-error"
  );
}

export type TryGetSendAccessTokenError = "expired" | CredentialsRequiredApiError;

export type GetSendAcccessTokenError = Extract<
  SendTokenApiError,
  "invalid-password" | "invalid-otp" | "unknown-error"
>;

function isGetSendAccessTokenError(error: SendTokenApiError): error is GetSendAcccessTokenError {
  return error === "invalid-password-hash" || error === "invalid-otp" || error === "unknown-error";
}

export class SendTokenService implements SendTokenServiceAbstraction {
  private sendAccessTokenDictGlobalState: GlobalState<Record<string, SendAccessToken>> | undefined;

  constructor(
    private globalStateProvider: GlobalStateProvider,
    private sendTokenApiService: SendTokenApiService,
    private sendPasswordService: SendPasswordService,
  ) {
    this.initializeState();
  }

  private initializeState(): void {
    this.sendAccessTokenDictGlobalState = this.globalStateProvider.get(SEND_ACCESS_TOKEN_DICT);
  }

  tryGetSendAccessToken$(sendId: string): Observable<SendAccessToken | TryGetSendAccessTokenError> {
    // Defer the execution to ensure that a cold observable is returned.
    return defer(() => from(this._tryGetSendAccessToken(sendId)));
  }

  private async _tryGetSendAccessToken(
    sendId: string,
  ): Promise<SendAccessToken | TryGetSendAccessTokenError> {
    // Validate the sendId is a non-empty string.
    this.validateSendId(sendId);

    // Check in storage for the access token for the given sendId.
    const sendAccessTokenFromStorage = await this.getSendAccessTokenFromStorage(sendId);

    if (sendAccessTokenFromStorage != null) {
      // If it is expired, we return expired token error.
      if (sendAccessTokenFromStorage.isExpired()) {
        return "expired";
      } else {
        // If it is not expired, we return it
        return sendAccessTokenFromStorage;
      }
    }

    // If we don't have a token in storage, we can try to request a new token from the server.
    const request = new SendAccessTokenRequest(sendId);

    const result = await this.sendTokenApiService.requestSendAccessToken(request);

    if (result instanceof SendAccessToken) {
      // If we get a token back, we need to store it in the global state.
      await this.setSendAccessTokenInStorage(sendId, result);
      return result;
    }

    if (isCredentialsRequiredApiError(result)) {
      // If we get an expected API error, we return it.
      // Typically, this will be a "password-required" or "email-and-otp-required" error to communicate that the send requires credentials to access.
      return result;
    }

    // If we get an unexpected error, we throw.
    throw new Error(`Unexpected and unhandled API error retrieving send access token: ${result}`);
  }

  getSendAccessToken$(
    sendId: string,
    sendCredentials: SendAccessCredentials,
  ): Observable<SendAccessToken | GetSendAcccessTokenError> {
    // Defer the execution to ensure that a cold observable is returned.
    return defer(() => from(this._getSendAccessToken(sendId, sendCredentials)));
  }

  private async _getSendAccessToken(
    sendId: string,
    sendCredentials: SendAccessCredentials,
  ): Promise<SendAccessToken | GetSendAcccessTokenError> {
    // Validate the sendId
    this.validateSendId(sendId);

    // Validate the credentials
    if (sendCredentials == null) {
      throw new Error("sendCredentials must be provided.");
    }

    // Request the access token from the server using the provided credentials.
    const request = new SendAccessTokenRequest(sendId, sendCredentials);
    const result = await this.sendTokenApiService.requestSendAccessToken(request);

    if (result instanceof SendAccessToken) {
      // If we get a token back, we need to store it in the global state.
      await this.setSendAccessTokenInStorage(sendId, result);
      return result;
    }

    if (isGetSendAccessTokenError(result)) {
      // If we get an expected API error, we return it.
      // Typically, this will be due to an invalid credentials error
      return result;
    }

    // If we get an unexpected error, we throw.
    throw new Error(`Unexpected and unhandled API error retrieving send access token: ${result}`);
  }

  async hashPassword(password: string, keyMaterialUrlB64: string): Promise<SendHashedPassword> {
    return this.sendPasswordService.hashPassword(password, keyMaterialUrlB64);
  }

  private async getSendAccessTokenFromStorage(
    sendId: string,
  ): Promise<SendAccessToken | undefined> {
    if (this.sendAccessTokenDictGlobalState != null) {
      const sendAccessTokenDict = await firstValueFrom(this.sendAccessTokenDictGlobalState.state$);
      return sendAccessTokenDict?.[sendId];
    }
    return undefined;
  }

  private async setSendAccessTokenInStorage(
    sendId: string,
    sendAccessToken: SendAccessToken,
  ): Promise<void> {
    if (this.sendAccessTokenDictGlobalState != null) {
      await this.sendAccessTokenDictGlobalState.update((sendAccessTokenDict) => {
        sendAccessTokenDict ??= {}; // Initialize if undefined

        sendAccessTokenDict[sendId] = sendAccessToken;
        return sendAccessTokenDict;
      });
    }
  }

  private validateSendId(sendId: string): void {
    if (sendId == null || sendId.trim() === "") {
      throw new Error("sendId must be provided.");
    }
  }
}
