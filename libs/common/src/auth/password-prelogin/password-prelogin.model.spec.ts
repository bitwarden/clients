// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { PasswordPreloginData } from "./password-prelogin.model";
import { PasswordPreloginResponse } from "./password-prelogin.response";

const salt = "user@example.com";

describe("PasswordPreloginData", () => {
  describe("fromResponse", () => {
    it.each([
      {
        description: "PBKDF2",
        response: {
          KdfSettings: {
            KdfType: 0,
            Iterations: PBKDF2KdfConfig.ITERATIONS.defaultValue,
          },
          Salt: salt,
        },
        expected: new PasswordPreloginData(
          new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.defaultValue),
          salt,
        ),
      },
      {
        description: "Argon2",
        response: {
          KdfSettings: {
            KdfType: 1,
            Iterations: Argon2KdfConfig.ITERATIONS.defaultValue,
            Memory: Argon2KdfConfig.MEMORY.defaultValue,
            Parallelism: Argon2KdfConfig.PARALLELISM.defaultValue,
          },
          Salt: salt,
        },
        expected: new PasswordPreloginData(
          new Argon2KdfConfig(
            Argon2KdfConfig.ITERATIONS.defaultValue,
            Argon2KdfConfig.MEMORY.defaultValue,
            Argon2KdfConfig.PARALLELISM.defaultValue,
          ),
          salt,
        ),
      },
    ])("maps a $description response to a PasswordPreloginData", ({ response, expected }) => {
      const result = PasswordPreloginData.fromResponse(new PasswordPreloginResponse(response));

      expect(result).toEqual(expected);
    });

    it("carries the server-supplied salt through to the model", () => {
      const serverSalt = "  Normalized.Salt@Example.com ";

      const result = PasswordPreloginData.fromResponse(
        new PasswordPreloginResponse({
          KdfSettings: { KdfType: 0, Iterations: PBKDF2KdfConfig.ITERATIONS.defaultValue },
          Salt: serverSalt,
        }),
      );

      // The model is a pass-through: it does not normalize. Callers that derive a key still
      // normalize on their own (LegacyCompatKeyService, MasterPasswordService).
      expect(result.salt).toBe(serverSalt);
    });

    it("maps a camelCase response, matching the casing the server actually serializes", () => {
      const result = PasswordPreloginData.fromResponse(
        new PasswordPreloginResponse({
          kdfSettings: { kdfType: 0, iterations: PBKDF2KdfConfig.ITERATIONS.defaultValue },
          salt,
        }),
      );

      expect(result).toEqual(
        new PasswordPreloginData(
          new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.defaultValue),
          salt,
        ),
      );
    });

    it.each([
      {
        description: "PBKDF2 iterations below minimum",
        response: {
          KdfSettings: { KdfType: 0, Iterations: PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1 },
          Salt: salt,
        },
        expectedError: new RegExp(
          `PBKDF2 iterations must be at least ${PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN}`,
        ),
      },
      {
        description: "Argon2 iterations below minimum",
        response: {
          KdfSettings: {
            KdfType: 1,
            Iterations: Argon2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1,
            Memory: Argon2KdfConfig.MEMORY.defaultValue,
            Parallelism: Argon2KdfConfig.PARALLELISM.defaultValue,
          },
          Salt: salt,
        },
        expectedError: new RegExp(
          `Argon2 iterations must be at least ${Argon2KdfConfig.PRELOGIN_ITERATIONS_MIN}`,
        ),
      },
      {
        description: "Argon2 memory below minimum",
        response: {
          KdfSettings: {
            KdfType: 1,
            Iterations: Argon2KdfConfig.ITERATIONS.defaultValue,
            Memory: Argon2KdfConfig.PRELOGIN_MEMORY_MIN - 1,
            Parallelism: Argon2KdfConfig.PARALLELISM.defaultValue,
          },
          Salt: salt,
        },
        expectedError: new RegExp(
          `Argon2 memory must be at least ${Argon2KdfConfig.PRELOGIN_MEMORY_MIN} MiB`,
        ),
      },
      {
        description: "Argon2 parallelism below minimum",
        response: {
          KdfSettings: {
            KdfType: 1,
            Iterations: Argon2KdfConfig.ITERATIONS.defaultValue,
            Memory: Argon2KdfConfig.MEMORY.defaultValue,
            Parallelism: Argon2KdfConfig.PRELOGIN_PARALLELISM_MIN - 1,
          },
          Salt: salt,
        },
        expectedError: new RegExp(
          `Argon2 parallelism must be at least ${Argon2KdfConfig.PRELOGIN_PARALLELISM_MIN}`,
        ),
      },
    ])("throws for $description", ({ response, expectedError }) => {
      expect(() =>
        PasswordPreloginData.fromResponse(new PasswordPreloginResponse(response)),
      ).toThrow(expectedError);
    });

    it("throws when the response omits KdfSettings entirely", () => {
      expect(() => new PasswordPreloginResponse({ Salt: salt })).toThrow(
        "KDF config response does not contain a valid KDF type",
      );
    });
  });
});
