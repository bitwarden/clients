// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

// Local declarations of `OrganizationData` and the types of it's properties.
// Duplicated to remain frozen in time when migration occurs.
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum OrganizationUserStatusType {
  Invited = 0,
  Accepted = 1,
  Confirmed = 2,
  Revoked = -1,
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum OrganizationUserType {
  Owner = 0,
  Admin = 1,
  User = 2,
  Manager = 3,
  Custom = 4,
}

type PermissionsApi = {
  accessEventLogs: boolean;
  accessImportExport: boolean;
  accessReports: boolean;
  createNewCollections: boolean;
  editAnyCollection: boolean;
  deleteAnyCollection: boolean;
  editAssignedCollections: boolean;
  deleteAssignedCollections: boolean;
  manageCiphers: boolean;
  manageGroups: boolean;
  manageSso: boolean;
  managePolicies: boolean;
  manageUsers: boolean;
  manageResetPassword: boolean;
  manageScim: boolean;
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum ProviderType {
  Msp = 0,
  Reseller = 1,
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum ProductType {
  Free = 0,
  Families = 1,
  Teams = 2,
  Enterprise = 3,
  TeamsStarter = 4,
}

type OrganizationData = {
  id: string;
  name: string;
  status: OrganizationUserStatusType;
  type: OrganizationUserType;
  enabled: boolean;
  usePolicies: boolean;
  useGroups: boolean;
  useDirectory: boolean;
  useEvents: boolean;
  useTotp: boolean;
  use2fa: boolean;
  useApi: boolean;
  useSso: boolean;
  useKeyConnector: boolean;
  useScim: boolean;
  useCustomPermissions: boolean;
  useResetPassword: boolean;
  useSecretsManager: boolean;
  usePasswordManager: boolean;
  useActivateAutofillPolicy: boolean;
  selfHost: boolean;
  usersGetPremium: boolean;
  seats: number;
  maxCollections: number;
  maxStorageGb?: number;
  ssoBound: boolean;
  identifier: string;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean;
  userId: string;
  hasPublicAndPrivateKeys: boolean;
  providerId: string;
  providerName: string;
  providerType?: ProviderType;
  isProviderUser: boolean;
  isMember: boolean;
  familySponsorshipFriendlyName: string;
  familySponsorshipAvailable: boolean;
  planProductType: ProductType;
  keyConnectorEnabled: boolean;
  keyConnectorUrl: string;
  familySponsorshipLastSyncDate?: Date;
  familySponsorshipValidUntil?: Date;
  familySponsorshipToDelete?: boolean;
  accessSecretsManager: boolean;
  limitCollectionCreationDeletion: boolean;
  allowAdminAccessToAllCollectionItems: boolean;
  flexibleCollections: boolean;
};

type ExpectedAccountType = {
  data?: {
    organizations?: Record<string, Jsonify<OrganizationData>>;
  };
};

const USER_ORGANIZATIONS: KeyDefinitionLike = {
  key: "organizations",
  stateDefinition: {
    name: "organizations",
  },
};

export class OrganizationMigrator extends Migrator<39, 40> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.data?.organizations;
      if (value != null) {
        await helper.setToUser(userId, USER_ORGANIZATIONS, value);
        delete account.data.organizations;
        await helper.set(userId, account);
      }
    }

    await Promise.all(accounts.map(({ userId, account }) => migrateAccount(userId, account)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser(userId, USER_ORGANIZATIONS);
      if (account) {
        account.data = Object.assign(account.data ?? {}, {
          organizations: value,
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, USER_ORGANIZATIONS, null);
    }

    await Promise.all(accounts.map(({ userId, account }) => rollbackAccount(userId, account)));
  }
}
