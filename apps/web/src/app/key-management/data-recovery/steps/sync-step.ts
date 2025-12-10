import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { FolderData } from "@bitwarden/common/vault/models/data/folder.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

export class SyncStep implements RecoveryStep {
  title = "recoveryStepSyncTitle";

  constructor(private apiService: ApiService) {}

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    // The intent of this step is to fetch the latest data from the server. Diagnostics does not
    // ever run on local data but only remote data that is recent.
    const response = await this.apiService.getSync();

    workingData.ciphers = response.ciphers.map((c) => new Cipher(new CipherData(c)));
    logger.record(`Fetched ${workingData.ciphers.length} ciphers from server`);

    workingData.folders = response.folders.map((f) => new Folder(new FolderData(f)));
    logger.record(`Fetched ${workingData.folders.length} folders from server`);

    workingData.encryptedPrivateKey =
      response.profile?.accountKeys?.publicKeyEncryptionKeyPair?.wrappedPrivateKey ?? null;
    logger.record(
      `Fetched encrypted private key of length ${workingData.encryptedPrivateKey?.length ?? 0} from server`,
    );

    return true;
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    return false;
  }

  runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    return Promise.resolve();
  }
}
