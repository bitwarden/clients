import { mockMigrationHelper, runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import {
  MigratePoliciesNewToPolicies,
  POLICIES,
  POLICIES_NEW,
} from "./87-migrate-policies-new-to-policies";

describe("MigratePoliciesNewToPolicies", () => {
  const sut = new MigratePoliciesNewToPolicies(86, 87);

  const accounts = {
    user1: { email: "user1@email.com", name: "User 1", emailVerified: true },
    user2: { email: "user2@email.com", name: "User 2", emailVerified: true },
  };

  const oldPolicies = {
    policy1: { id: "policy1", organizationId: "org1", type: 0, enabled: true },
  };

  const newPolicies = {
    policy1: { id: "policy1", organizationId: "org1", type: 0, enabled: true },
    policy2: { id: "policy2", organizationId: "org2", type: 1, enabled: true },
  };

  // runMigrator can't be used when an existing value is overwritten, because it expects the
  // data it injects into the overwritten value to survive the migration.
  async function migrate(storage: Record<string, unknown>) {
    const helper = mockMigrationHelper(storage, 86);
    await sut.migrate(helper);
    return helper;
  }

  describe("migrate", () => {
    it("overwrites policies with policiesNew and removes policiesNew", async () => {
      const helper = await migrate({
        global_account_accounts: accounts,
        user_user1_policies_policies: oldPolicies,
        user_user1_policies_policiesNew: newPolicies,
      });

      expect(await helper.getFromUser("user1", POLICIES)).toEqual(newPolicies);
      expect(await helper.getFromUser("user1", POLICIES_NEW)).toBeUndefined();
    });

    it("overwrites policies with an empty policiesNew", async () => {
      const helper = await migrate({
        global_account_accounts: accounts,
        user_user1_policies_policies: oldPolicies,
        user_user1_policies_policiesNew: {},
      });

      expect(await helper.getFromUser("user1", POLICIES)).toEqual({});
      expect(await helper.getFromUser("user1", POLICIES_NEW)).toBeUndefined();
    });

    it("migrates each account independently", async () => {
      const helper = await migrate({
        global_account_accounts: accounts,
        user_user1_policies_policies: oldPolicies,
        user_user1_policies_policiesNew: newPolicies,
        user_user2_policies_policies: oldPolicies,
      });

      expect(await helper.getFromUser("user1", POLICIES)).toEqual(newPolicies);
      expect(await helper.getFromUser("user1", POLICIES_NEW)).toBeUndefined();
      expect(await helper.getFromUser("user2", POLICIES)).toEqual(oldPolicies);
      expect(await helper.getFromUser("user2", POLICIES_NEW)).toBeUndefined();
    });

    it("moves policiesNew to policies when only policiesNew exists", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_policies_policiesNew: newPolicies,
      });

      expect(output).toEqual({
        global_account_accounts: accounts,
        user_user1_policies_policies: newPolicies,
      });
    });

    it("leaves policies unchanged when policiesNew is missing", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_policies_policies: oldPolicies,
      });

      expect(output).toEqual({
        global_account_accounts: accounts,
        user_user1_policies_policies: oldPolicies,
      });
    });

    it("leaves policies unchanged and removes policiesNew when policiesNew is null", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_policies_policies: oldPolicies,
        user_user1_policies_policiesNew: null,
      });

      expect(output).toEqual({
        global_account_accounts: accounts,
        user_user1_policies_policies: oldPolicies,
      });
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
