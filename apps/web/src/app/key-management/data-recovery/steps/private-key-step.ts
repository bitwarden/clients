import { firstValueFrom } from "rxjs";

import { EncryptionType } from "@bitwarden/common/platform/enums";
import { DialogService } from "@bitwarden/components";
import { KeyService, UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

export class PrivateKeyStep extends RecoveryStep {
  title = "recoveryStepPrivateKeyTitle";

  constructor(
    private keyService: KeyService,
    private privateKeyRegenerationService: UserAsymmetricKeysRegenerationService,
    private dialogService: DialogService,
  ) {
    super();
  }

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    if (!workingData.userId || !workingData.userKey) {
      logger.record("Missing user ID or user key");
      return false;
    }

    // Make sure the private key decrypts properly and is not somehow encrypted by a different user key / broken during key rotation.
    const encryptedPrivateKey = await firstValueFrom(
      this.keyService.userEncryptedPrivateKey$(workingData.userId),
    );
    if (!encryptedPrivateKey) {
      logger.record("No encrypted private key found");
      return false;
    }
    logger.record("Private key length: " + encryptedPrivateKey.length);
    try {
      PureCrypto.unwrap_decapsulation_key(encryptedPrivateKey, workingData.userKey.toEncoded());
    } catch {
      logger.record("Private key was un-decryptable");
      return false;
    }

    // Make sure the contained private key can be parsed and the public key can be derived. If not, then the private key may be corrupt / generated with an incompatible ASN.1 representation / with incompatible padding.
    try {
      const publicKey = PureCrypto.rsa_extract_public_key(
        encryptedPrivateKey,
        workingData.userKey.toEncoded(),
      );
      logger.record("Public key length: " + publicKey.length);
    } catch {
      logger.record("Public key could not be derived; private key is corrupt");
      return false;
    }

    return true;
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    // Only support recovery on V1 users.
    return (
      workingData.isPrivateKeyCorrupt &&
      workingData.userKey !== null &&
      workingData.userKey.inner().type === EncryptionType.AesCbc256_HmacSha256_B64
    );
  }

  async runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    // The recovery step is to replace the key pair. This will break emergency access enrollments / organization memberships / provider memberships.
    logger.record("Showing confirmation dialog for private key replacement");

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "recoveryReplacePrivateKeyTitle" },
      content: { key: "recoveryReplacePrivateKeyDesc" },
      acceptButtonText: { key: "ok" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      logger.record("User cancelled private key replacement");
      throw new Error("Private key recovery cancelled by user");
    }

    logger.record("Replacing private key");
    await this.privateKeyRegenerationService.regenerateUserPublicKeyEncryptionKeyPair(
      workingData.userId!,
    );
    logger.record("Private key replaced successfully");
  }
}
