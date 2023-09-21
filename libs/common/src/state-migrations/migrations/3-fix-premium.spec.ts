import { MockProxy } from "jest-mock-extended";

// eslint-disable-next-line import/no-restricted-paths -- Used for testing migration, which requires import
import { TokenService } from "../../auth/services/token.service";
import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { FixPremiumMigrator } from "./3-fix-premium";

function migrateExampleJSON() {
  return {
    global: {
      stateVersion: 2,
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: [
      "c493ed01-4e08-4e88-abc7-332f380ca760",
      "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
    ],
    "c493ed01-4e08-4e88-abc7-332f380ca760": {
      profile: {
        otherStuff: "otherStuff2",
        hasPremiumPersonally: null as boolean,
      },
      tokens: {
        otherStuff: "otherStuff3",
        accessToken: "accessToken",
      },
      otherStuff: "otherStuff4",
    },
    "23e61a5f-2ece-4f5e-b499-f0bc489482a9": {
      profile: {
        otherStuff: "otherStuff5",
        hasPremiumPersonally: true,
      },
      tokens: {
        otherStuff: "otherStuff6",
        accessToken: "accessToken",
      },
      otherStuff: "otherStuff7",
    },
    otherStuff: "otherStuff8",
  };
}

jest.mock("../../auth/services/token.service", () => ({
  TokenService: {
    decodeToken: jest.fn(),
  },
}));

describe("FixPremiumMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: FixPremiumMigrator;
  const decodeTokenSpy = TokenService.decodeToken as jest.Mock;

  beforeEach(() => {
    helper = mockMigrationHelper(migrateExampleJSON());
    sut = new FixPremiumMigrator(2, 3);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("migrate", () => {
    it("should migrate hasPremiumPersonally", async () => {
      decodeTokenSpy.mockResolvedValueOnce({ premium: true });
      await sut.migrate(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("c493ed01-4e08-4e88-abc7-332f380ca760", {
        profile: {
          otherStuff: "otherStuff2",
          hasPremiumPersonally: true,
        },
        tokens: {
          otherStuff: "otherStuff3",
          accessToken: "accessToken",
        },
        otherStuff: "otherStuff4",
      });
    });

    it("should not migrate if decode throws", async () => {
      decodeTokenSpy.mockRejectedValueOnce(new Error("test"));
      await sut.migrate(helper);

      expect(helper.set).not.toHaveBeenCalled();
    });

    it("should not migrate if decode returns null", async () => {
      decodeTokenSpy.mockResolvedValueOnce(null);
      await sut.migrate(helper);

      expect(helper.set).not.toHaveBeenCalled();
    });
  });

  describe("updateVersion", () => {
    it("should update version", async () => {
      await sut.updateVersion(helper, "up");

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("global", {
        stateVersion: 3,
        otherStuff: "otherStuff1",
      });
    });
  });
});
