import { WrappedPrivateKey } from "@bitwarden/common/key-management/types";
import { UserKey } from "@bitwarden/common/types/key";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

/**
 * A recovery step performs diagnostics and recovery actions on a specific domain, such as ciphers.
 */
export abstract class RecoveryStep {
  /** Title of the recovery step, as an i18n key. */
  abstract title: string;

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
  encryptedPrivateKey: WrappedPrivateKey | null;
  isPrivateKeyCorrupt: boolean;
  ciphers: Cipher[];
  folders: Folder[];
};
