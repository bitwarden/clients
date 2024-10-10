import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import { Argon2KdfConfig, PBKDF2KdfConfig } from "../models/domain/kdf-config";

import { KdfConfigService } from "./kdf-config.service";

describe("KdfConfigService", () => {
  let sutKdfConfigService: KdfConfigService;

  let fakeStateProvider: FakeStateProvider;
  let fakeAccountService: FakeAccountService;
  const mockUserId = Utils.newGuid() as UserId;

  beforeEach(() => {
    jest.clearAllMocks();

    fakeAccountService = mockAccountServiceWith(mockUserId);
    fakeStateProvider = new FakeStateProvider(fakeAccountService);
    sutKdfConfigService = new KdfConfigService(fakeStateProvider);
  });

  it("setKdfConfig(): should set the KDF config", async () => {
    const kdfConfig: PBKDF2KdfConfig = new PBKDF2KdfConfig(600_000);
    await sutKdfConfigService.setKdfConfig(mockUserId, kdfConfig);
    await expect(sutKdfConfigService.getKdfConfig()).resolves.toEqual(kdfConfig);
  });

  it("setKdfConfig(): should get the KDF config", async () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(3, 64, 4);
    await sutKdfConfigService.setKdfConfig(mockUserId, kdfConfig);
    await expect(sutKdfConfigService.getKdfConfig()).resolves.toEqual(kdfConfig);
  });

  it("setKdfConfig(): should throw error KDF cannot be null", async () => {
    const kdfConfig: Argon2KdfConfig = null;
    try {
      await sutKdfConfigService.setKdfConfig(mockUserId, kdfConfig);
    } catch (e) {
      expect(e).toEqual(new Error("kdfConfig cannot be null"));
    }
  });

  it("setKdfConfig(): should throw error userId cannot be null", async () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(3, 64, 4);
    try {
      await sutKdfConfigService.setKdfConfig(null, kdfConfig);
    } catch (e) {
      expect(e).toEqual(new Error("userId cannot be null"));
    }
  });

  it("getKdfConfig(): should throw error KdfConfig for active user account state is null", async () => {
    try {
      await sutKdfConfigService.getKdfConfig();
    } catch (e) {
      expect(e).toEqual(new Error("KdfConfig for active user account state is null"));
    }
  });

  it("validateKdfConfigForSetting(): should validate the PBKDF2 KDF config", () => {
    const kdfConfig: PBKDF2KdfConfig = new PBKDF2KdfConfig(600_000);
    expect(() => kdfConfig.validateKdfConfigForSetting()).not.toThrow();
  });

  it("validateKdfConfigForSetting(): should validate the Argon2id KDF config", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(3, 64, 4);
    expect(() => kdfConfig.validateKdfConfigForSetting()).not.toThrow();
  });

  it("validateKdfConfigForSetting(): should throw an error for invalid PBKDF2 iterations", () => {
    const kdfConfig: PBKDF2KdfConfig = new PBKDF2KdfConfig(100000);
    expect(() => kdfConfig.validateKdfConfigForSetting()).toThrow(
      `PBKDF2 iterations must be between ${PBKDF2KdfConfig.ITERATIONS.min} and ${PBKDF2KdfConfig.ITERATIONS.max}`,
    );
  });

  it("validateKdfConfigForSetting(): should throw an error for invalid Argon2 iterations", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(11, 64, 4);
    expect(() => kdfConfig.validateKdfConfigForSetting()).toThrow(
      `Argon2 iterations must be between ${Argon2KdfConfig.ITERATIONS.min} and ${Argon2KdfConfig.ITERATIONS.max}`,
    );
  });

  it("validateKdfConfigForSetting(): should throw an error for invalid Argon2 memory", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(3, 1025, 4);
    expect(() => kdfConfig.validateKdfConfigForSetting()).toThrow(
      `Argon2 memory must be between ${Argon2KdfConfig.MEMORY.min}mb and ${Argon2KdfConfig.MEMORY.max}mb`,
    );
  });

  it("validateKdfConfigForSetting(): should throw an error for invalid Argon2 parallelism", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(3, 64, 17);
    expect(() => kdfConfig.validateKdfConfigForSetting()).toThrow(
      `Argon2 parallelism must be between ${Argon2KdfConfig.PARALLELISM.min} and ${Argon2KdfConfig.PARALLELISM.max}`,
    );
  });

  it("validateKdfConfigForPrelogin(): should validate the PBKDF2 KDF config", () => {
    const kdfConfig: PBKDF2KdfConfig = new PBKDF2KdfConfig(600_000);
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).not.toThrow();
  });

  it("validateKdfConfigForPrelogin(): should validate the Argon2id KDF config", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(3, 64, 4);
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).not.toThrow();
  });

  it("validateKdfConfigForPrelogin(): should throw an error for too low PBKDF2 iterations", () => {
    const kdfConfig: PBKDF2KdfConfig = new PBKDF2KdfConfig(
      PBKDF2KdfConfig.PRELOGIN_ITERATIONS.min - 1,
    );
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `PBKDF2 iterations must be between ${PBKDF2KdfConfig.PRELOGIN_ITERATIONS.min} and ${PBKDF2KdfConfig.PRELOGIN_ITERATIONS.max}`,
    );
  });

  it("validateKdfConfigForPrelogin(): should throw an error for too high PBKDF2 iterations", () => {
    const kdfConfig: PBKDF2KdfConfig = new PBKDF2KdfConfig(
      PBKDF2KdfConfig.PRELOGIN_ITERATIONS.max + 1,
    );
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `PBKDF2 iterations must be between ${PBKDF2KdfConfig.PRELOGIN_ITERATIONS.min} and ${PBKDF2KdfConfig.PRELOGIN_ITERATIONS.max}`,
    );
  });

  it("validateKdfConfigForPrelogin(): should throw an error for too low Argon2 iterations", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(
      Argon2KdfConfig.ITERATIONS.min - 1,
      64,
      4,
    );
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `Argon2 iterations must be between ${Argon2KdfConfig.ITERATIONS.min} and ${Argon2KdfConfig.ITERATIONS.max}`,
    );
  });

  it("validateKdfConfigForPrelogin(): should throw an error for too high Argon2 iterations", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(
      Argon2KdfConfig.PRELOGIN_ITERATIONS.max + 1,
      64,
      4,
    );
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `Argon2 iterations must be between ${Argon2KdfConfig.ITERATIONS.min} and ${Argon2KdfConfig.ITERATIONS.max}`,
    );
  });

  it("validateKdfConfigForPrelogin(): should throw an error for too low Argon2 memory", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(
      3,
      Argon2KdfConfig.PRELOGIN_MEMORY.min - 1,
      4,
    );
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `Argon2 memory must be between ${Argon2KdfConfig.PRELOGIN_MEMORY.min}mb and ${Argon2KdfConfig.PRELOGIN_MEMORY.max}mb`,
    );
  });

  it("validateKdfConfigForPrelogin(): should throw an error for too high Argon2 memory", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(
      3,
      Argon2KdfConfig.PRELOGIN_MEMORY.max + 1,
      4,
    );
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `Argon2 memory must be between ${Argon2KdfConfig.PRELOGIN_MEMORY.min}mb and ${Argon2KdfConfig.PRELOGIN_MEMORY.max}mb`,
    );
  });

  it("validateKdfConfigForPrelogin(): should throw an error for too high Argon2 parallelism", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(3, 64, 17);
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `Argon2 parallelism must be between ${Argon2KdfConfig.PRELOGIN_PARALLELISM.min} and ${Argon2KdfConfig.PRELOGIN_PARALLELISM.max}`,
    );
  });
});
