import { UserKey } from "@bitwarden/common/types/key";

export abstract class PinServiceAbstraction {
  decryptUserKeyWithPin: (pin: string) => Promise<UserKey | null>;
}
