// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer, EncString } from "@bitwarden/legacy-crypto";

import { UploadOptions } from "../../../platform/abstractions/file-upload/file-upload.service";
import { FileUploadType } from "../../../platform/enums";
import { UserId } from "../../../types/guid";

export abstract class CipherFileUploadService {
  /**
   * Pushes pre-encrypted bytes to an attachment slot that was already opened via the SDK.
   */
  abstract uploadPrepared(
    cipherId: string,
    attachmentId: string,
    uploadUrl: string,
    fileUploadType: FileUploadType,
    encFileName: EncString,
    encData: EncArrayBuffer,
    userId: UserId,
    isAdmin: boolean,
    options?: UploadOptions,
  ): Promise<void>;
}
