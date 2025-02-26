import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultKdfConfigService, KDF_CONFIG } from "./kdf-config.service";
import { Argon2KdfConfig, KdfConfig, PBKDF2KdfConfig } from "./models/kdf-config";

describe("KdfConfigService", () => {
  let sutKdfConfigService: DefaultKdfConfigService;

  let fakeStateProvider: FakeStateProvider;
  let fakeAccountService: FakeAccountService;
  const mockUserId = Utils.newGuid() as UserId;

  beforeEach(() => {
    jest.clearAllMocks();

    fakeAccountService = mockAccountServiceWith(mockUserId);
    fakeStateProvider = new FakeStateProvider(fakeAccountService);
    sutKdfConfigService = new DefaultKdfConfigService(fakeStateProvider);
  });

  it("setKdfConfig(): should set the PBKDF2KdfConfig config", async () => {
    const kdfConfig: KdfConfig = new PBKDF2KdfConfig(500_000);
    await sutKdfConfigService.setKdfConfig(mockUserId, kdfConfig);
    expect(fakeStateProvider.mock.setUserState).toHaveBeenCalledWith(
      KDF_CONFIG,
      kdfConfig,
      mockUserId,
    );
  });

  it("setKdfConfig(): should set the Argon2KdfConfig config", async () => {
    const kdfConfig: KdfConfig = new Argon2KdfConfig(2, 63, 3);
    await sutKdfConfigService.setKdfConfig(mockUserId, kdfConfig);
    expect(fakeStateProvider.mock.setUserState).toHaveBeenCalledWith(
      KDF_CONFIG,
      kdfConfig,
      mockUserId,
    );
  });

  it("setKdfConfig(): should throw error KDF cannot be null", async () => {
    try {
      await sutKdfConfigService.setKdfConfig(mockUserId, null as unknown as KdfConfig);
    } catch (e) {
      expect(e).toEqual(new Error("kdfConfig cannot be null"));
    }
  });

  it("setKdfConfig(): should throw error userId cannot be null", async () => {
    const kdfConfig: KdfConfig = new Argon2KdfConfig(3, 64, 4);
    try {
      await sutKdfConfigService.setKdfConfig(null as unknown as UserId, kdfConfig);
    } catch (e) {
      expect(e).toEqual(new Error("userId cannot be null"));
    }
  });

  it("getKdfConfig(): should get KdfConfig of active user", async () => {
    const kdfConfig: KdfConfig = new PBKDF2KdfConfig(500_000);
    await fakeStateProvider.setUserState(KDF_CONFIG, kdfConfig, mockUserId);
    await expect(sutKdfConfigService.getKdfConfig()).resolves.toEqual(kdfConfig);
  });

  it("getKdfConfig(): should throw error KdfConfig can only be retrieved when there is active user", async () => {
    fakeAccountService.activeAccountSubject.next(null);
    try {
      await sutKdfConfigService.getKdfConfig();
    } catch (e) {
      expect(e).toEqual(new Error("KdfConfig can only be retrieved when there is active user"));
    }
  });

  it("getKdfConfig(): should throw error KdfConfig for active user account state is null", async () => {
    try {
      await sutKdfConfigService.getKdfConfig();
    } catch (e) {
      expect(e).toEqual(new Error("KdfConfig for active user account state is null"));
    }
  });

  it("getKdfConfig$(UserId): should get KdfConfig of provided user", async () => {
    await expect(firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId))).resolves.toBeNull();
    const kdfConfig: KdfConfig = new PBKDF2KdfConfig(500_000);
    await fakeStateProvider.setUserState(KDF_CONFIG, kdfConfig, mockUserId);
    await expect(firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId))).resolves.toEqual(
      kdfConfig,
    );
  });

  it("getKdfConfig$(UserId): should get KdfConfig of provided user after changed", async () => {
    await expect(firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId))).resolves.toBeNull();
    await fakeStateProvider.setUserState(KDF_CONFIG, new PBKDF2KdfConfig(500_000), mockUserId);
    const kdfConfigChanged: KdfConfig = new PBKDF2KdfConfig(500_001);
    await fakeStateProvider.setUserState(KDF_CONFIG, kdfConfigChanged, mockUserId);
    await expect(firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId))).resolves.toEqual(
      kdfConfigChanged,
    );
  });

  it("getKdfConfig$(UserId): should throw error userId cannot be null", async () => {
    try {
      sutKdfConfigService.getKdfConfig$(null as unknown as UserId);
    } catch (e) {
      expect(e).toEqual(new Error("userId cannot be null"));
    }
  });
});
