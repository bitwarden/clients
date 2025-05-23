import { firstValueFrom } from "rxjs";
import { Jsonify } from "type-fest";

import {
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  SEND_ACCESS_DISK,
} from "../../../platform/state";
import { SendAccessTokenRequest } from "../../models/request/identity-token/send-access-token.request";
import {
  SendAccessCredentials,
  SendTokenService as SendTokenServiceAbstraction,
} from "../abstractions/send-token.service";
import { SendAccessToken } from "../models/send-access-token";

import { SendTokenApiRetrievalError, SendTokenApiService } from "./send-token-api.service";

export const SEND_ACCESS_TOKEN_DICT = KeyDefinition.record<SendAccessToken, string>(
  SEND_ACCESS_DISK,
  "accessTokenDict",
  {
    deserializer: (sendAccessTokenJson: Jsonify<SendAccessToken>) => {
      return SendAccessToken.fromJson(sendAccessTokenJson);
    },
  },
);

export type SendTokenRetrievalError = "expired" | SendTokenApiRetrievalError;

export class SendTokenService implements SendTokenServiceAbstraction {
  private sendAccessTokenDictGlobalState: GlobalState<Record<string, SendAccessToken>> | undefined;

  constructor(
    private globalStateProvider: GlobalStateProvider,
    private sendTokenApiService: SendTokenApiService,
  ) {
    this.initializeState();
  }

  private initializeState(): void {
    this.sendAccessTokenDictGlobalState = this.globalStateProvider.get(SEND_ACCESS_TOKEN_DICT);
  }

  async tryGetSendAccessToken(sendId: string): Promise<SendAccessToken | SendTokenRetrievalError> {
    // TODO: check in storage for the access token and if it is expired.

    const sendAccessTokenFromStorage = await this.getSendAccessTokenFromStorage(sendId);

    if (sendAccessTokenFromStorage != null) {
      // If it is expired, we return expired token error.
      if (sendAccessTokenFromStorage.isExpired()) {
        return "expired";
      } else {
        // If it is not expired, we return
        return sendAccessTokenFromStorage;
      }
    }

    // If we don't have a token in storage, we can try to request a new token from the server.
    const request = new SendAccessTokenRequest(sendId);

    // try {
    const result = await this.sendTokenApiService.requestSendAccessToken(request);

    if (result instanceof SendAccessToken) {
      // If we get a token back, we need to store it in the global state.
      await this.setSendAccessTokenInStorage(sendId, result);
      return result;
    }

    return result;
  }

  async getSendAccessTokenWithCredentials(
    sendId: string,
    sendCredentials: SendAccessCredentials | undefined,
  ): Promise<void> {
    // TODO: check in storage for the access token and if it is expired.
    // If it is expired, we will need to request a new token from the server.
    // If it is not expired, we will return the token from storage.
    // const request = new SendAccessTokenRequest(sendId, sendCredentials);
    // const result = await this.sendTokenApiService.requestSendAccessToken(request);
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
}
