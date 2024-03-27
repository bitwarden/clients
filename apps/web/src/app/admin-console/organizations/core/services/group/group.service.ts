import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { CoreOrganizationModule } from "../../core-organization.module";
import { GroupView } from "../../views/group.view";

import { GroupRequest } from "./requests/group.request";
import { OrganizationGroupBulkRequest } from "./requests/organization-group-bulk.request";
import { GroupDetailsResponse, GroupResponse } from "./responses/group.response";

@Injectable({
  providedIn: "root",
})
export class GroupService {
  constructor(
    protected apiService: ApiService,
    protected configService: ConfigService,
  ) {}

  async get(orgId: string, groupId: string): Promise<GroupView> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + orgId + "/groups/" + groupId + "/details",
      null,
      true,
      true,
    );

    return GroupView.fromResponse(new GroupDetailsResponse(r));
  }

  async getAll(orgId: string): Promise<GroupView[]> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + orgId + "/groups",
      null,
      true,
      true,
    );

    const listResponse = new ListResponse(r, GroupDetailsResponse);

    return Promise.all(listResponse.data?.map((gr) => GroupView.fromResponse(gr))) ?? [];
  }
}

@Injectable({ providedIn: CoreOrganizationModule })
export class InternalGroupService extends GroupService {
  constructor(
    protected apiService: ApiService,
    protected configService: ConfigService,
  ) {
    super(apiService, configService);
  }

  async delete(orgId: string, groupId: string): Promise<void> {
    await this.apiService.send(
      "DELETE",
      "/organizations/" + orgId + "/groups/" + groupId,
      null,
      true,
      false,
    );
  }

  async deleteMany(orgId: string, groupIds: string[]): Promise<void> {
    await this.apiService.send(
      "DELETE",
      "/organizations/" + orgId + "/groups",
      new OrganizationGroupBulkRequest(groupIds),
      true,
      true,
    );
  }

  async save(group: GroupView): Promise<GroupView> {
    const request = new GroupRequest();
    request.name = group.name;
    request.accessAll = group.accessAll;
    request.users = group.members;
    request.collections = group.collections.map(
      (c) => new SelectionReadOnlyRequest(c.id, c.readOnly, c.hidePasswords, c.manage),
    );

    if (group.id == undefined) {
      return await this.postGroup(group.organizationId, request);
    } else {
      return await this.putGroup(group.organizationId, group.id, request);
    }
  }

  private async postGroup(organizationId: string, request: GroupRequest): Promise<GroupView> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/groups",
      request,
      true,
      true,
    );
    return GroupView.fromResponse(new GroupResponse(r));
  }

  private async putGroup(
    organizationId: string,
    id: string,
    request: GroupRequest,
  ): Promise<GroupView> {
    const r = await this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/groups/" + id,
      request,
      true,
      true,
    );
    return GroupView.fromResponse(new GroupResponse(r));
  }
}
