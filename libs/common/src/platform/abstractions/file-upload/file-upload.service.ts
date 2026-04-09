import { EncString } from "../../../key-management/crypto/models/enc-string";
import { FileUploadType } from "../../enums";
import { EncArrayBuffer } from "../../models/domain/enc-array-buffer";

export abstract class FileUploadService {
  abstract upload(
    uploadData: { url: string; fileUploadType: FileUploadType },
    fileName: EncString,
    encryptedFileData: EncArrayBuffer,
    fileUploadMethods: FileUploadApiMethods,
    options?: UploadOptions,
  ): Promise<void>;
}

export type FileUploadApiMethods = {
  postDirect: (fileData: FormData) => Promise<void>;
  renewFileUploadUrl: () => Promise<string>;
  rollback: () => Promise<void>;
};

/** Options for file uploads */
export type UploadOptions = {
  /** Callback function to receive upload progress updates as a percentage (0-100) for uploads. */
  onProgress?: (percent: number) => void;
};
