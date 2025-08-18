import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { SendMigrator } from "./54-move-encrypted-sends";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        sends: {
          encrypted: {
            "2ebadc23-e101-471b-bf2d-b125015337a0": {
              id: "2ebadc23-e101-471b-bf2d-b125015337a0",
              accessId: "I9y6LgHhG0e_LbElAVM3oA",
              deletionDate: "2024-03-07T20:35:03Z",
              disabled: false,
              hideEmail: false,
              key: "2.sR07sf4f18Rw6YQH9R/fPw==|DlLIYdTlFBktHVEJixqrOZmW/dTDGmZ+9iVftYkRh4s=|2mXH2fKgtItEMi8rcP1ykkVwRbxztw5MGboBwRl/kKM=",
              name: "2.A0wIvDbyzuh6AjgFtv2gqQ==|D0FymzfCdYJQcAk5MARfjg==|2g52y7e/33A7Bafaaoy3Yvae7vxbIxoABZdZeoZuyg4=",
              text: {
                hidden: false,
                text: "2.MkcPiJUnNfpcyETsoH3b8g==|/oHZ5g6pmcerXAJidP9sXg==|JDhd1Blsxm/ubp2AAggHZr6gZhyW4UYwZkF5rxlO6X0=",
              },
              type: 0,
            },
            "3b31c20d-b783-4912-9170-b12501555398": {
              id: "3b31c20d-b783-4912-9170-b12501555398",
              accessId: "DcIxO4O3EkmRcLElAVVTmA",
              deletionDate: "2024-03-07T20:42:43Z",
              disabled: false,
              hideEmail: false,
              key: "2.366XwLCi7RJnXuAvpsEVNw==|XfLoSsdOIYsHfcSMmv+7VJY97bKfS3fjpbq3ez+KCdk=|iTJxf4Pc3ub6hTFXGeU8NpUV3KxnuxzaHuNoFo/I6Vs=",
              name: "2.uJ2FoouFJr/SR9gv3jYY/Q==|ksVre4/YqwY/XOtPyIfIJw==|/LVT842LJgyAchl7NffogXkrmCFwOEHX9NFd0zgLqKo=",
              text: {
                hidden: false,
                text: "2.zBeOzMKtjnP5YI5lJWQTWA==|vxrGt4GKtydhrqaW35b/jw==|36Jtg172awn9YsgfzNs4pJ/OpA59NBnUkLNt6lg7Zw8=",
              },
              type: 0,
            },
          },
        },
        otherStuff: "otherStuff2",
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
    "user_user-1_send_sends": {
      "2ebadc23-e101-471b-bf2d-b125015337a0": {
        id: "2ebadc23-e101-471b-bf2d-b125015337a0",
        accessId: "I9y6LgHhG0e_LbElAVM3oA",
        deletionDate: "2024-03-07T20:35:03Z",
        disabled: false,
        hideEmail: false,
        key: "2.sR07sf4f18Rw6YQH9R/fPw==|DlLIYdTlFBktHVEJixqrOZmW/dTDGmZ+9iVftYkRh4s=|2mXH2fKgtItEMi8rcP1ykkVwRbxztw5MGboBwRl/kKM=",
        name: "2.A0wIvDbyzuh6AjgFtv2gqQ==|D0FymzfCdYJQcAk5MARfjg==|2g52y7e/33A7Bafaaoy3Yvae7vxbIxoABZdZeoZuyg4=",
        text: {
          hidden: false,
          text: "2.MkcPiJUnNfpcyETsoH3b8g==|/oHZ5g6pmcerXAJidP9sXg==|JDhd1Blsxm/ubp2AAggHZr6gZhyW4UYwZkF5rxlO6X0=",
        },
        type: 0,
      },
      "3b31c20d-b783-4912-9170-b12501555398": {
        id: "3b31c20d-b783-4912-9170-b12501555398",
        accessId: "DcIxO4O3EkmRcLElAVVTmA",
        deletionDate: "2024-03-07T20:42:43Z",
        disabled: false,
        hideEmail: false,
        key: "2.366XwLCi7RJnXuAvpsEVNw==|XfLoSsdOIYsHfcSMmv+7VJY97bKfS3fjpbq3ez+KCdk=|iTJxf4Pc3ub6hTFXGeU8NpUV3KxnuxzaHuNoFo/I6Vs=",
        name: "2.uJ2FoouFJr/SR9gv3jYY/Q==|ksVre4/YqwY/XOtPyIfIJw==|/LVT842LJgyAchl7NffogXkrmCFwOEHX9NFd0zgLqKo=",
        text: {
          hidden: false,
          text: "2.zBeOzMKtjnP5YI5lJWQTWA==|vxrGt4GKtydhrqaW35b/jw==|36Jtg172awn9YsgfzNs4pJ/OpA59NBnUkLNt6lg7Zw8=",
        },
        type: 0,
      },
    },
    "user_user-2_send_data": null as any,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        otherStuff: "otherStuff2",
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

describe("SendMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: SendMigrator;
  const keyDefinitionLike = {
    stateDefinition: {
      name: "send",
    },
    key: "sends",
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 53);
      sut = new SendMigrator(53, 54);
    });

    it("should remove encrypted sends from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set encrypted sends for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, {
        "2ebadc23-e101-471b-bf2d-b125015337a0": {
          id: "2ebadc23-e101-471b-bf2d-b125015337a0",
          accessId: "I9y6LgHhG0e_LbElAVM3oA",
          deletionDate: "2024-03-07T20:35:03Z",
          disabled: false,
          hideEmail: false,
          key: "2.sR07sf4f18Rw6YQH9R/fPw==|DlLIYdTlFBktHVEJixqrOZmW/dTDGmZ+9iVftYkRh4s=|2mXH2fKgtItEMi8rcP1ykkVwRbxztw5MGboBwRl/kKM=",
          name: "2.A0wIvDbyzuh6AjgFtv2gqQ==|D0FymzfCdYJQcAk5MARfjg==|2g52y7e/33A7Bafaaoy3Yvae7vxbIxoABZdZeoZuyg4=",
          text: {
            hidden: false,
            text: "2.MkcPiJUnNfpcyETsoH3b8g==|/oHZ5g6pmcerXAJidP9sXg==|JDhd1Blsxm/ubp2AAggHZr6gZhyW4UYwZkF5rxlO6X0=",
          },
          type: 0,
        },
        "3b31c20d-b783-4912-9170-b12501555398": {
          id: "3b31c20d-b783-4912-9170-b12501555398",
          accessId: "DcIxO4O3EkmRcLElAVVTmA",
          deletionDate: "2024-03-07T20:42:43Z",
          disabled: false,
          hideEmail: false,
          key: "2.366XwLCi7RJnXuAvpsEVNw==|XfLoSsdOIYsHfcSMmv+7VJY97bKfS3fjpbq3ez+KCdk=|iTJxf4Pc3ub6hTFXGeU8NpUV3KxnuxzaHuNoFo/I6Vs=",
          name: "2.uJ2FoouFJr/SR9gv3jYY/Q==|ksVre4/YqwY/XOtPyIfIJw==|/LVT842LJgyAchl7NffogXkrmCFwOEHX9NFd0zgLqKo=",
          text: {
            hidden: false,
            text: "2.zBeOzMKtjnP5YI5lJWQTWA==|vxrGt4GKtydhrqaW35b/jw==|36Jtg172awn9YsgfzNs4pJ/OpA59NBnUkLNt6lg7Zw8=",
          },
          type: 0,
        },
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 54);
      sut = new SendMigrator(53, 54);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add encrypted send values back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalled();
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          sends: {
            encrypted: {
              "2ebadc23-e101-471b-bf2d-b125015337a0": {
                id: "2ebadc23-e101-471b-bf2d-b125015337a0",
                accessId: "I9y6LgHhG0e_LbElAVM3oA",
                deletionDate: "2024-03-07T20:35:03Z",
                disabled: false,
                hideEmail: false,
                key: "2.sR07sf4f18Rw6YQH9R/fPw==|DlLIYdTlFBktHVEJixqrOZmW/dTDGmZ+9iVftYkRh4s=|2mXH2fKgtItEMi8rcP1ykkVwRbxztw5MGboBwRl/kKM=",
                name: "2.A0wIvDbyzuh6AjgFtv2gqQ==|D0FymzfCdYJQcAk5MARfjg==|2g52y7e/33A7Bafaaoy3Yvae7vxbIxoABZdZeoZuyg4=",
                text: {
                  hidden: false,
                  text: "2.MkcPiJUnNfpcyETsoH3b8g==|/oHZ5g6pmcerXAJidP9sXg==|JDhd1Blsxm/ubp2AAggHZr6gZhyW4UYwZkF5rxlO6X0=",
                },
                type: 0,
              },
              "3b31c20d-b783-4912-9170-b12501555398": {
                id: "3b31c20d-b783-4912-9170-b12501555398",
                accessId: "DcIxO4O3EkmRcLElAVVTmA",
                deletionDate: "2024-03-07T20:42:43Z",
                disabled: false,
                hideEmail: false,
                key: "2.366XwLCi7RJnXuAvpsEVNw==|XfLoSsdOIYsHfcSMmv+7VJY97bKfS3fjpbq3ez+KCdk=|iTJxf4Pc3ub6hTFXGeU8NpUV3KxnuxzaHuNoFo/I6Vs=",
                name: "2.uJ2FoouFJr/SR9gv3jYY/Q==|ksVre4/YqwY/XOtPyIfIJw==|/LVT842LJgyAchl7NffogXkrmCFwOEHX9NFd0zgLqKo=",
                text: {
                  hidden: false,
                  text: "2.zBeOzMKtjnP5YI5lJWQTWA==|vxrGt4GKtydhrqaW35b/jw==|36Jtg172awn9YsgfzNs4pJ/OpA59NBnUkLNt6lg7Zw8=",
                },
                type: 0,
              },
            },
          },
          otherStuff: "otherStuff2",
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
