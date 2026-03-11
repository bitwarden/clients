// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { PasswordPreloginData } from "./password-prelogin.model";
import { PasswordPreloginResponse } from "./password-prelogin.response";

describe("PasswordPreloginData", () => {
  describe("fromResponse", () => {
    it.each([
      {
        description: "PBKDF2",
        response: { Kdf: 0, KdfIterations: PBKDF2KdfConfig.ITERATIONS.defaultValue },
        expected: new PasswordPreloginData(
          new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.defaultValue),
        ),
      },
      {
        description: "Argon2",
        response: {
          Kdf: 1,
          KdfIterations: Argon2KdfConfig.ITERATIONS.defaultValue,
          KdfMemory: Argon2KdfConfig.MEMORY.defaultValue,
          KdfParallelism: Argon2KdfConfig.PARALLELISM.defaultValue,
        },
        expected: new PasswordPreloginData(
          new Argon2KdfConfig(
            Argon2KdfConfig.ITERATIONS.defaultValue,
            Argon2KdfConfig.MEMORY.defaultValue,
            Argon2KdfConfig.PARALLELISM.defaultValue,
          ),
        ),
      },
    ])("maps a $description response to a PasswordPreloginData", ({ response, expected }) => {
      const result = PasswordPreloginData.fromResponse(new PasswordPreloginResponse(response));

      expect(result).toEqual(expected);
    });

    it.each([
      {
        description: "PBKDF2 iterations below minimum",
        response: { Kdf: 0, KdfIterations: 4999 },
        expectedError: /PBKDF2 iterations must be at least 5000/,
      },
      {
        description: "Argon2 iterations below minimum",
        response: {
          Kdf: 1,
          KdfIterations: 1,
          KdfMemory: Argon2KdfConfig.MEMORY.defaultValue,
          KdfParallelism: Argon2KdfConfig.PARALLELISM.defaultValue,
        },
        expectedError: /Argon2 iterations must be at least 2/,
      },
      {
        description: "Argon2 memory below minimum",
        response: {
          Kdf: 1,
          KdfIterations: Argon2KdfConfig.ITERATIONS.defaultValue,
          KdfMemory: 15,
          KdfParallelism: Argon2KdfConfig.PARALLELISM.defaultValue,
        },
        expectedError: /Argon2 memory must be at least 16 MiB/,
      },
      {
        description: "Argon2 parallelism below minimum",
        response: {
          Kdf: 1,
          KdfIterations: Argon2KdfConfig.ITERATIONS.defaultValue,
          KdfMemory: Argon2KdfConfig.MEMORY.defaultValue,
          KdfParallelism: 0,
        },
        expectedError: /Argon2 parallelism must be at least 1/,
      },
    ])("throws for $description", ({ response, expectedError }) => {
      expect(() =>
        PasswordPreloginData.fromResponse(new PasswordPreloginResponse(response)),
      ).toThrow(expectedError);
    });
  });
});
