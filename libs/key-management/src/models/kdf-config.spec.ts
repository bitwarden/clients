import { Argon2KdfConfig, PBKDF2KdfConfig } from "./kdf-config";

describe("KdfConfig", () => {
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
