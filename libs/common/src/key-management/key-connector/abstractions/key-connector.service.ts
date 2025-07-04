import { Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfType } from "@bitwarden/key-management";

import { Organization } from "../../../admin-console/models/domain/organization";
import { UserId } from "../../../types/guid";

export abstract class KeyConnectorService {
  abstract setMasterKeyFromUrl(keyConnectorUrl: string, userId: UserId): Promise<void>;

  abstract getManagingOrganization(userId: UserId): Promise<Organization>;

  abstract getUsesKeyConnector(userId: UserId): Promise<boolean>;

  abstract migrateUser(keyConnectorUrl: string, userId: UserId): Promise<void>;

  abstract convertNewSsoUserToKeyConnector(
    orgId: string,
    userId: UserId,
    keyConnectorUrl: string,
    kdf: KdfType,
    kdfIterations: number,
    kdfMemory?: number,
    kdfParallelism?: number,
  ): Promise<void>;

  abstract setUsesKeyConnector(enabled: boolean, userId: UserId): Promise<void>;

  abstract convertAccountRequired$: Observable<boolean>;
}
