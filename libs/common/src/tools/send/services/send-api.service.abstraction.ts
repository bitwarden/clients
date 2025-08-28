import { ListResponse } from "../../../models/response/list.response";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { Send } from "../models/domain/send";
import { SendAccessRequest } from "../models/request/send-access.request";
import { SendRequest } from "../models/request/send.request";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendFileUploadDataResponse } from "../models/response/send-file-upload-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";

export abstract class SendApiService {
  abstract getSend(id: string): Promise<SendResponse>;
  abstract postSendAccess(
    id: string,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendAccessResponse>;
  abstract getSends(): Promise<ListResponse<SendResponse>>;
  abstract postSend(request: SendRequest): Promise<SendResponse>;
  abstract postFileTypeSend(request: SendRequest): Promise<SendFileUploadDataResponse>;
  abstract postSendFile(sendId: string, fileId: string, data: FormData): Promise<any>;
  abstract putSend(id: string, request: SendRequest): Promise<SendResponse>;
  abstract putSendRemovePassword(id: string): Promise<SendResponse>;
  abstract deleteSend(id: string): Promise<any>;
  abstract getSendFileDownloadData(
    send: SendAccessView,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse>;
  abstract renewSendFileUploadUrl(
    sendId: string,
    fileId: string,
  ): Promise<SendFileUploadDataResponse>;
  abstract removePassword(id: string): Promise<any>;
  abstract delete(id: string): Promise<any>;
  abstract save(sendData: [Send, EncArrayBuffer]): Promise<Send>;
}
