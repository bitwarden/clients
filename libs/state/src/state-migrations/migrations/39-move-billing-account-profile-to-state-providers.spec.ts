import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
  MoveBillingAccountProfileMigrator,
} from "./39-move-billing-account-profile-to-state-providers";

const exampleJSON = () => ({
  global: {
    otherStuff: "otherStuff1",
  },
  authenticatedAccounts: ["user-1", "user-2", "user-3"],
  "user-1": {
    profile: {
      hasPremiumPersonally: true,
      hasPremiumFromOrganization: false,
      otherStuff: "otherStuff2",
    },
    otherStuff: "otherStuff3",
  },
  "user-2": {
    otherStuff: "otherStuff4",
  },
});

const rollbackJSON = () => ({
  "user_user-1_billing_accountProfile": {
    hasPremiumPersonally: true,
    hasPremiumFromOrganization: false,
  },
  global: {
    otherStuff: "otherStuff1",
  },
  authenticatedAccounts: ["user-1", "user-2", "user-3"],
  "user-1": {
    profile: {
      otherStuff: "otherStuff2",
    },
    otherStuff: "otherStuff3",
  },
  "user-2": {
    otherStuff: "otherStuff4",
  },
});

describe("MoveBillingAccountProfileToStateProviders migrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: MoveBillingAccountProfileMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 39);
      sut = new MoveBillingAccountProfileMigrator(38, 39);
    });

    it("removes from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        profile: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("sets hasPremiumPersonally value for account that have it", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
        { hasPremiumFromOrganization: false, hasPremiumPersonally: true },
      );
    });

    it("should not call extra setToUser", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(1);
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 39);
      sut = new MoveBillingAccountProfileMigrator(38, 39);
    });

    it("nulls out new values", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
        null,
      );
    });

    it("adds explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        profile: {
          hasPremiumPersonally: true,
          hasPremiumFromOrganization: false,
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it.each(["user-2", "user-3"])(
      "does not restore values when accounts are not present",
      async (userId) => {
        await sut.rollback(helper);

        expect(helper.set).not.toHaveBeenCalledWith(userId, any());
      },
    );
  });
});
