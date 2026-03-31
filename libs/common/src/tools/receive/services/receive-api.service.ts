import { CreateReceiveRequest } from "../models/requests/create-receive.request";
import { ReceiveSharedDataResponse } from "../models/response/receive-shared-data.response";
import { ReceiveResponse } from "../models/response/receive.response";

export abstract class ReceiveApiService {
  abstract getReceive(id: string): Promise<ReceiveResponse>;

  abstract postReceive(request: CreateReceiveRequest): Promise<ReceiveResponse>;
  abstract putReceive(id: string, request: CreateReceiveRequest): Promise<ReceiveResponse>;
  abstract deleteReceive(id: string): Promise<void>;

  abstract postReceiveAccess(id: string, secret: string): Promise<ReceiveSharedDataResponse>;
}
