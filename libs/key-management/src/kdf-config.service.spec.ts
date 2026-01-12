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

  describe("setKdfConfig", () => {
    it("sets the PBKDF2KdfConfig config", async () => {
      const kdfConfig: KdfConfig = new PBKDF2KdfConfig(500_000);
      await sutKdfConfigService.setKdfConfig(mockUserId, kdfConfig);
      expect(fakeStateProvider.mock.setUserState).toHaveBeenCalledWith(
        KDF_CONFIG,
        kdfConfig,
        mockUserId,
      );
    });

    it("sets the Argon2KdfConfig config", async () => {
      const kdfConfig: KdfConfig = new Argon2KdfConfig(2, 63, 3);
      await sutKdfConfigService.setKdfConfig(mockUserId, kdfConfig);
      expect(fakeStateProvider.mock.setUserState).toHaveBeenCalledWith(
        KDF_CONFIG,
        kdfConfig,
        mockUserId,
      );
    });

    it("throws error KDF cannot be null", async () => {
      try {
        await sutKdfConfigService.setKdfConfig(mockUserId, null as unknown as KdfConfig);
      } catch (e) {
        expect(e).toEqual(new Error("kdfConfig cannot be null"));
      }
    });

    it("throws error userId cannot be null", async () => {
      const kdfConfig: KdfConfig = new Argon2KdfConfig(3, 64, 4);
      try {
        await sutKdfConfigService.setKdfConfig(null as unknown as UserId, kdfConfig);
      } catch (e) {
        expect(e).toEqual(new Error("userId cannot be null"));
      }
    });
  });

  describe("getKdfConfig", () => {
    it("throws error if userId is null", async () => {
      await expect(sutKdfConfigService.getKdfConfig(null as unknown as UserId)).rejects.toThrow(
        "userId cannot be null",
      );
    });

    it("throws if target user doesn't have a KkfConfig", async () => {
      const errorMessage = "KdfConfig for user " + mockUserId + " is null";
      await expect(sutKdfConfigService.getKdfConfig(mockUserId)).rejects.toThrow(errorMessage);
    });

    it("returns KdfConfig of target user", async () => {
      const kdfConfig: KdfConfig = new PBKDF2KdfConfig(500_000);
      await fakeStateProvider.setUserState(KDF_CONFIG, kdfConfig, mockUserId);
      await expect(sutKdfConfigService.getKdfConfig(mockUserId)).resolves.toEqual(kdfConfig);
    });
  });

  describe("getKdfConfig$", () => {
    it("gets KdfConfig of provided user", async () => {
      await expect(
        firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId)),
      ).resolves.toBeNull();
      const kdfConfig: KdfConfig = new PBKDF2KdfConfig(500_000);
      await fakeStateProvider.setUserState(KDF_CONFIG, kdfConfig, mockUserId);
      await expect(firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId))).resolves.toEqual(
        kdfConfig,
      );
    });

    it("gets KdfConfig of provided user after changed", async () => {
      await expect(
        firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId)),
      ).resolves.toBeNull();
      await fakeStateProvider.setUserState(KDF_CONFIG, new PBKDF2KdfConfig(500_000), mockUserId);
      const kdfConfigChanged: KdfConfig = new PBKDF2KdfConfig(500_001);
      await fakeStateProvider.setUserState(KDF_CONFIG, kdfConfigChanged, mockUserId);
      await expect(firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId))).resolves.toEqual(
        kdfConfigChanged,
      );
    });

    it("throws error userId cannot be null", async () => {
      try {
        sutKdfConfigService.getKdfConfig$(null as unknown as UserId);
      } catch (e) {
        expect(e).toEqual(new Error("userId cannot be null"));
      }
    });
  });
});
