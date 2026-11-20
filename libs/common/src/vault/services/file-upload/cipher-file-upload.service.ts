// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer, EncString } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../../abstractions/api.service";
import { ErrorResponse } from "../../../models/response/error.response";
import {
  FileUploadService,
  UploadOptions,
} from "../../../platform/abstractions/file-upload/file-upload.service";
import { FileUploadType } from "../../../platform/enums";
import { CipherId, UserId } from "../../../types/guid";
import { CipherSdkService } from "../../abstractions/cipher-sdk.service";
import { CipherFileUploadService as CipherFileUploadServiceAbstraction } from "../../abstractions/file-upload/cipher-file-upload.service";

export class CipherFileUploadService implements CipherFileUploadServiceAbstraction {
  constructor(
    private apiService: ApiService,
    private fileUploadService: FileUploadService,
    private cipherSdkService: CipherSdkService,
  ) {}

  async uploadPrepared(
    cipherId: string,
    attachmentId: string,
    uploadUrl: string,
    fileUploadType: FileUploadType,
    encFileName: EncString,
    encData: EncArrayBuffer,
    userId: UserId,
    isAdmin: boolean,
    options?: UploadOptions,
  ): Promise<void> {
    try {
      await this.fileUploadService.upload(
        { url: uploadUrl, fileUploadType },
        encFileName,
        encData,
        {
          postDirect: (data: FormData) =>
            this.apiService.postAttachmentFile(cipherId, attachmentId, data, options),
          renewFileUploadUrl: async () =>
            await this.cipherSdkService.renewAttachmentUploadUrl(
              cipherId as CipherId,
              attachmentId,
              userId,
            ),
          rollback: async () => {
            await this.cipherSdkService.deleteAttachmentWithServer(
              cipherId as CipherId,
              attachmentId,
              userId,
              isAdmin,
            );
          },
        },
        options,
      );
    } catch (e) {
      if (e instanceof ErrorResponse) {
        throw new Error((e as ErrorResponse).getSingleMessage());
      } else {
        throw e;
      }
    }
  }
}
