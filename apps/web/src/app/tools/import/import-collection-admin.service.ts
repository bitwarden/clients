import { Injectable } from "@angular/core";

import { CollectionAdminService, CollectionAdminView } from "@bitwarden/admin-console/common";
import { ImportCollectionServiceAbstraction } from "@bitwarden/importer-core";

@Injectable()
export class ImportCollectionAdminService implements ImportCollectionServiceAbstraction {
  constructor(private collectionAdminService: CollectionAdminService) {}

  async getAllAdminCollections(organizationId: string): Promise<CollectionAdminView[]> {
    return await this.collectionAdminService.getAll(organizationId);
  }
}
