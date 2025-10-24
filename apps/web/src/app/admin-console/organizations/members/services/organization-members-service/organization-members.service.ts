import { Injectable } from "@angular/core";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { GroupApiService } from "../../../core";
import { OrganizationUserView } from "../../../core/views/organization-user.view";

@Injectable()
export class OrganizationMembersService {
  constructor(
    private organizationUserApiService: OrganizationUserApiService,
    private groupService: GroupApiService,
    private apiService: ApiService,
  ) {}

  async loadUsers(organization: Organization): Promise<OrganizationUserView[]> {
    let groupsPromise: Promise<Map<string, string>> | undefined;
    let collectionsPromise: Promise<Map<string, string>> | undefined;

    const userPromise = this.organizationUserApiService.getAllUsers(organization.id, {
      includeGroups: organization.useGroups,
      includeCollections: !organization.useGroups,
    });

    if (organization.useGroups) {
      groupsPromise = this.getGroupNameMap(organization);
    } else {
      collectionsPromise = this.getCollectionNameMap(organization);
    }

    const [usersResponse, groupNamesMap, collectionNamesMap] = await Promise.all([
      userPromise,
      groupsPromise,
      collectionsPromise,
    ]);

    return (
      usersResponse.data?.map<OrganizationUserView>((r) => {
        const userView = OrganizationUserView.fromResponse(r);

        userView.groupNames = userView.groups
          .map((g: string) => groupNamesMap?.get(g))
          .filter((name): name is string => name != null)
          .sort();
        userView.collectionNames = userView.collections
          .map((c: { id: string }) => collectionNamesMap?.get(c.id))
          .filter((name): name is string => name != null)
          .sort();

        return userView;
      }) ?? []
    );
  }

  private async getGroupNameMap(organization: Organization): Promise<Map<string, string>> {
    const groups = await this.groupService.getAll(organization.id);
    const groupNameMap = new Map<string, string>();
    groups.forEach((g: { id: string; name: string }) => groupNameMap.set(g.id, g.name));
    return groupNameMap;
  }

  private async getCollectionNameMap(organization: Organization): Promise<Map<string, string>> {
    const response = this.apiService
      .getCollections(organization.id)
      .then((res) =>
        res.data.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })),
      );

    const collections = await response;
    const collectionMap = new Map<string, string>();
    collections.forEach((c: { id: string; name: string }) => collectionMap.set(c.id, c.name));
    return collectionMap;
  }
}
