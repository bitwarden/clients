// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { UserId } from "../../../types/guid";

export abstract class ChangeKdfServiceAbstraction {
  abstract updateUserKdfParams(
    masterPassword: string,
    kdf: KdfConfig,
    userId: UserId,
  ): Promise<void>;
}
