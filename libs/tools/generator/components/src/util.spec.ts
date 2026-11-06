/// SDK/WASM code relies on TextEncoder/TextDecoder being available globally
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextDecoder, TextEncoder });

import { Vendor } from "@bitwarden/common/tools/extension/vendor/data";
import { Algorithm, CredentialPreference } from "@bitwarden/generator-core";

import { getUsernameGeneratorSelection } from "./util";

describe("getUsernameGeneratorSelection", () => {
  const duckDuckGo = { forwarder: Vendor.duckduckgo };

  it.each([
    ["random word", Algorithm.username, new Date(0), new Date(1)],
    ["catch-all email", Algorithm.catchall, new Date(1), new Date(0)],
    ["plus addressed email", Algorithm.plusAddress, new Date(1), new Date(0)],
  ])(
    "preserves the forwarder after selecting %s",
    (_, algorithm, emailUpdated, usernameUpdated) => {
      const preferences = {
        email: {
          algorithm: algorithm === Algorithm.username ? duckDuckGo : algorithm,
          forwarder: duckDuckGo,
          updated: emailUpdated,
        },
        username: {
          algorithm: algorithm === Algorithm.username ? algorithm : Algorithm.username,
          updated: usernameUpdated,
        },
        password: { algorithm: Algorithm.password, updated: new Date(0) },
      } as CredentialPreference;

      expect(getUsernameGeneratorSelection(preferences)).toMatchObject({
        preference: { algorithm },
        forwarder: duckDuckGo,
      });
    },
  );
});
