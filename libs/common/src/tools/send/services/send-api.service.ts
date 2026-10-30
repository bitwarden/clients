import { catchError, concatMap, firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer } from "@bitwarden/legacy-crypto";
import {
  AuthEdit,
  PasswordManagerClient,
  SendAddRequest,
  SendAuthType,
  SendClient,
  SendEditRequest,
  SendId as SdkSendId,
  SendView as SdkSendView,
  SendViewType,
} from "@bitwarden/sdk-internal";

import { ApiService } from "../../../abstractions/api.service";
import { AccountService } from "../../../auth/abstractions/account.service";
import { SendAccessToken } from "../../../auth/send-access";
import { getUserId } from "../../../auth/services/account.service";
import { ErrorResponse } from "../../../models/response/error.response";
import {
  FileUploadApiMethods,
  FileUploadService,
} from "../../../platform/abstractions/file-upload/file-upload.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { SdkService, asUuid } from "../../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../../types/guid";
import { SendData } from "../models/data/send.data";
import { Send } from "../models/domain/send";
import { SendRequest } from "../models/request/send.request";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendFileUploadDataResponse } from "../models/response/send-file-upload-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";
import { SendView } from "../models/view/send.view";
import { AuthType } from "../types/auth-type";
import { SendType } from "../types/send-type";

import { SendApiService as SendApiServiceAbstraction } from "./send-api.service.abstraction";
import { SendDecryptionService } from "./send-decryption.service";
import { InternalSendService } from "./send.service.abstraction";

/**
 * Plaintext size limit for SDK file send creation. PM-41234 removed the JS-heap overhead it was
 * sized for; kept pending a decision on whether a cap is still needed.
 */
export const MAX_SDK_FILE_SEND_SIZE_BYTES = 500 * 1024 * 1024;

/**
 * Mutations and same-instance access go through the SDK. REST is used where the SDK can't serve
 * the call: the wire-encrypted read-back after a mutation, new file sends through {@link save},
 * and cross-instance access (`apiUrl` set), since the SDK only targets its own server.
 */
export class SendApiService implements SendApiServiceAbstraction {
  constructor(
    private apiService: ApiService,
    private fileUploadService: FileUploadService,
    private sendService: InternalSendService,
    private logService: LogService,
    private sdkService: SdkService,
    private accountService: AccountService,
    private sendDecryptionService: SendDecryptionService,
  ) {}

  /**
   * New file sends are created over REST: their buffer is pre-encrypted under a client key that
   * can never match the key the SDK generates. {@link saveView} creates file sends via the SDK.
   *
   * Other saves go through the SDK, which derives the password proof from `plaintextPassword`;
   * an edit without one preserves the existing auth. The plaintext password is Protected Data:
   * never log it.
   *
   * @param signal Honoured only for new file sends: aborting rolls the send back and throws an
   *   `AbortError`.
   */
  async save(
    sendData: [Send, EncArrayBuffer],
    plaintextPassword?: string,
    signal?: AbortSignal,
  ): Promise<Send> {
    const [send] = sendData;
    if (send.id == null && send.type === SendType.File) {
      return this.createFileSendViaApi(sendData, signal);
    }
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const sendView = await this.sendDecryptionService.decryptSend(send, userId);
    const sdkView = await this.mutateSend(sendView, userId, plaintextPassword);

    // Callers read id/accessId off the input after save.
    const sendId = sdkView.id as unknown as string;
    if (send.id == null) {
      send.id = sendId;
      send.accessId = sdkView.accessId as unknown as string;
    }

    try {
      return await this.refreshSendFromServer(sendId);
    } catch (error) {
      // The mutation landed; failing here would invite a duplicating retry. The input's EncStrings
      // are still valid, and the next sync reconciles state.
      this.logService.error(`Send refresh failed after successful mutation: ${error}`);
      return send;
    }
  }

  /**
   * Preferred entry point: the SDK generates the send key and encrypts, so no key material reaches
   * this code. The plaintext password is Protected Data: never log it.
   *
   * @param file Required to create a file send; ignored on edit (contents are immutable).
   */
  async saveView(
    view: SendView,
    file: File | ArrayBuffer | null,
    plaintextPassword?: string,
    signal?: AbortSignal,
  ): Promise<Send> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const sdkView =
      view.id == null && view.type === SendType.File
        ? await this.createFileSend(view, file, userId, plaintextPassword, signal)
        : await this.mutateSend(view, userId, plaintextPassword);

    return await this.refreshAfterMutation(sdkView.id as unknown as string);
  }

  async delete(id: string): Promise<any> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
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

  // Removes all auth (password or email OTP) from the send.
  async removePassword(id: string): Promise<any> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
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

  /** Uses REST when `apiUrl` is set (cross-instance): the SDK only targets its own server. */
  async postSendAccess(accessToken: SendAccessToken, apiUrl?: string): Promise<SendAccessResponse> {
    if (apiUrl != null) {
      const r = await this.apiService.send(
        "POST",
        "/sends/access",
        null,
        false,
        true,
        apiUrl,
        this.bearerTokenHeader(accessToken),
      );
      return new SendAccessResponse(r);
    }
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const view = await sdk.sends().access_send(accessToken.token);
    return new SendAccessResponse(view);
  }

  /** Same `apiUrl` routing as {@link postSendAccess}. */
  async getSendFileDownloadData(
    send: SendAccessView,
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse> {
    if (apiUrl != null) {
      const r = await this.apiService.send(
        "POST",
        "/sends/access/file/" + send.file.id,
        null,
        false,
        true,
        apiUrl,
        this.bearerTokenHeader(accessToken),
      );
      return new SendFileDownloadDataResponse(r);
    }
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const data = await sdk.sends().get_file_download_data(accessToken.token, send.file.id);
    return new SendFileDownloadDataResponse(data);
  }

  async mutateSend(
    sendView: SendView,
    userId: UserId,
    plaintextPassword?: string,
  ): Promise<SdkSendView> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          const sendsClient = ref.value.sends();
          if (sendView.id == null) {
            return await sendsClient.create(this.buildSendAddRequest(sendView, plaintextPassword));
          }
          return await sendsClient.edit(
            asUuid<SdkSendId>(sendView.id),
            this.buildSendEditRequest(sendView, plaintextPassword),
          );
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to upload send: ${error}`);
          throw error;
        }),
      ),
    );
  }

  /**
   * Falls back to the SDK's local copy if the server refetch fails, rather than failing a
   * mutation that already landed (a retry would duplicate the send).
   */
  async refreshAfterMutation(sendId: string): Promise<Send> {
    try {
      return await this.refreshSendFromServer(sendId);
    } catch (error) {
      this.logService.error(`Send refresh failed after successful mutation: ${error}`);
      const local = await this.sendService.getFromState(sendId);
      if (local == null) {
        throw error;
      }
      return local;
    }
  }

  /**
   * SDK two-step create → upload. The SDK encrypts the plaintext bytes under a key it generates,
   * so no key material reaches this code.
   */
  private async createFileSend(
    view: SendView,
    file: File | ArrayBuffer | null,
    userId: UserId,
    plaintextPassword?: string,
    signal?: AbortSignal,
  ): Promise<SdkSendView> {
    // Bail before any network work if the caller already cancelled.
    if (signal?.aborted) {
      throw new DOMException("Send creation was cancelled", "AbortError");
    }

    if (file == null) {
      throw new Error("File send creation requires file data.");
    }
    const fileSize = file instanceof ArrayBuffer ? file.byteLength : file.size;
    if (fileSize > MAX_SDK_FILE_SEND_SIZE_BYTES) {
      throw new Error(
        `File is too large to send (max ${MAX_SDK_FILE_SEND_SIZE_BYTES / (1024 * 1024)} MB).`,
      );
    }
    const fileBytes =
      file instanceof ArrayBuffer ? new Uint8Array(file) : new Uint8Array(await file.arrayBuffer());
    // The CLI passes an ArrayBuffer and sets the file name on the view instead.
    const fileName = file instanceof ArrayBuffer ? view.file?.fileName : file.name;

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          const sendsClient = ref.value.sends();
          const created = await sendsClient.create_file_send(
            this.buildSendAddRequest(view, plaintextPassword, fileName),
            fileBytes,
          );

          const sendId = created.send.id;
          if (sendId == null) {
            throw new Error("Created file send is missing its id.");
          }

          const {
            encryptedFileBuffer,
            fileId,
            encryptedFileName,
            fileUploadType,
            url,
            send: sendView,
          } = created;

          try {
            await sendsClient.upload_send_file(
              sendId,
              fileId,
              encryptedFileName,
              fileUploadType,
              url,
              encryptedFileBuffer,
            );
          } catch (error) {
            await this.rollbackFileSend(sendsClient, sendId);
            throw error;
          }

          // Uploads can't be interrupted; roll back if the caller cancelled meanwhile.
          if (signal?.aborted) {
            await this.rollbackFileSend(sendsClient, sendId);
            throw new DOMException("Send creation was cancelled", "AbortError");
          }

          return sendView;
        }),
        catchError((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            this.logService.error(`Failed to create file send: ${error}`);
          }
          throw error;
        }),
      ),
    );
  }

  /**
   * Deletes the send `create_file_send` registered so a failed upload leaves no empty send. Logs
   * rather than throws so the caller still sees the original error.
   */
  private async rollbackFileSend(sendsClient: SendClient, sendId: SdkSendId): Promise<void> {
    try {
      await sendsClient.delete(sendId);
    } catch (error: unknown) {
      this.logService.error(`Failed to roll back file send after a failed upload: ${error}`);
    }
  }

  // The SDK only exposes plaintext views; local state needs the wire-encrypted form.
  private async refreshSendFromServer(id: string): Promise<Send> {
    const r = await this.apiService.send("GET", "/sends/" + id, null, true, true);
    const data = new SendData(new SendResponse(r));
    await this.sendService.upsert(data);
    return new Send(data);
  }

  private buildSendAddRequest(
    sendView: SendView,
    plaintextPassword?: string,
    fileName?: string,
  ): SendAddRequest {
    return {
      name: sendView.name,
      notes: sendView.notes ?? undefined,
      viewType: this.buildSendViewType(sendView, fileName),
      maxAccessCount: sendView.maxAccessCount ?? undefined,
      disabled: sendView.disabled,
      hideEmail: sendView.hideEmail,
      deletionDate: this.requireDeletionDate(sendView).toISOString(),
      expirationDate: sendView.expirationDate?.toISOString() ?? undefined,
      // A create has no existing auth to preserve.
      auth: this.buildSendAuth(sendView, plaintextPassword),
    };
  }

  private buildSendEditRequest(sendView: SendView, plaintextPassword?: string): SendEditRequest {
    return {
      name: sendView.name,
      notes: sendView.notes ?? undefined,
      viewType: this.buildSendViewType(sendView),
      maxAccessCount: sendView.maxAccessCount ?? undefined,
      disabled: sendView.disabled,
      hideEmail: sendView.hideEmail,
      deletionDate: this.requireDeletionDate(sendView).toISOString(),
      expirationDate: sendView.expirationDate?.toISOString() ?? undefined,
      auth: this.buildSendAuthEdit(sendView, plaintextPassword),
    };
  }

  /**
   * A password-protected edit without a new plaintext password sends `Preserve`, so the SDK keeps
   * the stored auth and the client never needs the existing hash.
   */
  private buildSendAuthEdit(sendView: SendView, plaintextPassword?: string): AuthEdit {
    if (sendView.authType === AuthType.Password && plaintextPassword == null) {
      return { type: "preserve" };
    }
    return { type: "set", auth: this.buildSendAuth(sendView, plaintextPassword) };
  }

  // deletionDate can be null at runtime (ts-strict-ignore) but the SDK requires it; fail clearly.
  private requireDeletionDate(sendView: SendView): Date {
    if (sendView.deletionDate == null) {
      throw new Error("Send is missing a deletion date.");
    }
    return sendView.deletionDate;
  }

  /**
   * @param fileName Overrides `sendView.file.fileName`; the form doesn't populate `sendView.file`
   *   for a new file.
   */
  private buildSendViewType(sendView: SendView, fileName?: string): SendViewType {
    if (sendView.type === SendType.File) {
      const resolvedFileName = fileName ?? sendView.file?.fileName;
      if (!resolvedFileName) {
        throw new Error("File send is missing a file name.");
      }
      return {
        File: {
          id: sendView.file?.id ?? undefined,
          fileName: resolvedFileName,
          size: sendView.file?.size?.toString() ?? undefined,
          sizeName: sendView.file?.sizeName ?? undefined,
        },
      };
    } else if (sendView.type === SendType.Item) {
      if (!sendView.data?.data) {
        throw new Error("Item Send is missing data");
      }
      return {
        Item: {
          data: sendView.data.data.toSdkCipherView(),
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

  /**
   * The SDK derives the password proof over the key it generates, keeping them consistent. The
   * plaintext password is Protected Data: never log it or put it in errors.
   */
  private buildSendAuth(sendView: SendView, plaintextPassword?: string): SendAuthType {
    switch (sendView.authType) {
      case AuthType.Email:
        if (sendView.emails == null || sendView.emails.length === 0) {
          throw new Error("Email-protected send is missing recipient emails.");
        }
        return { type: "emails", emails: sendView.emails };
      case AuthType.Password:
        if (plaintextPassword == null) {
          throw new Error("Password-protected send is missing its password.");
        }
        return { type: "password", password: plaintextPassword };
      case AuthType.None:
      default:
        return { type: "none" };
    }
  }

  private bearerTokenHeader(accessToken: SendAccessToken) {
    return (headers: Headers) => {
      headers.set("Authorization", "Bearer " + accessToken.token);
    };
  }

  // REST creation of new file sends, used only by save().

  private async createFileSendViaApi(
    sendData: [Send, EncArrayBuffer],
    signal?: AbortSignal,
  ): Promise<Send> {
    const response = await this.uploadNewFileSend(sendData, signal);

    const data = new SendData(response);
    await this.sendService.upsert(data);
    return new Send(data);
  }

  private async uploadNewFileSend(
    sendData: [Send, EncArrayBuffer],
    signal?: AbortSignal,
  ): Promise<SendResponse> {
    // Bail before doing any network work if the caller already abandoned this submission —
    // otherwise a cancel that lands before this point still uploads the whole file only to
    // immediately delete it.
    if (signal?.aborted) {
      throw new DOMException("Send creation was cancelled", "AbortError");
    }

    const request = new SendRequest(sendData[0], sendData[1]?.buffer.byteLength);

    let response: SendResponse;
    try {
      const r = await this.apiService.send("POST", "/sends/file/v2", request, true, true);
      const uploadDataResponse = new SendFileUploadDataResponse(r);
      response = uploadDataResponse.sendResponse;
      const fileUploadMethods = this.generateMethods(response);
      await this.fileUploadService.upload(
        uploadDataResponse,
        sendData[0].file.fileName,
        sendData[1],
        fileUploadMethods,
      );
      // Uploads can't be interrupted; roll back if the caller cancelled meanwhile.
      if (signal?.aborted) {
        try {
          await fileUploadMethods.rollback();
        } catch (rollbackError) {
          // Log rather than throw so the caller sees the AbortError, not a generic error.
          this.logService.error(
            `Failed to roll back file send after a cancelled upload: ${rollbackError}`,
          );
        }
        throw new DOMException("Send creation was cancelled", "AbortError");
      }
    } catch (e) {
      if (e instanceof ErrorResponse) {
        throw new Error((e as ErrorResponse).getSingleMessage());
      } else {
        throw e;
      }
    }
    sendData[0].id = response.id;
    sendData[0].accessId = response.accessId;
    return response;
  }

  private generateMethods(response: SendResponse): FileUploadApiMethods {
    return {
      postDirect: this.generatePostDirectCallback(response),
      renewFileUploadUrl: this.generateRenewFileUploadUrlCallback(response.id, response.file.id),
      rollback: this.generateRollbackCallback(response.id),
    };
  }

  private generatePostDirectCallback(sendResponse: SendResponse) {
    return (data: FormData) => {
      return this.apiService.send(
        "POST",
        "/sends/" + sendResponse.id + "/file/" + sendResponse.file.id,
        data,
        true,
        false,
      );
    };
  }

  private generateRenewFileUploadUrlCallback(sendId: string, fileId: string) {
    return async () => {
      const r = await this.apiService.send(
        "GET",
        "/sends/" + sendId + "/file/" + fileId,
        null,
        true,
        true,
      );
      return new SendFileUploadDataResponse(r)?.url;
    };
  }

  private generateRollbackCallback(sendId: string) {
    return () => {
      return this.apiService.send("DELETE", "/sends/" + sendId, null, true, false);
    };
  }
}
