import { Argon2KdfConfig, KdfConfig, KdfType } from "@bitwarden/key-management";

export class MasterPasswordUnlockDataRequest {
  kdfType: KdfType = KdfType.PBKDF2_SHA256;
  kdfIterations: number = 0;
  kdfMemory?: number;
  kdfParallelism?: number;

  email: string;
  masterKeyAuthenticationHash: string;

  masterKeyEncryptedUserKey: string;

  masterPasswordHint?: string;

  constructor(
    kdfConfig: KdfConfig,
    email: string,
    masterKeyAuthenticationHash: string,
    masterKeyEncryptedUserKey: string,
    masterPasswordHash?: string,
  ) {
    this.kdfType = kdfConfig.kdfType;
    this.kdfIterations = kdfConfig.iterations;
    if (kdfConfig.kdfType === KdfType.Argon2id) {
      this.kdfMemory = (kdfConfig as Argon2KdfConfig).memory;
      this.kdfParallelism = (kdfConfig as Argon2KdfConfig).parallelism;
    }

    this.email = email;
    this.masterKeyAuthenticationHash = masterKeyAuthenticationHash;
    this.masterKeyEncryptedUserKey = masterKeyEncryptedUserKey;
    this.masterPasswordHint = masterPasswordHash;
  }
}
