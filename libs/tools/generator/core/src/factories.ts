// contains logic that constructs generator services dynamically given
// a generator id.

import { KeyService } from "@bitwarden/key-management";

import { Randomizer } from "./abstractions";
import { KeyServiceRandomizer } from "./engine/crypto-service-randomizer";

export function createRandomizer(keyService: KeyService): Randomizer {
  return new KeyServiceRandomizer(keyService);
}
