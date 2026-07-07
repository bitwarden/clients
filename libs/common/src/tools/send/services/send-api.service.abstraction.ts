import { SendAccessToken } from "../../../auth/send-access";
import { ListResponse } from "../../../models/response/list.response";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { Send } from "../models/domain/send";
import { SendAccessRequest } from "../models/request/send-access.request";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";

export abstract class SendApiService {
  abstract getSend(id: string): Promise<SendResponse>;
  abstract postSendAccess(
    id: string,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendAccessResponse>;
  abstract postSendAccessV2(
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendAccessResponse>;
  abstract getSends(): Promise<ListResponse<SendResponse>>;
  abstract putSendRemovePassword(id: string): Promise<SendResponse>;
  abstract deleteSend(id: string): Promise<any>;
  abstract getSendFileDownloadData(
    send: SendAccessView,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse>;
  abstract getSendFileDownloadDataV2(
    send: SendAccessView,
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse>;
  abstract removePassword(id: string): Promise<any>;
  abstract delete(id: string): Promise<any>;
  abstract save(sendData: [Send, EncArrayBuffer]): Promise<Send>;
}
