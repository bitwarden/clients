import { Observable } from "rxjs";

import { Organization } from "../../../admin-console/models/domain/organization";
import { UserId } from "../../../types/guid";
import { KeyConnectorDomainConfirmation } from "../models/key-connector-domain-confirmation";
import { NewSsoUserKeyConnectorConversion } from "../models/new-sso-user-key-connector-conversion";

export abstract class KeyConnectorService {
  abstract setMasterKeyFromUrl(keyConnectorUrl: string, userId: UserId): Promise<void>;

  abstract getManagingOrganization(userId: UserId): Promise<Organization>;

  abstract getUsesKeyConnector(userId: UserId): Promise<boolean>;

  abstract migrateUser(keyConnectorUrl: string, userId: UserId): Promise<void>;

  abstract convertNewSsoUserToKeyConnector(userId: UserId): Promise<void>;

  abstract setUsesKeyConnector(enabled: boolean, userId: UserId): Promise<void>;

  abstract setNewSsoUserKeyConnectorConversionData(
    conversion: NewSsoUserKeyConnectorConversion,
    userId: UserId,
  ): Promise<void>;

  abstract requiresDomainConfirmation$(
    userId: UserId,
  ): Observable<KeyConnectorDomainConfirmation | null>;

  abstract convertAccountRequired$: Observable<boolean>;
}
