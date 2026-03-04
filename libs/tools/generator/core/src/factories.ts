// contains logic that constructs generator services dynamically given
// a generator id.

import { Randomizer } from "./abstractions";
import { PureCryptoRandomizer } from "./engine/purecrypto-randomizer";

export function createRandomizer(): Randomizer {
  return new PureCryptoRandomizer();
}
