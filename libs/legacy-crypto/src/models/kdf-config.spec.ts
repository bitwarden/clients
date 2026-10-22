import { KdfType } from "../enums/kdf-type.enum";

import { Argon2KdfConfig, PBKDF2KdfConfig } from "./kdf-config";

describe("KdfConfig", () => {
  describe("PBKDF2KdfConfig.createDefault()", () => {
    it("should create with default iterations", () => {
      const kdfConfig = PBKDF2KdfConfig.createDefault();

      expect(kdfConfig.iterations).toBe(600_000);
      expect(kdfConfig.kdfType).toBe(KdfType.PBKDF2_SHA256);
    });
  });

  describe("Argon2KdfConfig.createDefault()", () => {
    it("should create with default values", () => {
      const kdfConfig = Argon2KdfConfig.createDefault();

      expect(kdfConfig.iterations).toBe(6);
      expect(kdfConfig.memory).toBe(32);
      expect(kdfConfig.parallelism).toBe(4);
      expect(kdfConfig.kdfType).toBe(KdfType.Argon2id);
    });
  });

  describe("PBKDF2KdfConfig constructor", () => {
    it("should throw when iterations is null", () => {
      expect(() => new PBKDF2KdfConfig(null as unknown as number)).toThrow(
        "iterations is null or undefined.",
      );
    });

    it("should throw when iterations is undefined", () => {
      expect(() => new PBKDF2KdfConfig(undefined as unknown as number)).toThrow(
        "iterations is null or undefined.",
      );
    });
  });

  describe("Argon2KdfConfig constructor", () => {
    it("should throw when iterations is null", () => {
      expect(() => new Argon2KdfConfig(null as unknown as number, 64, 4)).toThrow(
        "iterations is null or undefined.",
      );
    });

    it("should throw when iterations is undefined", () => {
      expect(() => new Argon2KdfConfig(undefined as unknown as number, 64, 4)).toThrow(
        "iterations is null or undefined.",
      );
    });

    it("should throw when memory is null", () => {
      expect(() => new Argon2KdfConfig(3, null as unknown as number, 4)).toThrow(
        "memory is null or undefined.",
      );
    });

    it("should throw when memory is undefined", () => {
      expect(() => new Argon2KdfConfig(3, undefined as unknown as number, 4)).toThrow(
        "memory is null or undefined.",
      );
    });

    it("should throw when parallelism is null", () => {
      expect(() => new Argon2KdfConfig(3, 64, null as unknown as number)).toThrow(
        "parallelism is null or undefined.",
      );
    });

    it("should throw when parallelism is undefined", () => {
      expect(() => new Argon2KdfConfig(3, 64, undefined as unknown as number)).toThrow(
        "parallelism is null or undefined.",
      );
    });
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
      PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1,
    );
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `PBKDF2 iterations must be at least ${PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN}, but was ${kdfConfig.iterations}; possible pre-login downgrade attack detected.`,
    );
  });

  it("validateKdfConfigForPrelogin(): should throw an error for too low Argon2 iterations", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(
      Argon2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1,
      64,
      4,
    );
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `Argon2 iterations must be at least ${Argon2KdfConfig.PRELOGIN_ITERATIONS_MIN}, but was ${kdfConfig.iterations}; possible pre-login downgrade attack detected.`,
    );
  });

  it("validateKdfConfigForPrelogin(): should throw an error for too low Argon2 memory", () => {
    const kdfConfig: Argon2KdfConfig = new Argon2KdfConfig(
      3,
      Argon2KdfConfig.PRELOGIN_MEMORY_MIN - 1,
      4,
    );
    expect(() => kdfConfig.validateKdfConfigForPrelogin()).toThrow(
      `Argon2 memory must be at least ${Argon2KdfConfig.PRELOGIN_MEMORY_MIN} MiB, but was ${kdfConfig.memory} MiB; possible pre-login downgrade attack detected.`,
    );
  });
});
