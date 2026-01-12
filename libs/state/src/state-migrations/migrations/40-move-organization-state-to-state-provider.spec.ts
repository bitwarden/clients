import { any, MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { OrganizationMigrator } from "./40-move-organization-state-to-state-provider";

const testDate = new Date();
function exampleOrganization1() {
  return JSON.stringify({
    id: "id",
    name: "name",
    status: 0,
    type: 0,
    enabled: false,
    usePolicies: false,
    useGroups: false,
    useDirectory: false,
    useEvents: false,
    useTotp: false,
    use2fa: false,
    useApi: false,
    useSso: false,
    useKeyConnector: false,
    useScim: false,
    useCustomPermissions: false,
    useResetPassword: false,
    useSecretsManager: false,
    usePasswordManager: false,
    useActivateAutofillPolicy: false,
    selfHost: false,
    usersGetPremium: false,
    seats: 0,
    maxCollections: 0,
    ssoBound: false,
    identifier: "identifier",
    resetPasswordEnrolled: false,
    userId: "userId",
    hasPublicAndPrivateKeys: false,
    providerId: "providerId",
    providerName: "providerName",
    isProviderUser: false,
    isMember: false,
    familySponsorshipFriendlyName: "fsfn",
    familySponsorshipAvailable: false,
    planProductType: 0,
    keyConnectorEnabled: false,
    keyConnectorUrl: "kcu",
    accessSecretsManager: false,
    limitCollectionCreationDeletion: false,
    allowAdminAccessToAllCollectionItems: false,
    flexibleCollections: false,
    familySponsorshipLastSyncDate: testDate,
  });
}

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        organizations: {
          "organization-id-1": exampleOrganization1(),
          "organization-id-2": {
            // ...
          },
        },
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      data: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    "user_user-1_organizations_organizations": {
      "organization-id-1": exampleOrganization1(),
      "organization-id-2": {
        // ...
      },
    },
    "user_user-2_organizations_organizations": null as any,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      data: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("OrganizationMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: OrganizationMigrator;
  const keyDefinitionLike = {
    key: "organizations",
    stateDefinition: {
      name: "organizations",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 40);
      sut = new OrganizationMigrator(39, 40);
    });

    it("should remove organizations from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set organizations value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, {
        "organization-id-1": exampleOrganization1(),
        "organization-id-2": {
          // ...
        },
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 40);
      sut = new OrganizationMigrator(39, 40);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          organizations: {
            "organization-id-1": exampleOrganization1(),
            "organization-id-2": {
              // ...
            },
          },
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);
      expect(helper.set).not.toHaveBeenCalledWith("user-3", any());
    });
  });
});
