import { Injectable } from "@angular/core";
import { combineLatest, firstValueFrom, from, map, switchMap } from "rxjs";

import {
  Collection,
  CollectionData,
  CollectionDetailsResponse,
  CollectionService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { KeyService } from "@bitwarden/key-management";

import { GroupApiService } from "../../../core";
import { OrganizationUserView } from "../../../core/views/organization-user.view";

@Injectable()
export class OrganizationMembersService {
  constructor(
    private organizationUserApiService: OrganizationUserApiService,
    private groupService: GroupApiService,
    private apiService: ApiService,
    private keyService: KeyService,
    private accountService: AccountService,
    private collectionService: CollectionService,
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
    const collections$ = from(this.apiService.getCollections(organization.id)).pipe(
      map((response) => {
        return response.data.map((r) =>
          Collection.fromCollectionData(new CollectionData(r as CollectionDetailsResponse)),
        );
      }),
    );

    const orgKey$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.keyService.orgKeys$(userId)),
      map((orgKeys) => {
        if (orgKeys == null) {
          throw new Error("Organization keys not found for provided User.");
        }
        return orgKeys;
      }),
    );

    return await firstValueFrom(
      combineLatest([orgKey$, collections$]).pipe(
        switchMap(([orgKey, collections]) =>
          this.collectionService.decryptMany$(collections, orgKey),
        ),
        map((decryptedCollections) => {
          const collectionMap: Map<string, string> = new Map<string, string>();
          decryptedCollections.forEach((c) => {
            collectionMap.set(c.id, c.name);
          });
          return collectionMap;
        }),
      ),
    );
  }
}
