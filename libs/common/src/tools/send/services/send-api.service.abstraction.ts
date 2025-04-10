// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
  getSend: (id: string) => Promise<SendResponse>;
  postSendAccess: (
    id: string,
    request: SendAccessRequest,
    apiUrl?: string,
  ) => Promise<SendAccessResponse>;
  getSends: () => Promise<ListResponse<SendResponse>>;
  postSend: (request: SendRequest) => Promise<SendResponse>;
  postFileTypeSend: (request: SendRequest) => Promise<SendFileUploadDataResponse>;
  postSendFile: (sendId: string, fileId: string, data: FormData) => Promise<any>;
  putSend: (id: string, request: SendRequest) => Promise<SendResponse>;
  putSendRemovePassword: (id: string) => Promise<SendResponse>;
  deleteSend: (id: string) => Promise<any>;
  getSendFileDownloadData: (
    send: SendAccessView,
    request: SendAccessRequest,
    apiUrl?: string,
  ) => Promise<SendFileDownloadDataResponse>;
  renewSendFileUploadUrl: (sendId: string, fileId: string) => Promise<SendFileUploadDataResponse>;
  removePassword: (id: string) => Promise<any>;
  delete: (id: string) => Promise<any>;
  save: (sendData: [Send, EncArrayBuffer]) => Promise<Send>;
}
