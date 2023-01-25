import { IdentityTokenResponse } from "../auth/models/response/identity-token.response";
import { Organization } from "../models/domain/organization";

export abstract class KeyConnectorService {
  getAndSetKey: (url?: string) => Promise<void>;
  getManagingOrganization: () => Promise<Organization>;
  getUsesKeyConnector: () => Promise<boolean>;
  migrateUser: () => Promise<void>;
  userNeedsMigration: () => Promise<boolean>;
  convertNewSsoUserToKeyConnector: (
    tokenResponse: IdentityTokenResponse,
    orgId: string
  ) => Promise<void>;
  setUsesKeyConnector: (enabled: boolean) => Promise<void>;
  setConvertAccountRequired: (status: boolean) => Promise<void>;
  getConvertAccountRequired: () => Promise<boolean>;
  removeConvertAccountRequired: () => Promise<void>;
  clear: () => Promise<void>;
}
