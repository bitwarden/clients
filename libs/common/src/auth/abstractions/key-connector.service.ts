import { Organization } from "../../admin-console/models/domain/organization";
import { IdentityTokenResponse } from "../models/response/identity-token.response";

export abstract class KeyConnectorService {
  setMasterKeyFromUrl: (url?: string) => Promise<void>;
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
