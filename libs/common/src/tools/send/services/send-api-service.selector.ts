import { Observable, firstValueFrom, map, shareReplay } from "rxjs";

import { SendAccessToken } from "../../../auth/send-access";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ListResponse } from "../../../models/response/list.response";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { Send } from "../models/domain/send";
import { SendAccessRequest } from "../models/request/send-access.request";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";
import { AuthType } from "../types/auth-type";
import { SendType } from "../types/send-type";

import { SendApiService } from "./send-api.service";
import { SendApiService as SendApiServiceAbstraction } from "./send-api.service.abstraction";
import { SendSdkApiService } from "./send-sdk-api.service";

/**
 * Selects between SendApiService and SendSdkApiService based on the pm-30110-sdk-sends-api
 * feature flag.
 *
 * Methods whose return type is a wire-encrypted shape that the SDK cannot faithfully produce
 * (`getSend`, `getSends`, `putSendRemovePassword`) route to the legacy service unconditionally.
 * Mutation methods (`save`, `removePassword`, `delete`, `deleteSend`) and access-side methods
 * are flag-controlled — the SDK service refetches the encrypted form via the legacy API after
 * mutations to keep InternalSendService coherent. New file sends and cross-instance access
 * calls still go to legacy because the SDK can't honor a per-call API URL and would generate
 * a fresh send key that doesn't match the caller's pre-encrypted file buffer.
 */
export class SendApiServiceSelector implements SendApiServiceAbstraction {
  private readonly service$: Observable<SendApiServiceAbstraction>;

  constructor(
    configService: ConfigService,
    private sendApiService: SendApiService,
    private sendSdkApiService: SendSdkApiService,
  ) {
    this.service$ = configService.getFeatureFlag$(FeatureFlag.Pm30110SdkSendsApi).pipe(
      map((useSdk) => (useSdk ? this.sendSdkApiService : this.sendApiService)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  private getService(): Promise<SendApiServiceAbstraction> {
    return firstValueFrom(this.service$);
  }

  /**
   * Routes save calls to the SDK or legacy service. Forces legacy for two cases the SDK
   * can't currently handle:
   *
   * - **New file sends.** `SendService.encrypt` produces a pre-encrypted `EncArrayBuffer`
   *   under a client-derived key, but the SDK's `create_file_send` generates its own key
   *   and would leave those bytes undecryptable.
   * - **Password-protected sends.** `SendService.encrypt` already PBKDF2-derives
   *   `Send.password` to its wire `keyB64` form, but the SDK's `SendAuthType::auth_data`
   *   (`bitwarden-send/src/send.rs:160-163`) unconditionally re-applies PBKDF2 to the
   *   `auth.password` string, double-hashing the value and leaving the server with a
   *   password the user can't supply. The SDK has no `PreservedPassword`/skip-hash
   *   variant on `SendAddRequest`/`SendEditRequest`, so this affects every
   *   password-protected save (create, change, preserve-on-edit).
   */
  async save(sendData: [Send, EncArrayBuffer]): Promise<Send> {
    const [send] = sendData;
    if (send.id == null && send.type === SendType.File) {
      return this.sendApiService.save(sendData);
    }
    if (send.authType === AuthType.Password) {
      return this.sendApiService.save(sendData);
    }
    return (await this.getService()).save(sendData);
  }

  async delete(id: string): Promise<any> {
    return (await this.getService()).delete(id);
  }

  // Note: under the SDK path this hits the V2 endpoint, which removes all auth
  // (password and any other auth type), not just the password.
  async removePassword(id: string): Promise<any> {
    return (await this.getService()).removePassword(id);
  }

  // Wire-encrypted `SendResponse`; the SDK only has plaintext. Always legacy.
  async getSend(id: string): Promise<SendResponse> {
    return this.sendApiService.getSend(id);
  }

  // The SDK send-access methods target the SDK client's configured environment and
  // cannot accept a per-call API URL. When a caller supplies `apiUrl` (e.g. the CLI
  // receiving a Send hosted on a different instance) we must use the legacy HTTP path
  // so cross-instance access doesn't silently break.
  async postSendAccess(
    id: string,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendAccessResponse> {
    if (apiUrl != null) {
      return this.sendApiService.postSendAccess(id, request, apiUrl);
    }
    return (await this.getService()).postSendAccess(id, request);
  }

  async postSendAccessV2(
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendAccessResponse> {
    if (apiUrl != null) {
      return this.sendApiService.postSendAccessV2(accessToken, apiUrl);
    }
    return (await this.getService()).postSendAccessV2(accessToken);
  }

  // Wire-encrypted list; see getSend.
  async getSends(): Promise<ListResponse<SendResponse>> {
    return this.sendApiService.getSends();
  }

  // Wire-encrypted `SendResponse`; see getSend.
  async putSendRemovePassword(id: string): Promise<SendResponse> {
    return this.sendApiService.putSendRemovePassword(id);
  }

  async deleteSend(id: string): Promise<any> {
    return (await this.getService()).deleteSend(id);
  }

  // See postSendAccess: the SDK can't target a per-call API URL, so route to
  // legacy whenever `apiUrl` is supplied.
  async getSendFileDownloadData(
    send: SendAccessView,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse> {
    if (apiUrl != null) {
      return this.sendApiService.getSendFileDownloadData(send, request, apiUrl);
    }
    return (await this.getService()).getSendFileDownloadData(send, request);
  }

  async getSendFileDownloadDataV2(
    send: SendAccessView,
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse> {
    if (apiUrl != null) {
      return this.sendApiService.getSendFileDownloadDataV2(send, accessToken, apiUrl);
    }
    return (await this.getService()).getSendFileDownloadDataV2(send, accessToken);
  }
}
