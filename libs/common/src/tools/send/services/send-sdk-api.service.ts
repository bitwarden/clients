import { catchError, firstValueFrom, switchMap } from "rxjs";

import {
  PasswordManagerClient,
  SendAddRequest,
  SendAuthType,
  SendEditRequest,
  SendId as SdkSendId,
  SendView as SdkSendView,
  SendViewType,
} from "@bitwarden/sdk-internal";

import { AccountService } from "../../../auth/abstractions/account.service";
import { SendAccessToken } from "../../../auth/send-access";
import { getUserId } from "../../../auth/services/account.service";
import { ListResponse } from "../../../models/response/list.response";
import { LogService } from "../../../platform/abstractions/log.service";
import { SdkService, asUuid } from "../../../platform/abstractions/sdk/sdk.service";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { UserId } from "../../../types/guid";
import { SendData } from "../models/data/send.data";
import { Send } from "../models/domain/send";
import { SendAccessRequest } from "../models/request/send-access.request";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";
import { SendView } from "../models/view/send.view";
import { AuthType } from "../types/auth-type";
import { SendType } from "../types/send-type";

import { SendApiService } from "./send-api.service";
import { SendApiService as SendApiServiceAbstraction } from "./send-api.service.abstraction";
import { InternalSendService } from "./send.service.abstraction";

/**
 * SDK-backed implementation of `SendApiService`. Save/removePassword mutate via the SDK
 * then refetch via legacy to keep `InternalSendService` populated with `EncString`-shaped
 * data. Methods returning wire-encrypted shapes have no SDK equivalent and are routed to
 * legacy by `SendApiServiceSelector`; the throw-stubs here guard direct callers.
 */
export class SendSdkApiService implements SendApiServiceAbstraction {
  constructor(
    private sdkService: SdkService,
    private legacySendApiService: SendApiService,
    private sendService: InternalSendService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

  /**
   * Saves a send via the SDK. After the mutation, refetches the wire-encrypted form via
   * the legacy service to keep `InternalSendService` populated with `EncString`-shaped
   * data. Patches the input with server-assigned id/accessId on create so callers reading
   * those after `save()` continue to work.
   *
   * Two cases the SDK cannot currently handle are routed to legacy by
   * `SendApiServiceSelector` and rejected here as a guard for direct callers:
   *
   * - **New file sends.** `SendService.encrypt` produces a pre-encrypted buffer under a
   *   client-derived key; the SDK's `create_file_send` generates its own key.
   * - **Password-protected sends.** `Send.password` is already the PBKDF2-derived
   *   `keyB64`, but the SDK's `SendAuthType::auth_data`
   *   (`bitwarden-send/src/send.rs:160-163`) re-applies PBKDF2 to whatever string sits in
   *   `auth.password`, double-hashing the value. No skip-hash variant exists on the
   *   public request types.
   */
  async save(sendData: [Send, EncArrayBuffer]): Promise<Send> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const [send] = sendData;
    if (send.id == null && send.type === SendType.File) {
      throw new Error("SendSdkApiService.save: file send creation requires SendApiService.");
    }
    if (send.authType === AuthType.Password) {
      throw new Error("SendSdkApiService.save: password-protected sends require SendApiService.");
    }
    const sendView = await send.decrypt(userId);
    const sdkView = await this.mutateSend(sendView, userId);

    // Patch server-assigned identifiers onto the input for callers that read them after
    // save (matches the legacy SendApiService contract). The server always returns id
    // and accessId on a successful create.
    const sendId = sdkView.id as unknown as string;
    if (send.id == null) {
      send.id = sendId;
      send.accessId = sdkView.accessId as unknown as string;
    }

    try {
      return await this.refreshSendFromServer(sendId);
    } catch (error) {
      // The SDK mutation already landed on the server; only the encrypted-form refetch
      // failed. Surfacing this as a save error would prompt the user to retry, which on
      // a new send would duplicate it server-side. Log and return the caller's input
      // Send — its EncString fields are still valid (the caller encrypted them moments
      // ago), so decryption in post-save paths works. InternalSendService reconciles on
      // the next sync.
      this.logService.error(`Send refresh failed after successful mutation: ${error}`);
      return send;
    }
  }

  async delete(id: string): Promise<any> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().delete(asUuid<SdkSendId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to delete send: ${error}`);
          throw error;
        }),
      ),
    );
    await this.sendService.delete(id);
  }

  // Note: the SDK calls the V2 endpoint which removes all auth (password and any other
  // auth type), not just the password.
  async removePassword(id: string): Promise<any> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().remove_password(asUuid<SdkSendId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to remove send auth: ${error}`);
          throw error;
        }),
      ),
    );
    await this.refreshSendFromServer(id);
  }

  /**
   * Not supported via SDK — returns wire-encrypted `SendResponse`, which the SDK cannot
   * produce. `SendApiServiceSelector` routes calls to `SendApiService`; this stub catches
   * direct callers that bypass the selector.
   */
  getSend(_id: string): Promise<SendResponse> {
    return Promise.reject(new Error("SendSdkApiService.getSend: use SendApiService."));
  }

  // `apiUrl` is intentionally omitted; `SendApiServiceSelector` routes per-call `apiUrl`
  // to the legacy service.
  async postSendAccess(id: string, request: SendAccessRequest): Promise<SendAccessResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const view = await sdk.sends().access_send_v1(id, request.password ?? undefined);
    return new SendAccessResponse(view);
  }

  async postSendAccessV2(accessToken: SendAccessToken): Promise<SendAccessResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const view = await sdk.sends().access_send(accessToken.token);
    return new SendAccessResponse(view);
  }

  /**
   * Not supported via SDK — returns wire-encrypted `ListResponse<SendResponse>`, which
   * the SDK cannot produce. `SendApiServiceSelector` routes calls to `SendApiService`;
   * this stub catches direct callers that bypass the selector.
   */
  getSends(): Promise<ListResponse<SendResponse>> {
    return Promise.reject(new Error("SendSdkApiService.getSends: use SendApiService."));
  }

  /**
   * Not supported via SDK — returns wire-encrypted `SendResponse`, which the SDK cannot
   * produce. `SendApiServiceSelector` routes calls to `SendApiService`; this stub catches
   * direct callers that bypass the selector.
   */
  putSendRemovePassword(_id: string): Promise<SendResponse> {
    return Promise.reject(
      new Error("SendSdkApiService.putSendRemovePassword: use SendApiService."),
    );
  }

  async deleteSend(id: string): Promise<any> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().delete(asUuid<SdkSendId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to delete send: ${error}`);
          throw error;
        }),
      ),
    );
  }

  // `apiUrl` is intentionally omitted; `SendApiServiceSelector` routes per-call `apiUrl`
  // to the legacy service.
  async getSendFileDownloadData(
    send: SendAccessView,
    request: SendAccessRequest,
  ): Promise<SendFileDownloadDataResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const data = await sdk
      .sends()
      .get_file_download_data_v1(send.id, send.file.id, request.password ?? undefined);
    return new SendFileDownloadDataResponse(data);
  }

  // `apiUrl` is intentionally omitted; `SendApiServiceSelector` routes per-call `apiUrl`
  // to the legacy service.
  async getSendFileDownloadDataV2(
    send: SendAccessView,
    accessToken: SendAccessToken,
  ): Promise<SendFileDownloadDataResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const data = await sdk.sends().get_file_download_data(accessToken.token, send.file.id);
    return new SendFileDownloadDataResponse(data);
  }

  private async mutateSend(sendView: SendView, userId: UserId): Promise<SdkSendView> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          const sendsClient = ref.value.sends();
          if (sendView.id == null) {
            return await sendsClient.create(this.buildSendAddRequest(sendView));
          }
          return await sendsClient.edit(
            asUuid<SdkSendId>(sendView.id),
            this.buildSendEditRequest(sendView),
          );
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to upload send: ${error}`);
          throw error;
        }),
      ),
    );
  }

  // After the SDK executes a mutation server-side, refetch the wire-encrypted form via
  // the legacy API so InternalSendService stores EncString-shaped data and consumers
  // that decrypt the returned Send work correctly.
  private async refreshSendFromServer(id: string): Promise<Send> {
    const response = await this.legacySendApiService.getSend(id);
    const data = new SendData(response);
    await this.sendService.upsert(data);
    return new Send(data);
  }

  private buildSendAddRequest(sendView: SendView): SendAddRequest {
    return {
      name: sendView.name,
      notes: sendView.notes ?? undefined,
      viewType: this.buildSendViewType(sendView),
      maxAccessCount: sendView.maxAccessCount ?? undefined,
      disabled: sendView.disabled,
      hideEmail: sendView.hideEmail,
      deletionDate: this.requireDeletionDate(sendView).toISOString(),
      expirationDate: sendView.expirationDate?.toISOString() ?? undefined,
      auth: this.buildSendAuth(sendView),
    };
  }

  private buildSendEditRequest(sendView: SendView): SendEditRequest {
    return {
      name: sendView.name,
      notes: sendView.notes ?? undefined,
      viewType: this.buildSendViewType(sendView),
      maxAccessCount: sendView.maxAccessCount ?? undefined,
      disabled: sendView.disabled,
      hideEmail: sendView.hideEmail,
      deletionDate: this.requireDeletionDate(sendView).toISOString(),
      expirationDate: sendView.expirationDate?.toISOString() ?? undefined,
      auth: this.buildSendAuth(sendView),
    };
  }

  // SendView.deletionDate is typed as `Date` but declared with a `null` default, and
  // the file is `@ts-strict-ignore`. The SDK's SendAddRequest/SendEditRequest require a
  // non-null `DateTime<Utc>`. Fail fast at this boundary so a missing date surfaces as
  // a clear error rather than a confusing `.toISOString()` TypeError or a server-side
  // validation failure.
  private requireDeletionDate(sendView: SendView): Date {
    if (sendView.deletionDate == null) {
      throw new Error("Send is missing a deletion date.");
    }
    return sendView.deletionDate;
  }

  private buildSendViewType(sendView: SendView): SendViewType {
    if (sendView.type === SendType.File) {
      if (sendView.file == null || !sendView.file.fileName) {
        throw new Error("File send is missing a file name.");
      }
      return {
        File: {
          id: sendView.file.id ?? undefined,
          fileName: sendView.file.fileName,
          size: sendView.file.size?.toString() ?? undefined,
          sizeName: sendView.file.sizeName ?? undefined,
        },
      };
    }
    return {
      Text: {
        text: sendView.text?.text ?? undefined,
        hidden: sendView.text?.hidden ?? false,
      },
    };
  }

  // `AuthType.Password` is unreachable here: SendApiServiceSelector and the guard in
  // `save()` both route password-protected sends to the legacy service because the SDK
  // re-applies PBKDF2 to `auth.password`. When the SDK gains a skip-hash/preserve
  // variant, the routing changes and a `case AuthType.Password` branch comes back.
  private buildSendAuth(sendView: SendView): SendAuthType {
    switch (sendView.authType) {
      case AuthType.Email:
        if (sendView.emails == null || sendView.emails.length === 0) {
          throw new Error("Email-protected send is missing recipient emails.");
        }
        return { type: "emails", emails: sendView.emails };
      case AuthType.None:
      default:
        return { type: "none" };
    }
  }
}
