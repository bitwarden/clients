import { catchError, firstValueFrom, switchMap } from "rxjs";

import {
  AuthType as SdkAuthType,
  CreateFileSendView as SdkCreateFileSendView,
  PasswordManagerClient,
  SendAddRequest,
  SendAuthType,
  SendEditRequest,
  SendId as SdkSendId,
  SendView as SdkSendView,
  SendViewType,
} from "@bitwarden/sdk-internal";

import { ApiService } from "../../../abstractions/api.service";
import { AccountService } from "../../../auth/abstractions/account.service";
import { SendAccessToken } from "../../../auth/send-access";
import { getUserId } from "../../../auth/services/account.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { ListResponse } from "../../../models/response/list.response";
import {
  FileUploadService,
  FileUploadApiMethods,
} from "../../../platform/abstractions/file-upload/file-upload.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { SdkService, asUuid } from "../../../platform/abstractions/sdk/sdk.service";
import { FileUploadType } from "../../../platform/enums";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { UserId } from "../../../types/guid";
import { SendFileData } from "../models/data/send-file.data";
import { SendTextData } from "../models/data/send-text.data";
import { SendData } from "../models/data/send.data";
import { Send } from "../models/domain/send";
import { SendAccessRequest } from "../models/request/send-access.request";
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
import { InternalSendService } from "./send.service.abstraction";

export class SendSdkApiService implements SendApiServiceAbstraction {
  constructor(
    private sdkService: SdkService,
    private apiService: ApiService,
    private fileUploadService: FileUploadService,
    private sendService: InternalSendService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

  async save(sendData: [Send, EncArrayBuffer]): Promise<Send> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const [send, encBuffer] = sendData;
    const sendView = await send.decrypt(userId);
    const sdkView = await this.upload(
      sendView,
      userId,
      encBuffer?.buffer as unknown as ArrayBuffer,
    );
    const data = this.sdkSendViewToSendData(sdkView);
    await this.sendService.upsert(data);
    return new Send(data);
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

  async removePassword(id: string): Promise<any> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const view = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().remove_password(asUuid<SdkSendId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to remove send password: ${error}`);
          throw error;
        }),
      ),
    );
    const data = this.sdkSendViewToSendData(view);
    await this.sendService.upsert(data);
  }

  async getSend(id: string): Promise<SendResponse> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const view = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().get(asUuid<SdkSendId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to get send: ${error}`);
          throw error;
        }),
      ),
    );
    return this.sdkSendViewToSendResponse(view);
  }

  async postSendAccess(
    id: string,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendAccessResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const view = await sdk
      .auth()
      .send_access()
      .access_send_v1(id, request.password ?? undefined);
    return new SendAccessResponse(view);
  }

  async postSendAccessV2(
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendAccessResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const view = await sdk.auth().send_access().access_send(accessToken.token);
    return new SendAccessResponse(view);
  }

  async getSends(): Promise<ListResponse<SendResponse>> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const views = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().list();
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to list sends: ${error}`);
          throw error;
        }),
      ),
    );
    return new ListResponse({ data: views.map((v) => this.sdkSendViewToRawJson(v)) }, SendResponse);
  }

  async postSend(request: SendRequest): Promise<SendResponse> {
    const r = await this.apiService.send("POST", "/sends", request, true, true);
    return new SendResponse(r);
  }

  async postFileTypeSend(request: SendRequest): Promise<SendFileUploadDataResponse> {
    const r = await this.apiService.send("POST", "/sends/file/v2", request, true, true);
    return new SendFileUploadDataResponse(r);
  }

  async postSendFile(sendId: string, fileId: string, data: FormData): Promise<any> {
    return this.apiService.send("POST", "/sends/" + sendId + "/file/" + fileId, data, true, false);
  }

  async putSend(id: string, request: SendRequest): Promise<SendResponse> {
    const r = await this.apiService.send("PUT", "/sends/" + id, request, true, true);
    return new SendResponse(r);
  }

  async putSendRemovePassword(id: string): Promise<SendResponse> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const view = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().remove_password(asUuid<SdkSendId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to remove send password: ${error}`);
          throw error;
        }),
      ),
    );
    return this.sdkSendViewToSendResponse(view);
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

  async getSendFileDownloadData(
    send: SendAccessView,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const data = await sdk
      .auth()
      .send_access()
      .get_file_download_data_v1(send.id, send.file.id, request.password ?? undefined);
    return new SendFileDownloadDataResponse(data);
  }

  async getSendFileDownloadDataV2(
    send: SendAccessView,
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const data = await sdk
      .auth()
      .send_access()
      .get_file_download_data(accessToken.token, send.file.id);
    return new SendFileDownloadDataResponse(data);
  }

  async renewSendFileUploadUrl(
    sendId: string,
    fileId: string,
  ): Promise<SendFileUploadDataResponse> {
    const r = await this.apiService.send(
      "GET",
      "/sends/" + sendId + "/file/" + fileId,
      null,
      true,
      true,
    );
    return new SendFileUploadDataResponse(r);
  }

  private async upload(
    sendView: SendView,
    userId: UserId,
    file?: ArrayBuffer,
  ): Promise<SdkSendView> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          const sendsClient = ref.value.sends();

          if (sendView.id == null) {
            const request = this.buildSendAddRequest(sendView);

            if (sendView.type === SendType.File) {
              const createResult = await sendsClient.create_file_send(request);
              if (file != null) {
                await this.uploadFile(createResult, userId, file);
              }
              return createResult.send;
            }

            return await sendsClient.create(request);
          } else {
            const request = this.buildSendEditRequest(sendView);
            return await sendsClient.edit(asUuid<SdkSendId>(sendView.id), request);
          }
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to upload send: ${error}`);
          throw error;
        }),
      ),
    );
  }

  private async uploadFile(
    createResult: SdkCreateFileSendView,
    userId: UserId,
    file: ArrayBuffer,
  ): Promise<void> {
    const encryptedBytes = new Uint8Array(file);
    const sendId = createResult.send.id!;
    const fileId = createResult.fileId;
    const encryptedFileName = createResult.encryptedFileName;

    const fileUploadMethods: FileUploadApiMethods = {
      postDirect: async (_formData: FormData) => {
        await firstValueFrom(
          this.sdkService.userClient$(userId).pipe(
            switchMap(async (sdk) => {
              if (!sdk) {
                throw new Error("SDK not available");
              }
              using ref = sdk.take();
              await ref.value
                .sends()
                .upload_send_file(sendId, fileId, encryptedFileName, encryptedBytes);
            }),
            catchError((error: unknown) => {
              this.logService.error(`Failed to upload send file: ${error}`);
              throw error;
            }),
          ),
        );
      },
      renewFileUploadUrl: async () => {
        return await firstValueFrom(
          this.sdkService.userClient$(userId).pipe(
            switchMap(async (sdk) => {
              if (!sdk) {
                throw new Error("SDK not available");
              }
              using ref = sdk.take();
              return await ref.value.sends().renew_file_upload_url(sendId, fileId);
            }),
            catchError((error: unknown) => {
              this.logService.error(`Failed to renew send file upload URL: ${error}`);
              throw error;
            }),
          ),
        );
      },
      rollback: async () => {
        await firstValueFrom(
          this.sdkService.userClient$(userId).pipe(
            switchMap(async (sdk) => {
              if (!sdk) {
                throw new Error("SDK not available");
              }
              using ref = sdk.take();
              await ref.value.sends().delete(sendId);
            }),
            catchError((error: unknown) => {
              this.logService.error(`Failed to rollback send: ${error}`);
              throw error;
            }),
          ),
        );
      },
    };

    await this.fileUploadService.upload(
      { url: createResult.url, fileUploadType: createResult.fileUploadType as FileUploadType },
      new EncString(encryptedFileName),
      new EncArrayBuffer(encryptedBytes),
      fileUploadMethods,
    );
  }

  private buildSendAddRequest(sendView: SendView): SendAddRequest {
    return {
      name: sendView.name,
      notes: sendView.notes ?? undefined,
      viewType: this.buildSendViewType(sendView),
      maxAccessCount: sendView.maxAccessCount ?? undefined,
      disabled: sendView.disabled,
      hideEmail: sendView.hideEmail,
      deletionDate: sendView.deletionDate.toISOString(),
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
      deletionDate: sendView.deletionDate.toISOString(),
      expirationDate: sendView.expirationDate?.toISOString() ?? undefined,
      auth: this.buildSendAuth(sendView),
    };
  }

  private buildSendViewType(sendView: SendView): SendViewType {
    if (sendView.type === SendType.File) {
      return {
        File: {
          id: sendView.file?.id ?? undefined,
          fileName: sendView.file?.fileName ?? "",
          size: sendView.file?.size?.toString() ?? undefined,
          sizeName: sendView.file?.sizeName ?? undefined,
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

  private buildSendAuth(sendView: SendView): SendAuthType {
    switch (sendView.authType) {
      case AuthType.Password:
        return { type: "password", password: sendView.password ?? "" };
      case AuthType.Email:
        return { type: "emails", emails: sendView.emails ?? [] };
      case AuthType.None:
      default:
        return { type: "none" };
    }
  }

  // FIXME: SendResponse stores encrypted field values from the server response, but the SDK
  // returns a decrypted SendView. Fields such as name, notes, key, and text are therefore
  // stored here as plaintext. This is a known transitional limitation.
  private sdkSendViewToRawJson(view: SdkSendView): any {
    return {
      id: view.id as unknown as string,
      accessId: view.accessId ?? null,
      type: view.type === "Text" ? SendType.Text : SendType.File,
      name: view.name,
      notes: view.notes ?? null,
      key: view.key ?? null,
      maxAccessCount: view.maxAccessCount ?? null,
      accessCount: view.accessCount,
      revisionDate: view.revisionDate,
      deletionDate: view.deletionDate,
      expirationDate: view.expirationDate ?? null,
      disabled: view.disabled,
      hideEmail: view.hideEmail,
      authType: this.sdkAuthTypeToAuthType(view.authType),
      emails: view.emails?.join(",") ?? null,
      password: null,
      text: view.text != null ? { text: view.text.text ?? null, hidden: view.text.hidden } : null,
      file:
        view.file != null
          ? {
              id: view.file.id ?? null,
              fileName: view.file.fileName,
              size: view.file.size ?? null,
              sizeName: view.file.sizeName ?? null,
            }
          : null,
    };
  }

  private sdkSendViewToSendResponse(view: SdkSendView): SendResponse {
    return new SendResponse(this.sdkSendViewToRawJson(view));
  }

  // FIXME: SendData stores encrypted field values from the server response, but the SDK
  // returns a decrypted SendView. Fields such as name, notes, key, and text are therefore
  // stored here as plaintext. This is a known transitional limitation and will be resolved
  // when SDK state management fully replaces InternalSendService.
  private sdkSendViewToSendData(view: SdkSendView): SendData {
    const data = new SendData();
    data.id = view.id as unknown as string;
    data.accessId = view.accessId ?? null;
    data.type = view.type === "Text" ? SendType.Text : SendType.File;
    data.name = view.name;
    data.notes = view.notes ?? null;
    data.key = view.key ?? null;
    data.maxAccessCount = view.maxAccessCount ?? null;
    data.accessCount = view.accessCount;
    data.revisionDate = view.revisionDate;
    data.deletionDate = view.deletionDate;
    data.expirationDate = view.expirationDate ?? null;
    data.disabled = view.disabled;
    data.hideEmail = view.hideEmail;
    data.authType = this.sdkAuthTypeToAuthType(view.authType);
    data.emails = view.emails?.join(",") ?? null;
    data.password = null;

    if (view.type === "Text" && view.text != null) {
      data.text = new SendTextData();
      data.text.text = view.text.text ?? null;
      data.text.hidden = view.text.hidden;
    }

    if (view.type === "File" && view.file != null) {
      data.file = new SendFileData();
      data.file.id = view.file.id ?? null;
      data.file.fileName = view.file.fileName;
      data.file.size = view.file.size ?? null;
      data.file.sizeName = view.file.sizeName ?? null;
    }

    return data;
  }

  private sdkAuthTypeToAuthType(authType: SdkAuthType): AuthType {
    switch (authType) {
      case "Email":
        return AuthType.Email;
      case "Password":
        return AuthType.Password;
      case "None":
      default:
        return AuthType.None;
    }
  }
}
