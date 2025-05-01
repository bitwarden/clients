// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MigrationHelper } from "../migration-helper";
import { Direction, Migrator } from "../migrator";

type ExpectedAccountType = { keys?: { organizationKeys?: { encrypted: Record<string, string> } } };
type NewAccountType = {
  keys?: {
    organizationKeys?: { encrypted: Record<string, { type: "organization"; key: string }> };
  };
};

export class AddKeyTypeToOrgKeysMigrator extends Migrator<4, 5> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts();

    async function updateOrgKey(userId: string, account: ExpectedAccountType) {
      const encryptedOrgKeys = account?.keys?.organizationKeys?.encrypted;
      if (encryptedOrgKeys == null) {
        return;
      }

      const newOrgKeys: Record<string, { type: "organization"; key: string }> = {};

      Object.entries(encryptedOrgKeys).forEach(([orgId, encKey]) => {
        newOrgKeys[orgId] = {
          type: "organization",
          key: encKey,
        };
      });
      (account as any).keys.organizationKeys.encrypted = newOrgKeys;

      await helper.set(userId, account);
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.all(accounts.map(({ userId, account }) => updateOrgKey(userId, account)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts();

    async function updateOrgKey(userId: string, account: NewAccountType) {
      const encryptedOrgKeys = account?.keys?.organizationKeys?.encrypted;
      if (encryptedOrgKeys == null) {
        return;
      }

      const newOrgKeys: Record<string, string> = {};

      Object.entries(encryptedOrgKeys).forEach(([orgId, encKey]) => {
        newOrgKeys[orgId] = encKey.key;
      });
      (account as any).keys.organizationKeys.encrypted = newOrgKeys;

      await helper.set(userId, account);
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.all(accounts.map(async ({ userId, account }) => updateOrgKey(userId, account)));
  }

  // Override is necessary because default implementation assumes `stateVersion` at the root, but for this version
  // it is nested inside a global object.
  override async updateVersion(helper: MigrationHelper, direction: Direction): Promise<void> {
    const endVersion = direction === "up" ? this.toVersion : this.fromVersion;
    helper.currentVersion = endVersion;
    const global: { stateVersion: number } = (await helper.get("global")) || ({} as any);
    await helper.set("global", { ...global, stateVersion: endVersion });
  }
}
