import { EncArrayBuffer } from "../../../../../key-management/src/cryptography/domain/enc-array-buffer";
import { EncString } from "../../../../../key-management/src/cryptography/domain/enc-string";
import { FileUploadType } from "../../enums";

export abstract class FileUploadService {
  abstract upload(
    uploadData: { url: string; fileUploadType: FileUploadType },
    fileName: EncString,
    encryptedFileData: EncArrayBuffer,
    fileUploadMethods: FileUploadApiMethods,
  ): Promise<void>;
}

export type FileUploadApiMethods = {
  postDirect: (fileData: FormData) => Promise<void>;
  renewFileUploadUrl: () => Promise<string>;
  rollback: () => Promise<void>;
};
