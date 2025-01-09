import { Injectable } from "@angular/core";

import { CollectionAdminService, CollectionAdminView } from "@bitwarden/admin-console/common";

import { ImportCollectionServiceAbstraction } from "../../../../../../libs/importer/src/services/import-collection.service.abstraction";

@Injectable()
export class ImportCollectionAdminService implements ImportCollectionServiceAbstraction {
  constructor(private collectionAdminService: CollectionAdminService) {}

  async getAllAdminCollections(organizationId: string): Promise<CollectionAdminView[]> {
    return await this.collectionAdminService.getAll(organizationId);
  }
}
