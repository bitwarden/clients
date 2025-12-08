// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum KdfType {
  PBKDF2_SHA256 = 0,
  Argon2id = 1,
}

class KdfConfig {
  iterations: number;
  kdfType: KdfType;
  memory?: number;
  parallelism?: number;
}

type ExpectedAccountType = {
  profile?: {
    kdfIterations: number;
    kdfType: KdfType;
    kdfMemory?: number;
    kdfParallelism?: number;
  };
};

const kdfConfigKeyDefinition: KeyDefinitionLike = {
  key: "kdfConfig",
  stateDefinition: {
    name: "kdfConfig",
  },
};

export class KdfConfigMigrator extends Migrator<58, 59> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const iterations = account?.profile?.kdfIterations;
      const kdfType = account?.profile?.kdfType;
      const memory = account?.profile?.kdfMemory;
      const parallelism = account?.profile?.kdfParallelism;

      const kdfConfig: KdfConfig = {
        iterations: iterations,
        kdfType: kdfType,
        memory: memory,
        parallelism: parallelism,
      };

      if (kdfConfig != null) {
        await helper.setToUser(userId, kdfConfigKeyDefinition, kdfConfig);
        delete account?.profile?.kdfIterations;
        delete account?.profile?.kdfType;
        delete account?.profile?.kdfMemory;
        delete account?.profile?.kdfParallelism;
      }

      await helper.set(userId, account);
    }
    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const kdfConfig: KdfConfig = await helper.getFromUser(userId, kdfConfigKeyDefinition);

      if (kdfConfig != null) {
        account.profile.kdfIterations = kdfConfig.iterations;
        account.profile.kdfType = kdfConfig.kdfType;
        account.profile.kdfMemory = kdfConfig.memory;
        account.profile.kdfParallelism = kdfConfig.parallelism;
        await helper.setToUser(userId, kdfConfigKeyDefinition, null);
      }
      await helper.set(userId, account);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
