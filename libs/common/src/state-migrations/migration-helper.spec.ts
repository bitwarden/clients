import { MockProxy, mock } from "jest-mock-extended";

// eslint-disable-next-line import/no-restricted-paths -- Needed to print log messages
import { FakeStorageService } from "../../spec/fake-storage.service";
// eslint-disable-next-line import/no-restricted-paths -- Needed client type enum
import { ClientType } from "../enums";
// eslint-disable-next-line import/no-restricted-paths -- Needed to print log messages
import { LogService } from "../platform/abstractions/log.service";
// eslint-disable-next-line import/no-restricted-paths -- Needed to interface with storage locations
import { AbstractStorageService } from "../platform/abstractions/storage.service";
// eslint-disable-next-line import/no-restricted-paths -- Needed to generate unique strings for injection
import { Utils } from "../platform/misc/utils";

import { MigrationHelper, MigrationHelperType } from "./migration-helper";
import { Migrator } from "./migrator";

const exampleJSON = {
  authenticatedAccounts: [
    "c493ed01-4e08-4e88-abc7-332f380ca760",
    "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
  ],
  "c493ed01-4e08-4e88-abc7-332f380ca760": {
    otherStuff: "otherStuff1",
  },
  "23e61a5f-2ece-4f5e-b499-f0bc489482a9": {
    otherStuff: "otherStuff2",
  },
  global_serviceName_key: "global_serviceName_key",
  user_userId_serviceName_key: "user_userId_serviceName_key",
  global_account_accounts: {
    "c493ed01-4e08-4e88-abc7-332f380ca760": {
      otherStuff: "otherStuff3",
    },
    "23e61a5f-2ece-4f5e-b499-f0bc489482a9": {
      otherStuff: "otherStuff4",
    },
  },
};

describe("RemoveLegacyEtmKeyMigrator", () => {
  let storage: MockProxy<AbstractStorageService>;
  let logService: MockProxy<LogService>;
  let sut: MigrationHelper;

  const clientTypes = Object.values(ClientType);

  describe.each(clientTypes)("for client %s", (clientType) => {
    beforeEach(() => {
      logService = mock();
      storage = mock();
      storage.get.mockImplementation((key) => (exampleJSON as any)[key]);

      sut = new MigrationHelper(0, storage, logService, "general", clientType);
    });

    describe("get", () => {
      it("should delegate to storage.get", async () => {
        await sut.get("key");
        expect(storage.get).toHaveBeenCalledWith("key");
      });
    });

    describe("set", () => {
      it("should delegate to storage.save", async () => {
        await sut.set("key", "value");
        expect(storage.save).toHaveBeenCalledWith("key", "value");
      });
    });

    describe("getAccounts", () => {
      it("should return all accounts", async () => {
        const accounts = await sut.getAccounts();
        expect(accounts).toEqual([
          {
            userId: "c493ed01-4e08-4e88-abc7-332f380ca760",
            account: { otherStuff: "otherStuff1" },
          },
          {
            userId: "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
            account: { otherStuff: "otherStuff2" },
          },
        ]);
      });

      it("should handle missing authenticatedAccounts", async () => {
        storage.get.mockImplementation((key) =>
          key === "authenticatedAccounts" ? undefined : (exampleJSON as any)[key],
        );
        const accounts = await sut.getAccounts();
        expect(accounts).toEqual([]);
      });

      it("handles global scoped known accounts for version 60 and after", async () => {
        sut.currentVersion = 60;
        const accounts = await sut.getAccounts();
        expect(accounts).toEqual([
          // Note, still gets values stored in state service objects, just grabs user ids from global
          {
            userId: "c493ed01-4e08-4e88-abc7-332f380ca760",
            account: { otherStuff: "otherStuff1" },
          },
          {
            userId: "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
            account: { otherStuff: "otherStuff2" },
          },
        ]);
      });
    });

    describe("getKnownUserIds", () => {
      it("returns all user ids", async () => {
        const userIds = await sut.getKnownUserIds();
        expect(userIds).toEqual([
          "c493ed01-4e08-4e88-abc7-332f380ca760",
          "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
        ]);
      });

      it("returns all user ids when version is 60 or greater", async () => {
        sut.currentVersion = 60;
        const userIds = await sut.getKnownUserIds();
        expect(userIds).toEqual([
          "c493ed01-4e08-4e88-abc7-332f380ca760",
          "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
        ]);
      });
    });

    describe("getFromGlobal", () => {
      it("should return the correct value", async () => {
        sut.currentVersion = 9;
        const value = await sut.getFromGlobal({
          stateDefinition: { name: "serviceName" },
          key: "key",
        });
        expect(value).toEqual("global_serviceName_key");
      });

      it("should throw if the current version is less than 9", () => {
        expect(() =>
          sut.getFromGlobal({ stateDefinition: { name: "serviceName" }, key: "key" }),
        ).toThrowError("No key builder should be used for versions prior to 9.");
      });
    });

    describe("setToGlobal", () => {
      it("should set the correct value", async () => {
        sut.currentVersion = 9;
        await sut.setToGlobal(
          { stateDefinition: { name: "serviceName" }, key: "key" },
          "new_value",
        );
        expect(storage.save).toHaveBeenCalledWith("global_serviceName_key", "new_value");
      });

      it("should throw if the current version is less than 9", () => {
        expect(() =>
          sut.setToGlobal(
            { stateDefinition: { name: "serviceName" }, key: "key" },
            "global_serviceName_key",
          ),
        ).toThrowError("No key builder should be used for versions prior to 9.");
      });
    });

    describe("getFromUser", () => {
      it("should return the correct value", async () => {
        sut.currentVersion = 9;
        const value = await sut.getFromUser("userId", {
          stateDefinition: { name: "serviceName" },
          key: "key",
        });
        expect(value).toEqual("user_userId_serviceName_key");
      });

      it("should throw if the current version is less than 9", () => {
        expect(() =>
          sut.getFromUser("userId", { stateDefinition: { name: "serviceName" }, key: "key" }),
        ).toThrowError("No key builder should be used for versions prior to 9.");
      });
    });

    describe("setToUser", () => {
      it("should set the correct value", async () => {
        sut.currentVersion = 9;
        await sut.setToUser(
          "userId",
          { stateDefinition: { name: "serviceName" }, key: "key" },
          "new_value",
        );
        expect(storage.save).toHaveBeenCalledWith("user_userId_serviceName_key", "new_value");
      });

      it("should throw if the current version is less than 9", () => {
        expect(() =>
          sut.setToUser(
            "userId",
            { stateDefinition: { name: "serviceName" }, key: "key" },
            "new_value",
          ),
        ).toThrowError("No key builder should be used for versions prior to 9.");
      });
    });
  });
});

/** Helper to create well-mocked migration helpers in migration tests */
export function mockMigrationHelper(
  storageJson: any,
  stateVersion = 0,
  type: MigrationHelperType = "general",
  clientType: ClientType = ClientType.Web,
): MockProxy<MigrationHelper> {
  const logService: MockProxy<LogService> = mock();
  const storage: MockProxy<AbstractStorageService> = mock();
  storage.get.mockImplementation((key) => (storageJson as any)[key]);
  storage.save.mockImplementation(async (key, value) => {
    (storageJson as any)[key] = value;
  });
  const helper = new MigrationHelper(stateVersion, storage, logService, type, clientType);

  const mockHelper = mock<MigrationHelper>();
  mockHelper.get.mockImplementation((key) => helper.get(key));
  mockHelper.set.mockImplementation((key, value) => helper.set(key, value));
  mockHelper.getFromGlobal.mockImplementation((keyDefinition) =>
    helper.getFromGlobal(keyDefinition),
  );
  mockHelper.setToGlobal.mockImplementation((keyDefinition, value) =>
    helper.setToGlobal(keyDefinition, value),
  );
  mockHelper.getFromUser.mockImplementation((userId, keyDefinition) =>
    helper.getFromUser(userId, keyDefinition),
  );
  mockHelper.setToUser.mockImplementation((userId, keyDefinition, value) =>
    helper.setToUser(userId, keyDefinition, value),
  );
  mockHelper.getAccounts.mockImplementation(() => helper.getAccounts());
  mockHelper.getKnownUserIds.mockImplementation(() => helper.getKnownUserIds());
  mockHelper.removeFromGlobal.mockImplementation((keyDefinition) =>
    helper.removeFromGlobal(keyDefinition),
  );
  mockHelper.remove.mockImplementation((key) => helper.remove(key));

  mockHelper.type = helper.type;
  mockHelper.clientType = helper.clientType;

  return mockHelper;
}

export type InitialDataHint<TUsers extends readonly string[]> = {
  /**
   * A string array of the users id who are authenticated
   */
  authenticatedAccounts?: TUsers;
  /**
   * Global data
   */
  global?: unknown;
  /**
   * Other top level data
   */
  [key: string]: unknown;
} & {
  /**
   * A users data
   */
  [userData in TUsers[number]]?: unknown;
};

type InjectedData = {
  propertyName: string;
  propertyValue: string;
  originalPath: string[];
};

// This is a slight lie, technically the type is `Record<string | symbol, unknown>
// but for the purposes of things in the migrations this is enough.
function isStringRecord(object: unknown | undefined): object is Record<string, unknown> {
  return object && typeof object === "object" && !Array.isArray(object);
}

function injectData(data: Record<string, unknown>, path: string[]): InjectedData[] {
  if (!data) {
    return [];
  }

  const injectedData: InjectedData[] = [];

  // Traverse keys for other objects
  const keys = Object.keys(data);
  for (const key of keys) {
    const currentProperty = data[key];
    if (isStringRecord(currentProperty)) {
      injectedData.push(...injectData(currentProperty, [...path, key]));
    }
  }

  const propertyName = `__injectedProperty__${Utils.newGuid()}`;
  const propertyValue = `__injectedValue__${Utils.newGuid()}`;

  injectedData.push({
    propertyName: propertyName,
    propertyValue: propertyValue,
    // Track the path it was originally injected in just for a better error
    originalPath: path,
  });
  data[propertyName] = propertyValue;
  return injectedData;
}

function expectInjectedData(
  data: Record<string, unknown>,
  injectedData: InjectedData[],
): [data: Record<string, unknown>, leftoverInjectedData: InjectedData[]] {
  const keys = Object.keys(data);
  for (const key of keys) {
    const propertyValue = data[key];
    // Injected data does not have to be found exactly where it was injected,
    // just that it exists at all.
    const injectedIndex = injectedData.findIndex(
      (d) =>
        d.propertyName === key &&
        typeof propertyValue === "string" &&
        propertyValue === d.propertyValue,
    );

    if (injectedIndex !== -1) {
      // We found something we injected, remove it
      injectedData.splice(injectedIndex, 1);
      delete data[key];
      continue;
    }

    if (isStringRecord(propertyValue)) {
      const [updatedData, leftoverInjectedData] = expectInjectedData(propertyValue, injectedData);
      data[key] = updatedData;
      injectedData = leftoverInjectedData;
    }
  }

  return [data, injectedData];
}

/**
 * Runs the {@link Migrator.migrate} method of your migrator. You may pass in your test data and get back the data after the migration.
 * This also injects extra properties at every level of your state and makes sure that it can be found.
 * @param migrator Your migrator to use to do the migration
 * @param initalData The data to start with
 * @returns State after your migration has ran.
 */
export async function runMigrator<
  TMigrator extends Migrator<number, number>,
  const TUsers extends readonly string[],
>(
  migrator: TMigrator,
  initalData?: InitialDataHint<TUsers>,
  direction: "migrate" | "rollback" = "migrate",
): Promise<Record<string, unknown>> {
  const clonedData = JSON.parse(JSON.stringify(initalData ?? {}));

  // Inject fake data at every level of the object
  const allInjectedData = injectData(clonedData, []);

  const fakeStorageService = new FakeStorageService(clonedData);
  const helper = new MigrationHelper(
    migrator.fromVersion,
    fakeStorageService,
    mock(),
    "general",
    ClientType.Web,
  );

  // Run their migrations
  if (direction === "rollback") {
    await migrator.rollback(helper);
  } else {
    await migrator.migrate(helper);
  }
  const [data, leftoverInjectedData] = expectInjectedData(
    fakeStorageService.internalStore,
    allInjectedData,
  );
  expect(leftoverInjectedData).toHaveLength(0);

  return data;
}
