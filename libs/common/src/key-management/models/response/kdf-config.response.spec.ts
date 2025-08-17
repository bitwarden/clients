import { KdfConfigResponse } from "@bitwarden/common/key-management/models/response/kdf-config.response";
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";

describe("KdfConfigResponse", () => {
  it("should throw error when kdf type not provided", () => {
    expect(() => {
      new KdfConfigResponse({
        KdfType: undefined,
        Iterations: 1,
      });
    }).toThrow("KDF config response does not contain a valid KDF type");
  });

  it("should throw error when kdf type is PBKDF2 and iterations not provided", () => {
    expect(() => {
      new KdfConfigResponse({
        KdfType: KdfType.PBKDF2_SHA256,
        Iterations: undefined,
      });
    }).toThrow("KDF config response does not contain a valid number of iterations");
  });

  it("should throw error when kdf type is Argon2Id and iterations not provided", () => {
    expect(() => {
      new KdfConfigResponse({
        KdfType: KdfType.Argon2id,
        Iterations: undefined,
      });
    }).toThrow("KDF config response does not contain a valid number of iterations");
  });

  it("should throw error when kdf type is Argon2Id and memory not provided", () => {
    expect(() => {
      new KdfConfigResponse({
        KdfType: KdfType.Argon2id,
        Iterations: 3,
        Memory: undefined,
        Parallelism: 4,
      });
    }).toThrow("KDF config response does not contain a valid memory size for Argon2id");
  });

  it("should throw error when kdf type is Argon2Id and parallelism not provided", () => {
    expect(() => {
      new KdfConfigResponse({
        KdfType: KdfType.Argon2id,
        Iterations: 3,
        Memory: 64,
        Parallelism: undefined,
      });
    }).toThrow("KDF config response does not contain a valid parallelism for Argon2id");
  });

  it("should create response when kdf type is PBKDF2", () => {
    const response = new KdfConfigResponse({
      KdfType: KdfType.PBKDF2_SHA256,
      Iterations: 600_000,
    });

    expect(response.kdfType).toBe(KdfType.PBKDF2_SHA256);
    expect(response.iterations).toBe(600_000);
    expect(response.memory).toBeUndefined();
    expect(response.parallelism).toBeUndefined();
  });

  it("should create response when kdf type is Argon2Id", () => {
    const response = new KdfConfigResponse({
      KdfType: KdfType.Argon2id,
      Iterations: 3,
      Memory: 64,
      Parallelism: 4,
    });

    expect(response.kdfType).toBe(KdfType.Argon2id);
    expect(response.iterations).toBe(3);
    expect(response.memory).toBe(64);
    expect(response.parallelism).toBe(4);
  });

  describe("toKdfConfig", () => {
    it("should convert to PBKDF2KdfConfig", () => {
      const response = new KdfConfigResponse({
        KdfType: KdfType.PBKDF2_SHA256,
        Iterations: 600_000,
      });

      const kdfConfig = response.toKdfConfig();
      expect(kdfConfig).toBeInstanceOf(PBKDF2KdfConfig);
      const pbkdf2Config = kdfConfig as PBKDF2KdfConfig;
      expect(pbkdf2Config.iterations).toBe(600_000);
    });

    it("should convert to Argon2KdfConfig", () => {
      const response = new KdfConfigResponse({
        KdfType: KdfType.Argon2id,
        Iterations: 3,
        Memory: 64,
        Parallelism: 4,
      });

      const kdfConfig = response.toKdfConfig();
      expect(kdfConfig).toBeInstanceOf(Argon2KdfConfig);
      const argon2Config = kdfConfig as Argon2KdfConfig;
      expect(argon2Config.iterations).toBe(3);
      expect(argon2Config.memory).toBe(64);
      expect(argon2Config.parallelism).toBe(4);
    });
  });
});
