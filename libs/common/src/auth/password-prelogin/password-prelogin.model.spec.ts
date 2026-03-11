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
        response: { Kdf: 0, KdfIterations: 600000 },
        expected: new PasswordPreloginData(new PBKDF2KdfConfig(600000)),
      },
      {
        description: "Argon2",
        response: { Kdf: 1, KdfIterations: 3, KdfMemory: 64, KdfParallelism: 4 },
        expected: new PasswordPreloginData(new Argon2KdfConfig(3, 64, 4)),
      },
    ])("maps a $description response to a PasswordPreloginData", ({ response, expected }) => {
      const result = PasswordPreloginData.fromResponse(new PasswordPreloginResponse(response));

      expect(result).toEqual(expected);
    });
  });
});
