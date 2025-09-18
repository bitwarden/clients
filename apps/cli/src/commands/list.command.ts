import { firstValueFrom, map } from "rxjs";

import {
  OrganizationUserApiService,
  CollectionService,
  CollectionData,
  Collection,
  CollectionDetailsResponse as ApiCollectionDetailsResponse,
  CollectionResponse as ApiCollectionResponse,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventType } from "@bitwarden/common/enums";
import { ListResponse as ApiListResponse } from "@bitwarden/common/models/response/list.response";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { KeyService } from "@bitwarden/key-management";
import { CipherArchiveService } from "@bitwarden/vault";

import { CollectionResponse } from "../admin-console/models/response/collection.response";
import { OrganizationUserResponse } from "../admin-console/models/response/organization-user.response";
import { OrganizationResponse } from "../admin-console/models/response/organization.response";
import { Response } from "../models/response";
import { ListResponse } from "../models/response/list.response";
import { CliUtils } from "../utils";
import { CipherResponse } from "../vault/models/cipher.response";
import { FolderResponse } from "../vault/models/folder.response";
import { CliRestrictedItemTypesService } from "../vault/services/cli-restricted-item-types.service";

export class ListCommand {
  constructor(
    private cipherService: CipherService,
    private folderService: FolderService,
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private searchService: SearchService,
    private organizationUserApiService: OrganizationUserApiService,
    private apiService: ApiService,
    private eventCollectionService: EventCollectionService,
    private accountService: AccountService,
    private keyService: KeyService,
    private cliRestrictedItemTypesService: CliRestrictedItemTypesService,
    private cipherArchiveService: CipherArchiveService,
  ) {}

  async run(object: string, cmdOptions: Record<string, any>): Promise<Response> {
    const normalizedOptions = new Options(cmdOptions);
    switch (object.toLowerCase()) {
      case "items":
        return await this.listCiphers(normalizedOptions);
      case "folders":
        return await this.listFolders(normalizedOptions);
      case "collections":
        return await this.listCollections(normalizedOptions);
      case "org-collections":
        return await this.listOrganizationCollections(normalizedOptions);
      case "org-members":
        return await this.listOrganizationMembers(normalizedOptions);
      case "organizations":
        return await this.listOrganizations(normalizedOptions);
      default:
        return Response.badRequest("Unknown object.");
    }
  }

  private async listCiphers(options: Options) {
    let ciphers: CipherView[];

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const userCanArchive = await firstValueFrom(
      this.cipherArchiveService.userCanArchive$(activeUserId),
    );

    options.trash = options.trash || false;
    options.archived = userCanArchive && options.archived;

    if (options.url != null && options.url.trim() !== "") {
      ciphers = await this.cipherService.getAllDecryptedForUrl(options.url, activeUserId);
    } else {
      ciphers = await this.cipherService.getAllDecrypted(activeUserId);
    }

    if (
      options.folderId != null ||
      options.collectionId != null ||
      options.organizationId != null
    ) {
      ciphers = ciphers.filter((c) => {
        const matchesStateOptions = this.matchesStateOptions(c, options);

        if (!matchesStateOptions) {
          return false;
        }

        if (options.folderId != null) {
          if (options.folderId === "notnull" && c.folderId != null) {
            return true;
          }
          const folderId = options.folderId === "null" ? null : options.folderId;
          if (folderId === c.folderId) {
            return true;
          }
        }

        if (options.organizationId != null) {
          if (options.organizationId === "notnull" && c.organizationId != null) {
            return true;
          }
          const organizationId = options.organizationId === "null" ? null : options.organizationId;
          if (organizationId === c.organizationId) {
            return true;
          }
        }

        if (options.collectionId != null) {
          if (
            options.collectionId === "notnull" &&
            c.collectionIds != null &&
            c.collectionIds.length > 0
          ) {
            return true;
          }
          const collectionId = options.collectionId === "null" ? null : options.collectionId;
          if (collectionId == null && (c.collectionIds == null || c.collectionIds.length === 0)) {
            return true;
          }
          if (
            collectionId != null &&
            c.collectionIds != null &&
            c.collectionIds.indexOf(collectionId) > -1
          ) {
            return true;
          }
        }
        return false;
      });
    } else if (options.search == null || options.search.trim() === "") {
      ciphers = ciphers.filter((c) => this.matchesStateOptions(c, options));
    }

    if (options.search != null && options.search.trim() !== "") {
      ciphers = this.searchService.searchCiphersBasic(
        ciphers,
        options.search,
        options.trash,
        options.archived,
      );
    }

    ciphers = await this.cliRestrictedItemTypesService.filterRestrictedCiphers(ciphers);

    await this.eventCollectionService.collectMany(EventType.Cipher_ClientViewed, ciphers, true);

    const res = new ListResponse(ciphers.map((o) => new CipherResponse(o)));
    return Response.success(res);
  }

  private async listFolders(options: Options) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    let folders = await this.folderService.getAllDecryptedFromState(activeUserId);

    if (options.search != null && options.search.trim() !== "") {
      folders = CliUtils.searchFolders(folders, options.search);
    }

    const res = new ListResponse(folders.map((o) => new FolderResponse(o)));
    return Response.success(res);
  }

  private async listCollections(options: Options) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    let collections = await firstValueFrom(
      this.collectionService.decryptedCollections$(activeUserId),
    );

    if (options.organizationId != null) {
      collections = collections.filter((c) => {
        if (options.organizationId === c.organizationId) {
          return true;
        }
        return false;
      });
    }

    if (options.search != null && options.search.trim() !== "") {
      collections = CliUtils.searchCollections(collections, options.search);
    }

    const res = new ListResponse(collections.map((o) => new CollectionResponse(o)));
    return Response.success(res);
  }

  private async listOrganizationCollections(options: Options) {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    if (options.organizationId == null || options.organizationId === "") {
      return Response.badRequest("`organizationid` option is required.");
    }
    if (!Utils.isGuid(options.organizationId)) {
      return Response.badRequest("`" + options.organizationId + "` is not a GUID.");
    }
    if (!userId) {
      return Response.badRequest("No user found.");
    }
    const organization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(map((organizatons) => organizatons.find((o) => o.id == options.organizationId))),
    );
    if (organization == null) {
      return Response.error("Organization not found.");
    }

    try {
      let response: ApiListResponse<ApiCollectionResponse>;
      if (organization.canViewAllCollections) {
        response = await this.apiService.getCollections(options.organizationId);
      } else {
        response = await this.apiService.getUserCollections();
      }
      const collections = response.data
        .filter((c) => c.organizationId === options.organizationId)
        .map((r) =>
          Collection.fromCollectionData(new CollectionData(r as ApiCollectionDetailsResponse)),
        );
      const orgKeys = await firstValueFrom(this.keyService.orgKeys$(userId));
      if (orgKeys == null) {
        throw new Error("Organization keys not found.");
      }
      let decCollections = await firstValueFrom(
        this.collectionService.decryptMany$(collections, orgKeys),
      );
      if (options.search != null && options.search.trim() !== "") {
        decCollections = CliUtils.searchCollections(decCollections, options.search);
      }
      const res = new ListResponse(decCollections.map((o) => new CollectionResponse(o)));
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  private async listOrganizationMembers(options: Options) {
    if (options.organizationId == null || options.organizationId === "") {
      return Response.badRequest("`organizationid` option is required.");
    }
    if (!Utils.isGuid(options.organizationId)) {
      return Response.badRequest("`" + options.organizationId + "` is not a GUID.");
    }
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (!userId) {
      return Response.badRequest("No user found.");
    }
    const organization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(map((organizatons) => organizatons.find((o) => o.id == options.organizationId))),
    );
    if (organization == null) {
      return Response.error("Organization not found.");
    }

    try {
      const response = await this.organizationUserApiService.getAllUsers(options.organizationId);
      const res = new ListResponse(
        response.data.map((r) => {
          const u = new OrganizationUserResponse();
          u.email = r.email;
          u.name = r.name;
          u.id = r.id;
          u.status = r.status;
          u.type = r.type;
          u.twoFactorEnabled = r.twoFactorEnabled;
          return u;
        }),
      );
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  private async listOrganizations(options: Options) {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (!userId) {
      return Response.badRequest("No user found.");
    }
    let organizations = await firstValueFrom(this.organizationService.memberOrganizations$(userId));

    if (options.search != null && options.search.trim() !== "") {
      organizations = CliUtils.searchOrganizations(organizations, options.search);
    }

    const res = new ListResponse(organizations.map((o) => new OrganizationResponse(o)));
    return Response.success(res);
  }

  /**
   * Checks if the cipher passes either the trash or the archive options.
   * @returns true if the cipher passes *any* of the filters
   */
  private matchesStateOptions(c: CipherView, options: Options): boolean {
    const passesTrashFilter = options.trash && c.isDeleted;
    const passesArchivedFilter = options.archived && c.isArchived;

    return passesTrashFilter || passesArchivedFilter;
  }
}

class Options {
  organizationId: string;
  collectionId: string;
  folderId: string;
  search: string;
  url: string;
  trash: boolean;
  archived: boolean;

  constructor(passedOptions: Record<string, any>) {
    this.organizationId = passedOptions?.organizationid || passedOptions?.organizationId;
    this.collectionId = passedOptions?.collectionid || passedOptions?.collectionId;
    this.folderId = passedOptions?.folderid || passedOptions?.folderId;
    this.search = passedOptions?.search;
    this.url = passedOptions?.url;
    this.trash = CliUtils.convertBooleanOption(passedOptions?.trash);
    this.archived = CliUtils.convertBooleanOption(passedOptions?.archived);
  }
}
