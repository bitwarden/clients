import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

type ExpectedAccountType = NonNullable<unknown>;

export const userEncryptedPrivateKey: KeyDefinitionLike = {
  key: "privateKey",
  stateDefinition: {
    name: "CRYPTO_DISK",
  },
};

export const userKeyEncryptedSigningKey: KeyDefinitionLike = {
  key: "userSigningKey",
  stateDefinition: {
    name: "CRYPTO_DISK",
  },
};

export const userSignedPublicKey: KeyDefinitionLike = {
  key: "userSignedPublicKey",
  stateDefinition: {
    name: "CRYPTO_DISK",
  },
};

export const accountSecurityState: KeyDefinitionLike = {
  key: "accountSecurityState",
  stateDefinition: {
    name: "CRYPTO_DISK",
  },
};

export class RemoveUserEncryptedPrivateKey extends Migrator<74, 75> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      // Remove privateKey
      const key = await helper.getFromUser(userId, userEncryptedPrivateKey);
      if (key != null) {
        await helper.removeFromUser(userId, userEncryptedPrivateKey);
      }
      // Remove userSigningKey
      const signingKey = await helper.getFromUser(userId, userKeyEncryptedSigningKey);
      if (signingKey != null) {
        await helper.removeFromUser(userId, userKeyEncryptedSigningKey);
      }
      // Remove userSignedPublicKey
      const signedPubKey = await helper.getFromUser(userId, userSignedPublicKey);
      if (signedPubKey != null) {
        await helper.removeFromUser(userId, userSignedPublicKey);
      }
      // Remove accountSecurityState
      const accountSecurity = await helper.getFromUser(userId, accountSecurityState);
      if (accountSecurity != null) {
        await helper.removeFromUser(userId, accountSecurityState);
      }
    }
    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
