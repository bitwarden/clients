import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { AgentConnectionRequest } from "../models/request/agent-connection.request";
import { AgentConnectionResponse } from "../models/response/agent-connection.response";

import { AgentConnectionApiService as AgentConnectionApiServiceAbstraction } from "./agent-connection-api.service.abstraction";

export class AgentConnectionApiService implements AgentConnectionApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  async post(request: AgentConnectionRequest): Promise<AgentConnectionResponse> {
    const result = await this.apiService.send("POST", "/agent-connections", request, true, true);
    return new AgentConnectionResponse(result);
  }

  async getAll(): Promise<ListResponse<AgentConnectionResponse>> {
    const result = await this.apiService.send("GET", "/agent-connections", null, true, true);
    return new ListResponse(result, AgentConnectionResponse);
  }

  async delete(id: string): Promise<void> {
    await this.apiService.send("DELETE", "/agent-connections/" + id, null, true, false);
  }
}
