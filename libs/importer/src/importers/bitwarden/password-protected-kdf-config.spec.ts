// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";
import { BitwardenPasswordProtectedFileFormat } from "@bitwarden/vault-export-core";

import { kdfConfigFromPasswordProtectedExport } from "./password-protected-kdf-config";

describe("kdfConfigFromPasswordProtectedExport", () => {
  function fileWith(
    kdf: Partial<
      Pick<
        BitwardenPasswordProtectedFileFormat,
        "kdfType" | "kdfIterations" | "kdfMemory" | "kdfParallelism"
      >
    >,
  ): BitwardenPasswordProtectedFileFormat {
    return {
      encrypted: true,
      passwordProtected: true,
      salt: "c2FsdA==",
      kdfType: KdfType.PBKDF2_SHA256,
      kdfIterations: 600_000,
      encKeyValidation_DO_NOT_EDIT: "encKeyValidation",
      data: "data",
      ...kdf,
    };
  }

  describe("PBKDF2", () => {
    it("accepts the current default iteration count", () => {
      const config = kdfConfigFromPasswordProtectedExport(fileWith({ kdfIterations: 600_000 }));

      expect(config).toEqual(new PBKDF2KdfConfig(600_000));
    });

    it.each([5_000, 100_000, 2_000_000])(
      "accepts %i iterations, as produced by older clients",
      (kdfIterations) => {
        const config = kdfConfigFromPasswordProtectedExport(fileWith({ kdfIterations }));

        expect(config).toEqual(new PBKDF2KdfConfig(kdfIterations));
      },
    );

    it.each([
      ["above the maximum", 2_000_001],
      ["absurdly high", 999_999_999],
      ["below the minimum", 4_999],
      ["zero", 0],
      ["negative", -1],
      ["fractional", 600_000.5],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["null", null as unknown as number],
      ["undefined", undefined as unknown as number],
    ])("rejects iterations that are %s", (_description, kdfIterations) => {
      expect(kdfConfigFromPasswordProtectedExport(fileWith({ kdfIterations }))).toBeNull();
    });

    it("rejects a non-numeric iteration count", () => {
      const file = fileWith({ kdfIterations: "600000" as unknown as number });

      expect(kdfConfigFromPasswordProtectedExport(file)).toBeNull();
    });
  });

  describe("Argon2id", () => {
    function argon2FileWith(
      kdf: Partial<
        Pick<BitwardenPasswordProtectedFileFormat, "kdfIterations" | "kdfMemory" | "kdfParallelism">
      > = {},
    ): BitwardenPasswordProtectedFileFormat {
      return fileWith({
        kdfType: KdfType.Argon2id,
        kdfIterations: 3,
        kdfMemory: 64,
        kdfParallelism: 4,
        ...kdf,
      });
    }

    it("accepts parameters within the supported ranges", () => {
      const config = kdfConfigFromPasswordProtectedExport(argon2FileWith());

      expect(config).toEqual(new Argon2KdfConfig(3, 64, 4));
    });

    it("accepts the maximum supported parameters", () => {
      const config = kdfConfigFromPasswordProtectedExport(
        argon2FileWith({ kdfIterations: 10, kdfMemory: 1024, kdfParallelism: 16 }),
      );

      expect(config).toEqual(new Argon2KdfConfig(10, 1024, 16));
    });

    it("rejects the memory value from the reported finding without allocating", () => {
      expect(
        kdfConfigFromPasswordProtectedExport(argon2FileWith({ kdfMemory: 999_999 })),
      ).toBeNull();
    });

    it.each([
      ["above the maximum", 1_025],
      ["below the minimum", 15],
      ["fractional", 64.5],
      ["null", null as unknown as number],
      ["undefined", undefined as unknown as number],
    ])("rejects memory that is %s", (_description, kdfMemory) => {
      expect(kdfConfigFromPasswordProtectedExport(argon2FileWith({ kdfMemory }))).toBeNull();
    });

    it.each([
      ["above the maximum", 17],
      ["below the minimum", 0],
      ["fractional", 4.5],
      ["null", null as unknown as number],
      ["undefined", undefined as unknown as number],
    ])("rejects parallelism that is %s", (_description, kdfParallelism) => {
      expect(kdfConfigFromPasswordProtectedExport(argon2FileWith({ kdfParallelism }))).toBeNull();
    });

    it.each([
      ["above the maximum", 11],
      ["absurdly high", 999_999_999],
      ["below the minimum", 1],
      ["fractional", 3.5],
      ["null", null as unknown as number],
      ["undefined", undefined as unknown as number],
    ])("rejects iterations that are %s", (_description, kdfIterations) => {
      expect(kdfConfigFromPasswordProtectedExport(argon2FileWith({ kdfIterations }))).toBeNull();
    });
  });

  it.each([
    ["unknown", -1],
    ["out of range", 2],
    ["null", null as unknown as number],
    ["undefined", undefined as unknown as number],
    ["a string", "PBKDF2" as unknown as number],
  ])("rejects a KDF type that is %s", (_description, kdfType) => {
    expect(kdfConfigFromPasswordProtectedExport(fileWith({ kdfType }))).toBeNull();
  });
});
