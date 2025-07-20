// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ApiService } from "../../../abstractions/api.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import {
  FileUploadApiMethods,
  FileUploadService as FileUploadServiceAbstraction,
} from "../../abstractions/file-upload/file-upload.service";
import { LogService } from "../../abstractions/log.service";
import { FileUploadType } from "../../enums";
import { EncArrayBuffer } from "../../models/domain/enc-array-buffer";

import { AzureFileUploadService } from "./azure-file-upload.service";
import { BitwardenFileUploadService } from "./bitwarden-file-upload.service";

export class FileUploadService implements FileUploadServiceAbstraction {
  private azureFileUploadService: AzureFileUploadService;
  private bitwardenFileUploadService: BitwardenFileUploadService;

  constructor(
    protected logService: LogService,
    apiService: ApiService,
  ) {
    this.azureFileUploadService = new AzureFileUploadService(logService, apiService);
    this.bitwardenFileUploadService = new BitwardenFileUploadService();
  }

  async upload(
    uploadData: { url: string; fileUploadType: FileUploadType },
    fileName: EncString,
    encryptedFileData: EncArrayBuffer,
    fileUploadMethods: FileUploadApiMethods,
  ) {
    try {
      switch (uploadData.fileUploadType) {
        case FileUploadType.Direct:
          await this.bitwardenFileUploadService.upload(
            fileName.encryptedString,
            encryptedFileData,
            (fd) => fileUploadMethods.postDirect(fd),
          );
          break;
        case FileUploadType.Azure: {
          await this.azureFileUploadService.upload(
            uploadData.url,
            encryptedFileData,
            fileUploadMethods.renewFileUploadUrl,
          );
          break;
        }
        default:
          throw new Error("Unknown file upload type");
      }
    } catch (e) {
      await fileUploadMethods.rollback();
      throw e;
    }
  }
}
