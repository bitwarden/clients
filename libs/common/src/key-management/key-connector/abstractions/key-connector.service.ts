import { Observable } from "rxjs";

import { Organization } from "../../../admin-console/models/domain/organization";
import { IdentityTokenResponse } from "../../../auth/models/response/identity-token.response";
import { UserId } from "../../../types/guid";

export abstract class KeyConnectorService {
  abstract setMasterKeyFromUrl(keyConnectorUrl: string, userId: UserId): Promise<void>;

  abstract getManagingOrganization(userId: UserId): Promise<Organization>;

  abstract getUsesKeyConnector(userId: UserId): Promise<boolean>;

  abstract migrateUser(keyConnectorUrl: string, userId: UserId): Promise<void>;

  abstract convertNewSsoUserToKeyConnector(
    tokenResponse: IdentityTokenResponse,
    orgId: string,
    userId: UserId,
  ): Promise<void>;

  abstract setUsesKeyConnector(enabled: boolean, userId: UserId): Promise<void>;

  abstract convertAccountRequired$: Observable<boolean>;
}
