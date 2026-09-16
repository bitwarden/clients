import { UserId } from "@bitwarden/common/types/guid";
import { StorageServiceProvider } from "@bitwarden/storage-core";
import { FakeStorageService } from "@bitwarden/storage-test-utils";

import { StateCapability } from "./state";

describe("StateCapability", () => {
  const userId = "11111111-1111-4111-8111-111111111111" as UserId;
  const address = { stateName: "automationTest", key: "someKey" };

  let diskStorage: FakeStorageService;
  let sut: StateCapability;

  beforeEach(() => {
    diskStorage = new FakeStorageService();
    sut = new StateCapability(new StorageServiceProvider(diskStorage, new FakeStorageService()));
  });

  it("reads global state by address", async () => {
    diskStorage.internalUpdateStore({ global_automationTest_someKey: "stored" });

    await expect(sut.readGlobal(address)).resolves.toBe("stored");
  });

  it("reads user state by address", async () => {
    diskStorage.internalUpdateStore({ [`user_${userId}_automationTest_someKey`]: "stored" });

    await expect(sut.readUser(userId, address)).resolves.toBe("stored");
  });

  it("returns null for state that was never written", async () => {
    await expect(sut.readGlobal(address)).resolves.toBeNull();
    await expect(sut.readUser(userId, address)).resolves.toBeNull();
  });
});
