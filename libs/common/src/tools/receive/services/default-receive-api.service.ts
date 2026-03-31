import { ApiService } from "../../../abstractions/api.service";
import { CreateReceiveRequest } from "../models/requests/create-receive.request";
import { UpdateReceiveRequest } from "../models/requests/update-receive.request";
import { ReceiveSharedDataResponse } from "../models/response/receive-shared-data.response";
import { ReceiveResponse } from "../models/response/receive.response";

import { ReceiveApiService } from "./receive-api.service";

export class DefaultReceiveApiService implements ReceiveApiService {
  constructor(private apiService: ApiService) {}

  async getReceive(id: string): Promise<ReceiveResponse> {
    const r = await this.apiService.send("GET", "/receives/" + id, null, true, true);
    return new ReceiveResponse(r);
  }

  async postReceive(request: CreateReceiveRequest): Promise<ReceiveResponse> {
    const r = await this.apiService.send("POST", "/receives", request, true, true);
    return new ReceiveResponse(r);
  }

  async putReceive(id: string, request: UpdateReceiveRequest): Promise<ReceiveResponse> {
    const r = await this.apiService.send("PUT", "/receives/" + id, request, true, true);
    return new ReceiveResponse(r);
  }

  async deleteReceive(id: string): Promise<void> {
    await this.apiService.send("DELETE", "/receives/" + id, null, true, false);
  }

  async postReceiveAccess(id: string, secret: string): Promise<ReceiveSharedDataResponse> {
    const addSecretHeader = (headers: Headers) => {
      headers.set("Receive-Secret", secret);
    };
    const r = await this.apiService.send(
      "GET",
      "/receives/" + id + "/shared",
      null,
      false,
      true,
      undefined,
      addSecretHeader,
    );
    return new ReceiveSharedDataResponse(r);
  }
}
