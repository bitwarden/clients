import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { ConnectedAppRequest } from "../models/request/connected-app.request";
import { ConnectedAppResponse } from "../models/response/connected-app.response";

import { ConnectedAppApiService as ConnectedAppApiServiceAbstraction } from "./connected-app-api.service.abstraction";

export class ConnectedAppApiService implements ConnectedAppApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  async post(request: ConnectedAppRequest): Promise<ConnectedAppResponse> {
    const result = await this.apiService.send("POST", "/connected-apps", request, true, true);
    return new ConnectedAppResponse(result);
  }

  async getAll(): Promise<ListResponse<ConnectedAppResponse>> {
    const result = await this.apiService.send("GET", "/connected-apps", null, true, true);
    return new ListResponse(result, ConnectedAppResponse);
  }

  async delete(id: string): Promise<void> {
    await this.apiService.send("DELETE", "/connected-apps/" + id, null, true, false);
  }
}
