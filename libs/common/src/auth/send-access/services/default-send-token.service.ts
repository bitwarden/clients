import { Observable, defer, firstValueFrom, from } from "rxjs";

import {
  BitwardenClient,
  SendAccessCredentials,
  SendAccessTokenError,
  SendAccessTokenRequest,
  SendAccessTokenResponse,
} from "@bitwarden/sdk-internal";
import { GlobalState, GlobalStateProvider } from "@bitwarden/state";

import { SendPasswordService } from "../../../key-management/sends/abstractions/send-password.service";
import {
  SendHashedPassword,
  SendPasswordKeyMaterial,
} from "../../../key-management/sends/types/send-hashed-password.type";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../platform/misc/utils";
import { SendTokenService as SendTokenServiceAbstraction } from "../abstractions/send-token.service";
import { SendAccessToken } from "../models/send-access-token";
import { GetSendAccessTokenError } from "../types/get-send-access-token-error.type";
import { SendAccessDomainCredentials } from "../types/send-access-domain-credentials.type";
import { SendHashedPasswordB64 } from "../types/send-hashed-password-b64.type";
import { TryGetSendAccessTokenError } from "../types/try-get-send-access-token-error.type";

import { SEND_ACCESS_TOKEN_DICT } from "./send-access-token-dict.state";

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
      // If it is expired, we clear the token from storage and return the expired error
      if (sendAccessTokenFromStorage.isExpired()) {
        await this.clearSendAccessTokenFromStorage(sendId);
        return { kind: "expired" };
      } else {
        // If it is not expired, we return it
        return sendAccessTokenFromStorage;
      }
    }

    // If we don't have a token in storage, we can try to request a new token from the server.
    const request: SendAccessTokenRequest = {
      sendId: sendId,
    };

    const anonSdkClient: BitwardenClient = await firstValueFrom(this.sdkService.client$);

    try {
      const result: SendAccessTokenResponse = await anonSdkClient
        .auth()
        .send_access()
        .request_send_access_token(request);

      // Convert from SDK shape to SendAccessToken so it can be serialized into & out of state provider
      const sendAccessToken = SendAccessToken.fromSendAccessTokenResponse(result);

      // If we get a token back, we need to store it in the global state.
      await this.setSendAccessTokenInStorage(sendId, sendAccessToken);

      return sendAccessToken;
    } catch (error: unknown) {
      return this.normalizeSendAccessTokenError(error);
    }
  }

  getSendAccessToken$(
    sendId: string,
    sendCredentials: SendAccessDomainCredentials,
  ): Observable<SendAccessToken | GetSendAccessTokenError> {
    // Defer the execution to ensure that a cold observable is returned.
    return defer(() => from(this._getSendAccessToken(sendId, sendCredentials)));
  }

  private async _getSendAccessToken(
    sendId: string,
    sendAccessCredentials: SendAccessDomainCredentials,
  ): Promise<SendAccessToken | GetSendAccessTokenError> {
    // Validate inputs to account for non-strict TS call sites.
    this.validateCredentialsRequest(sendId, sendAccessCredentials);

    // Convert inputs to SDK request shape
    const request: SendAccessTokenRequest = {
      sendId: sendId,
      sendAccessCredentials: this.convertDomainCredentialsToSdkCredentials(sendAccessCredentials),
    };

    const anonSdkClient: BitwardenClient = await firstValueFrom(this.sdkService.client$);

    try {
      const result: SendAccessTokenResponse = await anonSdkClient
        .auth()
        .send_access()
        .request_send_access_token(request);

      // Convert from SDK interface to SendAccessToken class so it can be serialized into & out of state provider
      const sendAccessToken = SendAccessToken.fromSendAccessTokenResponse(result);

      // Any time we get a token from the server, we need to store it in the global state.
      await this.setSendAccessTokenInStorage(sendId, sendAccessToken);

      return sendAccessToken;
    } catch (error: unknown) {
      return this.normalizeSendAccessTokenError(error);
    }
  }

  async invalidateSendAccessToken(sendId: string): Promise<void> {
    await this.clearSendAccessTokenFromStorage(sendId);
  }

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

    // Convert the Uint8Array to a base64 encoded string which is required
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
      await this.sendAccessTokenDictGlobalState.update(
        (sendAccessTokenDict) => {
          sendAccessTokenDict ??= {}; // Initialize if undefined

          sendAccessTokenDict[sendId] = sendAccessToken;
          return sendAccessTokenDict;
        },
        {
          // only update if the value is different (to avoid unnecessary writes)
          shouldUpdate: (dict) => dict?.[sendId] !== sendAccessToken,
        },
      );
    }
  }

  private async clearSendAccessTokenFromStorage(sendId: string): Promise<void> {
    if (this.sendAccessTokenDictGlobalState != null) {
      await this.sendAccessTokenDictGlobalState.update(
        (sendAccessTokenDict) => {
          if (sendAccessTokenDict) {
            // only delete if dict exists
            delete sendAccessTokenDict[sendId];
          }
          return sendAccessTokenDict;
        },
        // only update if the sendId exists in the dict
        { shouldUpdate: (dict) => dict?.[sendId] != null },
      );
    }
  }

  /**
   * Normalizes an error from the SDK send access token request process.
   * @param e The error to normalize.
   * @returns A normalized GetSendAccessTokenError.
   */
  private normalizeSendAccessTokenError(e: unknown): GetSendAccessTokenError {
    if (this.isSendAccessTokenError(e)) {
      if (e.kind === "unexpected") {
        return { kind: "unexpected_server", error: e.data };
      }
      return { kind: "expected_server", error: e.data };
    }

    if (e instanceof Error) {
      return { kind: "unknown", error: e.message };
    }

    try {
      return { kind: "unknown", error: JSON.stringify(e) };
    } catch {
      return { kind: "unknown", error: "error cannot be stringified" };
    }
  }

  private isSendAccessTokenError(e: unknown): e is SendAccessTokenError {
    return (
      typeof e === "object" &&
      e !== null &&
      "kind" in e &&
      (e.kind === "expected" || e.kind === "unexpected")
    );
  }

  private validateSendId(sendId: string): void {
    if (sendId == null || sendId.trim() === "") {
      throw new Error("sendId must be provided.");
    }
  }

  private validateCredentialsRequest(
    sendId: string,
    sendAccessCredentials: SendAccessDomainCredentials,
  ): void {
    this.validateSendId(sendId);
    if (sendAccessCredentials == null) {
      throw new Error("sendAccessCredentials must be provided.");
    }

    if (sendAccessCredentials.kind === "password" && !sendAccessCredentials.passwordHashB64) {
      throw new Error("passwordHashB64 must be provided for password credentials.");
    }

    if (sendAccessCredentials.kind === "email" && !sendAccessCredentials.email) {
      throw new Error("email must be provided for email credentials.");
    }

    if (
      sendAccessCredentials.kind === "email_otp" &&
      (!sendAccessCredentials.email || !sendAccessCredentials.otp)
    ) {
      throw new Error("email and otp must be provided for email_otp credentials.");
    }
  }

  private convertDomainCredentialsToSdkCredentials(
    sendAccessCredentials: SendAccessDomainCredentials,
  ): SendAccessCredentials {
    switch (sendAccessCredentials.kind) {
      case "password":
        return {
          passwordHashB64: sendAccessCredentials.passwordHashB64,
        };
      case "email":
        return {
          email: sendAccessCredentials.email,
        };
      case "email_otp":
        return {
          email: sendAccessCredentials.email,
          otp: sendAccessCredentials.otp,
        };
    }
  }
}
