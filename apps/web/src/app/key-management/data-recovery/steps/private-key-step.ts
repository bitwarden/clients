import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { DialogService } from "@bitwarden/components";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

export class PrivateKeyStep implements RecoveryStep {
  title = "recoveryStepPrivateKeyTitle";

  constructor(
    private privateKeyRegenerationService: UserAsymmetricKeysRegenerationService,
    private dialogService: DialogService,
    private cryptoFunctionService: CryptoFunctionService,
  ) {}

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    if (!workingData.userId || !workingData.userKey) {
      logger.record("Missing user ID or user key");
      return false;
    }

    // Make sure the private key decrypts properly and is not somehow encrypted by a different user key / broken during key rotation.
    const encryptedPrivateKey = workingData.encryptedPrivateKey;
    if (!encryptedPrivateKey) {
      logger.record("No encrypted private key found");
      return false;
    }
    logger.record("Private key length: " + encryptedPrivateKey.length);
    let privateKey: Uint8Array;
    try {
      await SdkLoadService.Ready;
      privateKey = PureCrypto.unwrap_decapsulation_key(
        encryptedPrivateKey,
        workingData.userKey.toEncoded(),
      );
    } catch {
      logger.record("Private key was un-decryptable");
      workingData.isPrivateKeyCorrupt = true;
      return false;
    }

    // Make sure the contained private key can be parsed and the public key can be derived. If not, then the private key may be corrupt / generated with an incompatible ASN.1 representation / with incompatible padding.
    try {
      const publicKey = await this.cryptoFunctionService.rsaExtractPublicKey(privateKey);
      logger.record("Public key length: " + publicKey.length);
    } catch {
      logger.record("Public key could not be derived; private key is corrupt");
      workingData.isPrivateKeyCorrupt = true;
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
    // The recovery step is to replace the key pair. Currently, this only works if the user is not using emergency access or is part of an organization.
    // This is because this will break emergency access enrollments / organization memberships / provider memberships.
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
    const recovered =
      await this.privateKeyRegenerationService.regenerateUserPublicKeyEncryptionKeyPair(
        workingData.userId!,
      );
    if (!recovered) {
      logger.record("Private key replacement could not be performed");
    } else {
      logger.record("Private key replacement replaced successfully");
    }
  }
}
