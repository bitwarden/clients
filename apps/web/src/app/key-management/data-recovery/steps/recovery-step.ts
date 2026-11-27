import { UserKey } from "@bitwarden/common/types/key";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

/**
 * A recovery step performs diagnostics and recovery actions on a specific domain, such as ciphers.
 */
export abstract class RecoveryStep {
  /** Title of the recovery step, as an i18n key. */
  abstract title: string;

  /** Localized detail about the outcome, shown under the step once diagnostics have run. */
  message?: string;

  /**
   * Runs diagnostics on the provided working data.
   * Returns true if no issues were found, false otherwise.
   */
  abstract runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean>;

  /**
   * Returns whether recovery can be performed
   */
  abstract canRecover(workingData: RecoveryWorkingData): boolean;

  /**
   * Performs recovery on the provided working data.
   */
  abstract runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void>;
}

/**
 * Data used during the recovery process, passed between steps.
 */
export type RecoveryWorkingData = {
  userId: UserId | null;
  userKey: UserKey | null;
  isPrivateKeyCorrupt: boolean;
  ciphers: Cipher[];
  /**
   * Ciphers that fully decrypt, filled in by the cipher step. Follows the strict-decryption
   * setting: with it on, an item with any undecryptable field is left out. `null` when the cipher
   * step couldn't decrypt at all, so later steps can tell "nothing decrypted" from "didn't run".
   */
  decryptedCiphers: CipherView[] | null;
  folders: Folder[];
};
