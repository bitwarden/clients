import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionAdminService, CollectionAdminView } from "@bitwarden/admin-console/common";
import { ImportCollectionServiceAbstraction } from "@bitwarden/importer-core";
import { UserId } from "@bitwarden/user-core";

@Injectable()
export class ImportCollectionAdminService implements ImportCollectionServiceAbstraction {
  constructor(private collectionAdminService: CollectionAdminService) {}

  async getAllAdminCollections(
    organizationId: string,
    userId: UserId,
  ): Promise<CollectionAdminView[]> {
    return await firstValueFrom(
      this.collectionAdminService.collectionAdminViews$(organizationId, userId),
    );
  }
}
