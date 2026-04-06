import { Jsonify } from "type-fest";

import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { BufferedKeyDefinition } from "@bitwarden/common/tools/state/buffered-key-definition";
import { SecretClassifier } from "@bitwarden/common/tools/state/secret-classifier";
import { SecretKeyDefinition } from "@bitwarden/common/tools/state/secret-key-definition";

import { GeneratedCredential } from "./generated-credential";
import { GeneratedPasswordHistory } from "./generated-password-history";
import { LegacyPasswordHistoryDecryptor } from "./legacy-password-history-decryptor";

/** encrypted password generation history */
export const GENERATOR_HISTORY = SecretKeyDefinition.array(
  GENERATOR_DISK,
  "localGeneratorHistory",
  SecretClassifier.allSecret<GeneratedCredential>(),
  {
    deserializer: GeneratedCredential.fromJSON,
    clearOn: ["logout"],
  },
);

/** encrypted password generation history subject to migration */
export const GENERATOR_HISTORY_BUFFER = new BufferedKeyDefinition<
  GeneratedPasswordHistory[],
  GeneratedCredential[],
  LegacyPasswordHistoryDecryptor
>(GENERATOR_DISK, "localGeneratorHistoryBuffer", {
  deserializer(history) {
    const items = history as Jsonify<GeneratedPasswordHistory>[];
    return items?.map((h) => new GeneratedPasswordHistory(h.password, h.date));
  },
  async isValid(history) {
    return history.length ? true : false;
  },
  async map(history, decryptor) {
    const credentials = await decryptor.decrypt(history);
    const mapped = credentials.map((c) => new GeneratedCredential(c.password, "password", c.date));
    return mapped;
  },
  clearOn: ["logout"],
});
