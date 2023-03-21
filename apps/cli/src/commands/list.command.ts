import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { Utils } from "@bitwarden/common/misc/utils";
import { CollectionData } from "@bitwarden/common/models/data/collection.data";
import { Collection } from "@bitwarden/common/models/domain/collection";
import {
  CollectionDetailsResponse as ApiCollectionDetailsResponse,
  CollectionResponse as ApiCollectionResponse,
} from "@bitwarden/common/models/response/collection.response";
import { ListResponse as ApiListResponse } from "@bitwarden/common/models/response/list.response";
import { Guid } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { Response } from "../models/response";
import { CollectionResponse } from "../models/response/collection.response";
import { ListResponse } from "../models/response/list.response";
import { OrganizationUserResponse } from "../models/response/organization-user.response";
import { OrganizationResponse } from "../models/response/organization.response";
import { CliUtils } from "../utils";
import { CipherResponse } from "../vault/models/cipher.response";
import { FolderResponse } from "../vault/models/folder.response";

export class ListCommand {
  constructor(
    private cipherService: CipherService,
    private folderService: FolderService,
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private searchService: SearchService,
    private organizationUserService: OrganizationUserService,
    private apiService: ApiService
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
    options.trash = options.trash || false;
    if (options.url != null && options.url.trim() !== "") {
      ciphers = await this.cipherService.getAllDecryptedForUrl(options.url);
    } else {
      ciphers = await this.cipherService.getAllDecrypted();
    }

    if (
      options.folderId != null ||
      options.collectionId != null ||
      options.organizationId != null
    ) {
      ciphers = ciphers.filter((c) => {
        if (options.trash !== c.isDeleted) {
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
      ciphers = ciphers.filter((c) => options.trash === c.isDeleted);
    }

    if (options.search != null && options.search.trim() !== "") {
      ciphers = this.searchService.searchCiphersBasic(ciphers, options.search, options.trash);
    }

    const res = new ListResponse(ciphers.map((o) => new CipherResponse(o)));
    return Response.success(res);
  }

  private async listFolders(options: Options) {
    let folders = await this.folderService.getAllDecryptedFromState();

    if (options.search != null && options.search.trim() !== "") {
      folders = CliUtils.searchFolders(folders, options.search);
    }

    const res = new ListResponse(folders.map((o) => new FolderResponse(o)));
    return Response.success(res);
  }

  private async listCollections(options: Options) {
    let collections = await this.collectionService.getAllDecrypted();

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
    if (options.organizationId == null || options.organizationId === "") {
      return Response.badRequest("`organizationid` option is required.");
    }
    if (!Utils.isGuid(options.organizationId)) {
      return Response.badRequest("`" + options.organizationId + "` is not a GUID.");
    }
    const organization = await this.organizationService.getFromState(options.organizationId);
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
        .map((r) => new Collection(new CollectionData(r as ApiCollectionDetailsResponse)));
      let decCollections = await this.collectionService.decryptMany(collections);
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
    const organization = await this.organizationService.getFromState(options.organizationId);
    if (organization == null) {
      return Response.error("Organization not found.");
    }

    try {
      const response = await this.organizationUserService.getAllUsers(options.organizationId);
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
        })
      );
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  private async listOrganizations(options: Options) {
    let organizations = await this.organizationService.getAll();

    if (options.search != null && options.search.trim() !== "") {
      organizations = CliUtils.searchOrganizations(organizations, options.search);
    }

    const res = new ListResponse(organizations.map((o) => new OrganizationResponse(o)));
    return Response.success(res);
  }
}

class Options {
  organizationId: Guid;
  collectionId: Guid;
  folderId: Guid;
  search: string;
  url: string;
  trash: boolean;

  constructor(passedOptions: Record<string, any>) {
    this.organizationId = passedOptions?.organizationid || passedOptions?.organizationId;
    this.collectionId = passedOptions?.collectionid || passedOptions?.collectionId;
    this.folderId = passedOptions?.folderid || passedOptions?.folderId;
    this.search = passedOptions?.search;
    this.url = passedOptions?.url;
    this.trash = CliUtils.convertBooleanOption(passedOptions?.trash);
  }
}
