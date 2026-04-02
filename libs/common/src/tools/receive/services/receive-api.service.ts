import { CreateReceiveRequest } from "../models/requests/create-receive.request";
import { UpdateReceiveRequest } from "../models/requests/update-receive.request";
import { ReceiveFileDownloadDataResponse } from "../models/response/receive-file-download-data.response";
import { ReceiveFileUploadDataResponse } from "../models/response/receive-file-upload-data.response";
import { ReceiveSharedDataResponse } from "../models/response/receive-shared-data.response";
import { ReceiveResponse } from "../models/response/receive.response";

export abstract class ReceiveApiService {
  abstract getReceive(id: string): Promise<ReceiveResponse>;

  abstract postReceive(request: CreateReceiveRequest): Promise<ReceiveResponse>;
  abstract putReceive(id: string, request: UpdateReceiveRequest): Promise<ReceiveResponse>;
  abstract deleteReceive(id: string): Promise<void>;

  abstract postReceiveAccess(id: string, secret: string): Promise<ReceiveSharedDataResponse>;

  abstract postReceiveFile(
    id: string,
    secret: string,
    request: { fileName: string; fileLength: number; encapsulatedFileContentEncryptionKey: string },
  ): Promise<ReceiveFileUploadDataResponse>;

  abstract postReceiveFileValidation(id: string, fileId: string, secret: string): Promise<void>;

  abstract getReceiveFileDownload(
    id: string,
    fileId: string,
  ): Promise<ReceiveFileDownloadDataResponse>;
}
