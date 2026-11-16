import { MockSdkService } from "../../platform/spec/mock-sdk.service";
import { UserId } from "../../types/guid";

import { DefaultKeySyncService } from "./default-key-sync.service";

describe("DefaultKeySyncService", () => {
  const userId = "00000000-0000-0000-0000-000000000001" as UserId;

  let sdkService: MockSdkService;
  let sut: DefaultKeySyncService;

  beforeEach(() => {
    sdkService = new MockSdkService();
    sut = new DefaultKeySyncService(sdkService);
  });

  it("syncs keys through the user's SDK client", async () => {
    const cryptoSyncHandler = sdkService.simulate.userLogin(userId).crypto_sync_handler.mockDeep();

    await sut.syncKeys(userId);

    expect(cryptoSyncHandler.sync_keys).toHaveBeenCalledTimes(1);
  });

  it("rethrows when the SDK key sync fails", async () => {
    const cryptoSyncHandler = sdkService.simulate.userLogin(userId).crypto_sync_handler.mockDeep();
    cryptoSyncHandler.sync_keys.mockRejectedValue(new Error("Key Service unavailable"));

    await expect(sut.syncKeys(userId)).rejects.toThrow("Key Service unavailable");
  });
});
