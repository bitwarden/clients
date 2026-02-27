// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type AdminAuthRequestStorable = {
  id: string;
  privateKey: string;
};

type ExpectedAccountType = {
  adminAuthRequest?: AdminAuthRequestStorable;
  settings?: {
    approveLoginRequests?: boolean;
  };
};

const ADMIN_AUTH_REQUEST_KEY: KeyDefinitionLike = {
  stateDefinition: {
    name: "authRequestLocal",
  },
  key: "adminAuthRequest",
};

const ACCEPT_AUTH_REQUESTS_KEY: KeyDefinitionLike = {
  stateDefinition: {
    name: "authRequestLocal",
  },
  key: "acceptAuthRequests",
};

export class AuthRequestMigrator extends Migrator<55, 56> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      let updatedAccount = false;

      // Migrate admin auth request
      const existingAdminAuthRequest = account?.adminAuthRequest;

      if (existingAdminAuthRequest != null) {
        await helper.setToUser(userId, ADMIN_AUTH_REQUEST_KEY, existingAdminAuthRequest);
        delete account.adminAuthRequest;
        updatedAccount = true;
      }

      // Migrate approve login requests
      const existingApproveLoginRequests = account?.settings?.approveLoginRequests;

      if (existingApproveLoginRequests != null) {
        await helper.setToUser(userId, ACCEPT_AUTH_REQUESTS_KEY, existingApproveLoginRequests);
        delete account.settings.approveLoginRequests;
        updatedAccount = true;
      }

      if (updatedAccount) {
        // Save the migrated account
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      let updatedAccount = false;
      // Rollback admin auth request
      const migratedAdminAuthRequest: AdminAuthRequestStorable = await helper.getFromUser(
        userId,
        ADMIN_AUTH_REQUEST_KEY,
      );

      if (migratedAdminAuthRequest != null) {
        account.adminAuthRequest = migratedAdminAuthRequest;
        updatedAccount = true;
      }

      await helper.setToUser(userId, ADMIN_AUTH_REQUEST_KEY, null);

      // Rollback approve login requests
      const migratedAcceptAuthRequest: boolean = await helper.getFromUser(
        userId,
        ACCEPT_AUTH_REQUESTS_KEY,
      );

      if (migratedAcceptAuthRequest != null) {
        account.settings = Object.assign(account.settings ?? {}, {
          approveLoginRequests: migratedAcceptAuthRequest,
        });
        updatedAccount = true;
      }

      await helper.setToUser(userId, ACCEPT_AUTH_REQUESTS_KEY, null);

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
