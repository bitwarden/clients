import { Observable, defer, firstValueFrom, from } from "rxjs";
import { Jsonify } from "type-fest";

import { SendAccessTokenRequest } from "@bitwarden/sdk-internal";
import {
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  SEND_ACCESS_DISK,
} from "@bitwarden/state";

import { SendPasswordService } from "../../../key-management/sends/abstractions/send-password.service";
import {
  SendHashedPassword,
  SendPasswordKeyMaterial,
} from "../../../key-management/sends/types/send-hashed-password.type";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../platform/misc/utils";
import { SendTokenService as SendTokenServiceAbstraction } from "../abstractions/send-token.service";
import { SendAccessToken } from "../models/send-access-token";
import { SendHashedPasswordB64 } from "../types/send-hashed-password-b64.type";

// import { SendTokenApiError } from "./send-token-api.service";

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

export class DefaultSendTokenService implements SendTokenServiceAbstraction {
  private sendAccessTokenDictGlobalState: GlobalState<Record<string, SendAccessToken>> | undefined;

  constructor(
    private globalStateProvider: GlobalStateProvider,
    private sdkService: SdkService,
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
    const request: SendAccessTokenRequest = {
      sendId: sendId,
      sendAccessCredentials: undefined,
    };

    const anonSdkClient = await firstValueFrom(this.sdkService.client$);

    if (anonSdkClient === undefined) {
      throw new Error("SDK client is undefined");
    }
    const result = await anonSdkClient.auth().send_access().request_send_access_token(request);

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

  // getSendAccessToken$(
  //   sendId: string,
  //   sendCredentials: SendAccessCredentials,
  // ): Observable<SendAccessToken | GetSendAcccessTokenError> {
  //   // Defer the execution to ensure that a cold observable is returned.
  //   return defer(() => from(this._getSendAccessToken(sendId, sendCredentials)));
  // }

  // private async _getSendAccessToken(
  //   sendId: string,
  //   sendCredentials: SendAccessCredentials,
  // ): Promise<SendAccessToken | GetSendAcccessTokenError> {
  //   // Validate the sendId
  //   this.validateSendId(sendId);

  //   // Validate the credentials
  //   if (sendCredentials == null) {
  //     throw new Error("sendCredentials must be provided.");
  //   }

  //   // Request the access token from the server using the provided credentials.
  //   const request = new SendAccessTokenRequest(sendId, sendCredentials);
  //   const result = await this.sendTokenApiService.requestSendAccessToken(request);

  //   if (result instanceof SendAccessToken) {
  //     // If we get a token back, we need to store it in the global state.
  //     await this.setSendAccessTokenInStorage(sendId, result);
  //     return result;
  //   }

  //   if (isGetSendAccessTokenError(result)) {
  //     // If we get an expected API error, we return it.
  //     // Typically, this will be due to an invalid credentials error
  //     return result;
  //   }

  //   // If we get an unexpected error, we throw.
  //   throw new Error(`Unexpected and unhandled API error retrieving send access token: ${result}`);
  // }

  async hashSendPassword(
    password: string,
    keyMaterialUrlB64: string,
  ): Promise<SendHashedPasswordB64> {
    // Validate the password and key material
    if (password == null || password.trim() === "") {
      throw new Error("Password must be provided.");
    }
    if (keyMaterialUrlB64 == null || keyMaterialUrlB64.trim() === "") {
      throw new Error("KeyMaterialUrlB64 must be provided.");
    }

    // Convert the base64 URL encoded key material to a Uint8Array
    const keyMaterialUrlB64Array = Utils.fromUrlB64ToArray(
      keyMaterialUrlB64,
    ) as SendPasswordKeyMaterial;

    const sendHashedPasswordArray: SendHashedPassword = await this.sendPasswordService.hashPassword(
      password,
      keyMaterialUrlB64Array,
    );

    // Convert the Uint8Array to a base64 URL encoded string which is required
    // for the server to be able to compare the password hash.
    const sendHashedPasswordB64 = Utils.fromBufferToB64(
      sendHashedPasswordArray,
    ) as SendHashedPasswordB64;

    return sendHashedPasswordB64;
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
