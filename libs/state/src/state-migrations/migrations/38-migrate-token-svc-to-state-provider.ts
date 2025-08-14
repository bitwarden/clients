// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

// Types to represent data as it is stored in JSON
type ExpectedAccountType = {
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
  profile?: {
    apiKeyClientId?: string;
    email?: string;
  };
  keys?: {
    apiKeyClientSecret?: string;
  };
};

type ExpectedGlobalType = {
  twoFactorToken?: string;
};

export const EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL: KeyDefinitionLike = {
  key: "emailTwoFactorTokenRecord",
  stateDefinition: {
    name: "tokenDiskLocal",
  },
};

const TOKEN_STATE_DEF_LIKE: StateDefinitionLike = {
  name: "token",
};

export const ACCESS_TOKEN_DISK: KeyDefinitionLike = {
  key: "accessToken", // matches KeyDefinition.key
  stateDefinition: TOKEN_STATE_DEF_LIKE,
};

export const REFRESH_TOKEN_DISK: KeyDefinitionLike = {
  key: "refreshToken",
  stateDefinition: TOKEN_STATE_DEF_LIKE,
};

export const API_KEY_CLIENT_ID_DISK: KeyDefinitionLike = {
  key: "apiKeyClientId",
  stateDefinition: TOKEN_STATE_DEF_LIKE,
};

export const API_KEY_CLIENT_SECRET_DISK: KeyDefinitionLike = {
  key: "apiKeyClientSecret",
  stateDefinition: TOKEN_STATE_DEF_LIKE,
};

export class TokenServiceStateProviderMigrator extends Migrator<37, 38> {
  async migrate(helper: MigrationHelper): Promise<void> {
    // Move global data
    const globalData = await helper.get<ExpectedGlobalType>("global");

    // Create new global record for 2FA token that we can accumulate data in
    const emailTwoFactorTokenRecord = {};

    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(
      userId: string,
      account: ExpectedAccountType | undefined,
      globalTwoFactorToken: string | undefined,
      emailTwoFactorTokenRecord: Record<string, string>,
    ): Promise<void> {
      let updatedAccount = false;

      // migrate 2FA token from global to user state
      // Due to the existing implmentation, n users on the same device share the same global state value for 2FA token.
      // So, we will just migrate it to all users to keep it valid for whichever was the user that set it previously.
      // Note: don't bother migrating 2FA Token if user account or email is undefined
      const email = account?.profile?.email;
      if (globalTwoFactorToken != undefined && account != undefined && email != undefined) {
        emailTwoFactorTokenRecord[email] = globalTwoFactorToken;
        // Note: don't set updatedAccount to true here as we aren't updating
        // the legacy user state, just migrating a global state to a new user state
      }

      // Migrate access token
      const existingAccessToken = account?.tokens?.accessToken;

      if (existingAccessToken != null) {
        // Only migrate data that exists
        if (helper.type !== "web-disk-local") {
          // only migrate access token to session storage - never local.
          await helper.setToUser(userId, ACCESS_TOKEN_DISK, existingAccessToken);
        }
        delete account.tokens.accessToken;
        updatedAccount = true;
      }

      // Migrate refresh token
      const existingRefreshToken = account?.tokens?.refreshToken;

      if (existingRefreshToken != null) {
        if (helper.type !== "web-disk-local") {
          // only migrate refresh token to session storage - never local.
          await helper.setToUser(userId, REFRESH_TOKEN_DISK, existingRefreshToken);
        }
        delete account.tokens.refreshToken;
        updatedAccount = true;
      }

      // Migrate API key client id
      const existingApiKeyClientId = account?.profile?.apiKeyClientId;

      if (existingApiKeyClientId != null) {
        if (helper.type !== "web-disk-local") {
          // only migrate client id to session storage - never local.
          await helper.setToUser(userId, API_KEY_CLIENT_ID_DISK, existingApiKeyClientId);
        }
        delete account.profile.apiKeyClientId;
        updatedAccount = true;
      }

      // Migrate API key client secret
      const existingApiKeyClientSecret = account?.keys?.apiKeyClientSecret;
      if (existingApiKeyClientSecret != null) {
        if (helper.type !== "web-disk-local") {
          // only migrate client secret to session storage - never local.
          await helper.setToUser(userId, API_KEY_CLIENT_SECRET_DISK, existingApiKeyClientSecret);
        }
        delete account.keys.apiKeyClientSecret;
        updatedAccount = true;
      }

      if (updatedAccount) {
        // Save the migrated account only if it was updated
        await helper.set(userId, account);
      }
    }

    await Promise.all([
      ...accounts.map(({ userId, account }) =>
        migrateAccount(userId, account, globalData?.twoFactorToken, emailTwoFactorTokenRecord),
      ),
    ]);

    // Save the global 2FA token record
    await helper.setToGlobal(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL, emailTwoFactorTokenRecord);

    // Delete global data
    delete globalData?.twoFactorToken;
    await helper.set("global", globalData);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    // Since we migrated the global 2FA token to all users, we need to rollback the 2FA token for all users
    // but we only need to set it to the global state once

    // Go through accounts and find the first user that has a non-null email and 2FA token
    let migratedTwoFactorToken: string | null = null;
    for (const { account } of accounts) {
      const email = account?.profile?.email;
      if (email == null) {
        continue;
      }
      const emailTwoFactorTokenRecord: Record<string, string> = await helper.getFromGlobal(
        EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
      );

      migratedTwoFactorToken = emailTwoFactorTokenRecord[email];

      if (migratedTwoFactorToken != null) {
        break;
      }
    }

    if (migratedTwoFactorToken != null) {
      let legacyGlobal = await helper.get<ExpectedGlobalType>("global");
      if (!legacyGlobal) {
        legacyGlobal = {};
      }
      legacyGlobal.twoFactorToken = migratedTwoFactorToken;
      await helper.set("global", legacyGlobal);
    }

    // delete global 2FA token record
    await helper.setToGlobal(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL, null);

    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      let updatedLegacyAccount = false;

      // Rollback access token
      const migratedAccessToken = await helper.getFromUser<string>(userId, ACCESS_TOKEN_DISK);

      if (account?.tokens && migratedAccessToken != null) {
        account.tokens.accessToken = migratedAccessToken;
        updatedLegacyAccount = true;
      }

      await helper.setToUser(userId, ACCESS_TOKEN_DISK, null);

      // Rollback refresh token
      const migratedRefreshToken = await helper.getFromUser<string>(userId, REFRESH_TOKEN_DISK);

      if (account?.tokens && migratedRefreshToken != null) {
        account.tokens.refreshToken = migratedRefreshToken;
        updatedLegacyAccount = true;
      }

      await helper.setToUser(userId, REFRESH_TOKEN_DISK, null);

      // Rollback API key client id

      const migratedApiKeyClientId = await helper.getFromUser<string>(
        userId,
        API_KEY_CLIENT_ID_DISK,
      );

      if (account?.profile && migratedApiKeyClientId != null) {
        account.profile.apiKeyClientId = migratedApiKeyClientId;
        updatedLegacyAccount = true;
      }

      await helper.setToUser(userId, API_KEY_CLIENT_ID_DISK, null);

      // Rollback API key client secret
      const migratedApiKeyClientSecret = await helper.getFromUser<string>(
        userId,
        API_KEY_CLIENT_SECRET_DISK,
      );

      if (account?.keys && migratedApiKeyClientSecret != null) {
        account.keys.apiKeyClientSecret = migratedApiKeyClientSecret;
        updatedLegacyAccount = true;
      }

      await helper.setToUser(userId, API_KEY_CLIENT_SECRET_DISK, null);

      if (updatedLegacyAccount) {
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
