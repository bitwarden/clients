// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ApiService } from "../../../abstractions/api.service";
import { ErrorResponse } from "../../../models/response/error.response";
import {
  FileUploadApiMethods,
  FileUploadService,
} from "../../../platform/abstractions/file-upload/file-upload.service";
import { Utils } from "../../../platform/misc/utils";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CipherFileUploadService as CipherFileUploadServiceAbstraction } from "../../abstractions/file-upload/cipher-file-upload.service";
import { Cipher } from "../../models/domain/cipher";
import { AttachmentRequest } from "../../models/request/attachment.request";
import { AttachmentUploadDataResponse } from "../../models/response/attachment-upload-data.response";
import { CipherResponse } from "../../models/response/cipher.response";

export class CipherFileUploadService implements CipherFileUploadServiceAbstraction {
  constructor(
    private apiService: ApiService,
    private fileUploadService: FileUploadService,
  ) {}

  async upload(
    cipher: Cipher,
    encFileName: EncString,
    encData: EncArrayBuffer,
    admin: boolean,
    dataEncKey: [SymmetricCryptoKey, EncString],
  ): Promise<CipherResponse> {
    const request: AttachmentRequest = {
      key: dataEncKey[1].encryptedString,
      fileName: encFileName.encryptedString,
      fileSize: encData.buffer.byteLength,
      adminRequest: admin,
    };

    let response: CipherResponse;
    try {
      const uploadDataResponse = await this.apiService.postCipherAttachment(cipher.id, request);
      response = admin ? uploadDataResponse.cipherMiniResponse : uploadDataResponse.cipherResponse;
      await this.fileUploadService.upload(
        uploadDataResponse,
        encFileName,
        encData,
        this.generateMethods(uploadDataResponse, response, request.adminRequest),
      );
    } catch (e) {
      if (
        (e instanceof ErrorResponse && (e as ErrorResponse).statusCode === 404) ||
        (e as ErrorResponse).statusCode === 405
      ) {
        response = await this.legacyServerAttachmentFileUpload(
          request.adminRequest,
          cipher.id,
          encFileName,
          encData,
          dataEncKey[1],
        );
      } else if (e instanceof ErrorResponse) {
        throw new Error((e as ErrorResponse).getSingleMessage());
      } else {
        throw e;
      }
    }
    return response;
  }

  private generateMethods(
    uploadData: AttachmentUploadDataResponse,
    response: CipherResponse,
    isAdmin: boolean,
  ): FileUploadApiMethods {
    return {
      postDirect: this.generatePostDirectCallback(uploadData, isAdmin),
      renewFileUploadUrl: this.generateRenewFileUploadUrlCallback(uploadData, response, isAdmin),
      rollback: this.generateRollbackCallback(response, uploadData, isAdmin),
    };
  }

  private generatePostDirectCallback(uploadData: AttachmentUploadDataResponse, isAdmin: boolean) {
    return (data: FormData) => {
      const response = isAdmin ? uploadData.cipherMiniResponse : uploadData.cipherResponse;
      return this.apiService.postAttachmentFile(response.id, uploadData.attachmentId, data);
    };
  }

  private generateRenewFileUploadUrlCallback(
    uploadData: AttachmentUploadDataResponse,
    response: CipherResponse,
    isAdmin: boolean,
  ) {
    return async () => {
      const renewResponse = await this.apiService.renewAttachmentUploadUrl(
        response.id,
        uploadData.attachmentId,
      );
      return renewResponse?.url;
    };
  }

  private generateRollbackCallback(
    response: CipherResponse,
    uploadData: AttachmentUploadDataResponse,
    isAdmin: boolean,
  ) {
    return () => {
      if (isAdmin) {
        return this.apiService.deleteCipherAttachmentAdmin(response.id, uploadData.attachmentId);
      } else {
        return this.apiService.deleteCipherAttachment(response.id, uploadData.attachmentId);
      }
    };
  }

  /**
   * @deprecated Mar 25 2021: This method has been deprecated in favor of direct uploads.
   * This method still exists for backward compatibility with old server versions.
   */
  async legacyServerAttachmentFileUpload(
    admin: boolean,
    cipherId: string,
    encFileName: EncString,
    encData: EncArrayBuffer,
    key: EncString,
  ) {
    const fd = new FormData();
    try {
      const blob = new Blob([encData.buffer], { type: "application/octet-stream" });
      fd.append("key", key.encryptedString);
      fd.append("data", blob, encFileName.encryptedString);
    } catch (e) {
      if (Utils.isNode && !Utils.isBrowser) {
        fd.append("key", key.encryptedString);
        fd.append(
          "data",
          Buffer.from(encData.buffer) as any,
          {
            filepath: encFileName.encryptedString,
            contentType: "application/octet-stream",
          } as any,
        );
      } else {
        throw e;
      }
    }

    let response: CipherResponse;
    try {
      if (admin) {
        response = await this.apiService.postCipherAttachmentAdminLegacy(cipherId, fd);
      } else {
        response = await this.apiService.postCipherAttachmentLegacy(cipherId, fd);
      }
    } catch (e) {
      throw new Error((e as ErrorResponse).getSingleMessage());
    }

    return response;
  }
}
