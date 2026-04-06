import { MockProxy } from "jest-mock-extended";

import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { AuthRequestMigrator } from "./56-move-auth-requests";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount"],
    FirstAccount: {
      settings: {
        otherStuff: "otherStuff2",
        approveLoginRequests: true,
      },
      otherStuff: "otherStuff3",
      adminAuthRequest: {
        id: "id1",
        privateKey: "privateKey1",
      },
    },
    SecondAccount: {
      settings: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    user_FirstAccount_authRequestLocal_adminAuthRequest: {
      id: "id1",
      privateKey: "privateKey1",
    },
    user_FirstAccount_authRequestLocal_acceptAuthRequests: true,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount"],
    FirstAccount: {
      settings: {
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    SecondAccount: {
      settings: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

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

describe("AuthRequestMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: AuthRequestMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 55);
      sut = new AuthRequestMigrator(55, 56);
    });

    it("removes the existing adminAuthRequest and approveLoginRequests", async () => {
      await sut.migrate(helper);

      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        settings: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).not.toHaveBeenCalledWith("SecondAccount");
    });

    it("sets the adminAuthRequest and approveLoginRequests under the new key definitions", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("FirstAccount", ADMIN_AUTH_REQUEST_KEY, {
        id: "id1",
        privateKey: "privateKey1",
      });

      expect(helper.setToUser).toHaveBeenCalledWith("FirstAccount", ACCEPT_AUTH_REQUESTS_KEY, true);
      expect(helper.setToUser).not.toHaveBeenCalledWith("SecondAccount");
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 56);
      sut = new AuthRequestMigrator(55, 56);
    });

    it("nulls the new adminAuthRequest and acceptAuthRequests values", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("FirstAccount", ADMIN_AUTH_REQUEST_KEY, null);
      expect(helper.setToUser).toHaveBeenCalledWith("FirstAccount", ACCEPT_AUTH_REQUESTS_KEY, null);
    });

    it("sets back the adminAuthRequest and approveLoginRequests under old account object", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        adminAuthRequest: {
          id: "id1",
          privateKey: "privateKey1",
        },
        settings: {
          otherStuff: "otherStuff2",
          approveLoginRequests: true,
        },
        otherStuff: "otherStuff3",
      });
    });
  });
});
