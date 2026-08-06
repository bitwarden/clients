import { Observable, firstValueFrom, map, shareReplay } from "rxjs";

import { SendAccessToken } from "../../../auth/send-access";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ListResponse } from "../../../models/response/list.response";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { Send } from "../models/domain/send";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";
import { SendView } from "../models/view/send.view";
import { SendType } from "../types/send-type";

import { SendApiService } from "./send-api.service";
import { SendApiService as SendApiServiceAbstraction } from "./send-api.service.abstraction";
import { SendSdkApiService } from "./send-sdk-api.service";

/**
 * Selects between {@link SendApiService} and {@link SendSdkApiService} based on the
 * `pm-30110-sdk-sends-api` feature flag.
 *
 * Methods whose return type is a wire-encrypted shape the SDK cannot produce (`getSend`,
 * `getSends`, `putSendRemovePassword`) always route to legacy. Mutations and access-side
 * methods are flag-controlled; the SDK service refetches the encrypted form via legacy
 * after mutations to keep `InternalSendService` coherent.
 *
 * A "cross-instance Send" is a Send hosted on a different Bitwarden server than the
 * client is signed in to — typically the CLI receiving a self-hosted or EU-cloud Send
 * link. Callers signal this by passing `apiUrl`, which is forwarded to whichever service
 * the flag selects: legacy passes it per-request, and the SDK service builds a one-off
 * client against it (the shared SDK client is pinned to the configured environment).
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
   * Routes pre-encrypted saves to SDK when the flag is on, except for new file sends which fall
   * back to legacy regardless: the buffer arriving here is already encrypted under a
   * client-generated key, and the SDK generates its own key on create, so the two can never
   * match. {@link saveView} carries the plaintext instead, but it also falls back to legacy for
   * file creates for a separate reason — see its doc comment.
   *
   * `plaintextPassword` is forwarded unchanged to whichever service handles the save. The
   * legacy service ignores it; the SDK service uses it to derive the send password over the
   * key it generates. It is Protected Data — never logged here or downstream.
   */
  async save(sendData: [Send, EncArrayBuffer], plaintextPassword?: string): Promise<Send> {
    const [send] = sendData;
    if (send.id == null && send.type === SendType.File) {
      return this.sendApiService.save(sendData, plaintextPassword);
    }
    return (await this.getService()).save(sendData, plaintextPassword);
  }

  /**
   * Routes plaintext saves to whichever service the flag selects, so each implementation
   * encrypts once on the side that owns the send key: legacy client-side, the SDK in the SDK.
   *
   * New file sends are the exception and fall back to legacy regardless of the flag, matching
   * {@link save}. The SDK path is blocked on an `@bitwarden/sdk-internal` bump, not on anything
   * in this repo — see `SendSdkApiService.saveView` for the details and for what to restore once
   * that bump lands.
   */
  async saveView(
    view: SendView,
    file: File | ArrayBuffer | null,
    plaintextPassword?: string,
  ): Promise<Send> {
    if (view.id == null && view.type === SendType.File) {
      return this.sendApiService.saveView(view, file, plaintextPassword);
    }
    return (await this.getService()).saveView(view, file, plaintextPassword);
  }

  async delete(id: string): Promise<any> {
    return (await this.getService()).delete(id);
  }

  /**
   * Removes the auth from a send and updates local state.
   *
   * Under the SDK flag this calls the V2 endpoint, which removes **all auth** on the
   * send (password and any other auth type), not just the password. The legacy path
   * uses V1, which removes only the password. Callers that need the V1 semantics
   * specifically should keep the flag off until V2 ships everywhere.
   */
  async removePassword(id: string): Promise<any> {
    return (await this.getService()).removePassword(id);
  }

  /**
   * Always routed to legacy. Returns a wire-encrypted `SendResponse`, which the SDK
   * cannot produce (the SDK only exposes plaintext views).
   */
  async getSend(id: string): Promise<SendResponse> {
    return this.sendApiService.getSend(id);
  }

  /**
   * Accesses a send. `apiUrl` (cross-instance receive, e.g. the CLI opening a self-hosted Send
   * link while signed in to a different server) is forwarded to whichever service the flag
   * selects; both honour it.
   */
  async postSendAccess(accessToken: SendAccessToken, apiUrl?: string): Promise<SendAccessResponse> {
    return (await this.getService()).postSendAccess(accessToken, apiUrl);
  }

  /**
   * Always routed to legacy. Returns a wire-encrypted list of `SendResponse`, which the
   * SDK cannot produce; see {@link getSend}.
   */
  async getSends(): Promise<ListResponse<SendResponse>> {
    return this.sendApiService.getSends();
  }

  /**
   * Always routed to legacy. The selector's `removePassword` is the higher-level flow that
   * also refreshes local state; this lower-level method returns a wire-encrypted
   * `SendResponse` the SDK cannot produce.
   *
   * Note that the legacy `PUT /sends/{id}/remove-password` endpoint is V1 — it removes
   * only the password, not all auth types. See {@link removePassword} for the V2
   * (all-auth) behavior under the SDK flag.
   */
  async putSendRemovePassword(id: string): Promise<SendResponse> {
    return this.sendApiService.putSendRemovePassword(id);
  }

  async deleteSend(id: string): Promise<any> {
    return (await this.getService()).deleteSend(id);
  }

  /** See {@link postSendAccess} — `apiUrl` is forwarded to the selected service. */
  async getSendFileDownloadData(
    send: SendAccessView,
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse> {
    return (await this.getService()).getSendFileDownloadData(send, accessToken, apiUrl);
  }
}
