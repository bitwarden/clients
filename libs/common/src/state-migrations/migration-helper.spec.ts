import { MockProxy, mock } from "jest-mock-extended";

// eslint-disable-next-line import/no-restricted-paths -- Needed to print log messages
import { LogService } from "../platform/abstractions/log.service";
// eslint-disable-next-line import/no-restricted-paths -- Needed to interface with storage locations
import { AbstractStorageService } from "../platform/abstractions/storage.service";

import { MigrationHelper } from "./migration-helper";

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
};

describe("RemoveLegacyEtmKeyMigrator", () => {
  let storage: MockProxy<AbstractStorageService>;
  let logService: MockProxy<LogService>;
  let sut: MigrationHelper;

  beforeEach(() => {
    logService = mock();
    storage = mock();
    storage.get.mockImplementation((key) => (exampleJSON as any)[key]);

    sut = new MigrationHelper(0, storage, logService);
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
        { userId: "c493ed01-4e08-4e88-abc7-332f380ca760", account: { otherStuff: "otherStuff1" } },
        { userId: "23e61a5f-2ece-4f5e-b499-f0bc489482a9", account: { otherStuff: "otherStuff2" } },
      ]);
    });

    it("should handle missing authenticatedAccounts", async () => {
      storage.get.mockImplementation((key) =>
        key === "authenticatedAccounts" ? undefined : (exampleJSON as any)[key]
      );
      const accounts = await sut.getAccounts();
      expect(accounts).toEqual([]);
    });
  });
});

/** Helper to create well-mocked migration helpers in migration tests */
export function mockMigrationHelper(storageJson: any): MockProxy<MigrationHelper> {
  const logService: MockProxy<LogService> = mock();
  const storage: MockProxy<AbstractStorageService> = mock();
  storage.get.mockImplementation((key) => (storageJson as any)[key]);
  storage.save.mockImplementation(async (key, value) => {
    (storageJson as any)[key] = value;
  });
  const helper = new MigrationHelper(0, storage, logService);

  const mockHelper = mock<MigrationHelper>();
  mockHelper.get.mockImplementation((key) => helper.get(key));
  mockHelper.set.mockImplementation((key, value) => helper.set(key, value));
  mockHelper.getAccounts.mockImplementation(() => helper.getAccounts());
  return mockHelper;
}
