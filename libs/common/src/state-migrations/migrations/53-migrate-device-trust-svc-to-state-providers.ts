// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

// Types to represent data as it is stored in JSON
type DeviceKeyJsonType = {
  keyB64: string;
};

type ExpectedAccountType = {
  keys?: {
    deviceKey?: DeviceKeyJsonType;
  };
  settings?: {
    trustDeviceChoiceForDecryption?: boolean;
  };
};

export const DEVICE_KEY: KeyDefinitionLike = {
  key: "deviceKey", // matches KeyDefinition.key in DeviceTrustService
  stateDefinition: {
    name: "deviceTrust", // matches StateDefinition.name in StateDefinitions
  },
};

export const SHOULD_TRUST_DEVICE: KeyDefinitionLike = {
  key: "shouldTrustDevice",
  stateDefinition: {
    name: "deviceTrust",
  },
};

export class DeviceTrustServiceStateProviderMigrator extends Migrator<52, 53> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      let updatedAccount = false;

      // Migrate deviceKey
      const existingDeviceKey = account?.keys?.deviceKey;

      if (existingDeviceKey != null) {
        // Only migrate data that exists
        await helper.setToUser(userId, DEVICE_KEY, existingDeviceKey);
        delete account.keys.deviceKey;
        updatedAccount = true;
      }

      // Migrate shouldTrustDevice
      const existingShouldTrustDevice = account?.settings?.trustDeviceChoiceForDecryption;

      if (existingShouldTrustDevice != null) {
        await helper.setToUser(userId, SHOULD_TRUST_DEVICE, existingShouldTrustDevice);
        delete account.settings.trustDeviceChoiceForDecryption;
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
      // Rollback deviceKey
      const migratedDeviceKey: DeviceKeyJsonType = await helper.getFromUser(userId, DEVICE_KEY);

      if (account?.keys && migratedDeviceKey != null) {
        account.keys.deviceKey = migratedDeviceKey;
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, DEVICE_KEY, null);

      // Rollback shouldTrustDevice
      const migratedShouldTrustDevice = await helper.getFromUser<boolean>(
        userId,
        SHOULD_TRUST_DEVICE,
      );

      if (account?.settings && migratedShouldTrustDevice != null) {
        account.settings.trustDeviceChoiceForDecryption = migratedShouldTrustDevice;
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, SHOULD_TRUST_DEVICE, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
