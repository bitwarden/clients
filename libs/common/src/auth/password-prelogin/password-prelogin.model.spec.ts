// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { PasswordPreloginData } from "./password-prelogin.model";

const salt = "server.normalized+salt@example.com";

// PasswordPreloginData is a plain carrier. Response mapping, the null-salt fallback, and the
// pre-login downgrade guard moved into DefaultPasswordPreloginService when fromResponse was
// removed — that coverage lives in default-password-prelogin.service.spec.ts and
// password-prelogin-api.service.spec.ts. The tests below pin the responsibilities this model
// must NOT take back on, so a future refactor cannot quietly reintroduce them here.
describe("PasswordPreloginData", () => {
  it("carries the kdf config and salt it was constructed with", () => {
    const kdfConfig = PBKDF2KdfConfig.createDefault();

    const result = new PasswordPreloginData(kdfConfig, salt);

    expect(result.kdfConfig).toBe(kdfConfig);
    expect(result.salt).toBe(salt);
  });

  it("accepts any KdfConfig variant", () => {
    const kdfConfig = new Argon2KdfConfig(
      Argon2KdfConfig.ITERATIONS.defaultValue,
      Argon2KdfConfig.MEMORY.defaultValue,
      Argon2KdfConfig.PARALLELISM.defaultValue,
    );

    const result = new PasswordPreloginData(kdfConfig, salt);

    expect(result.kdfConfig).toBe(kdfConfig);
  });

  it("does not normalize the salt", () => {
    // LegacyCompatKeyService.makeMasterKey trims and lower-cases the salt before deriving, so
    // the model must hand over exactly what it was given.
    const unnormalized = "  MiXeD.Case@Example.Com  ";

    const result = new PasswordPreloginData(PBKDF2KdfConfig.createDefault(), unnormalized);

    expect(result.salt).toBe(unnormalized);
  });

  it("does not validate the kdf config", () => {
    // The pre-login downgrade guard runs in DefaultPasswordPreloginService, before it constructs
    // this model. Constructing one directly must stay guard-free so the service owns that check.
    const belowPreloginMinimum = new PBKDF2KdfConfig(PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1);

    expect(() => new PasswordPreloginData(belowPreloginMinimum, salt)).not.toThrow();
  });
});
