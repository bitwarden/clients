import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
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
