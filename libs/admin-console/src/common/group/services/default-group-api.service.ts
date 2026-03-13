import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { GroupApiService } from "../abstractions";
import { GroupDetailsResponse, GroupResponse } from "../models/responses";

export class DefaultGroupApiService implements GroupApiService {
  constructor(private apiService: ApiService) {}

  async getAll(organizationId: string): Promise<ListResponse<GroupResponse>> {
    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/groups`,
      null,
      true,
      true,
    );
    return new ListResponse(r, GroupResponse);
  }

  async getAllDetails(organizationId: string): Promise<ListResponse<GroupDetailsResponse>> {
    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/groups/details`,
      null,
      true,
      true,
    );
    return new ListResponse(r, GroupDetailsResponse);
  }

  async get(organizationId: string, groupId: string): Promise<GroupDetailsResponse> {
    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/groups/${groupId}/details`,
      null,
      true,
      true,
    );
    return new GroupDetailsResponse(r);
  }

  async getUsers(organizationId: string, groupId: string): Promise<string[]> {
    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/groups/${groupId}/users`,
      null,
      true,
      true,
    );
    return r;
  }
}
