// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Organization } from "../../admin-console/models/domain/organization";
import { UserId } from "../../types/guid";
import { IdentityTokenResponse } from "../models/response/identity-token.response";

export abstract class KeyConnectorService {
  setMasterKeyFromUrl: (url: string, userId: UserId) => Promise<void>;
  getManagingOrganization: (userId?: UserId) => Promise<Organization>;
  getUsesKeyConnector: (userId: UserId) => Promise<boolean>;
  migrateUser: (userId?: UserId) => Promise<void>;
  userNeedsMigration: (userId: UserId) => Promise<boolean>;
  convertNewSsoUserToKeyConnector: (
    tokenResponse: IdentityTokenResponse,
    orgId: string,
    userId: UserId,
  ) => Promise<void>;
  setUsesKeyConnector: (enabled: boolean, userId: UserId) => Promise<void>;
  setConvertAccountRequired: (status: boolean, userId?: UserId) => Promise<void>;
  getConvertAccountRequired: () => Promise<boolean>;
  removeConvertAccountRequired: (userId?: UserId) => Promise<void>;
}
