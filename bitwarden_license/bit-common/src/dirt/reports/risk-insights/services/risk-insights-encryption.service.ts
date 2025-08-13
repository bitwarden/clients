import { firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { EncryptedDataWithKey } from "../models/password-health";

/**
 * Service for encrypting and decrypting risk insights report data.
 */
export class RiskInsightsEncryptionService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private keyGeneratorService: KeyGenerationService,
  ) {}

  /**
   * Encrypts the risk insights report data for a specific organization.
   * @param organizationId The ID of the organization.
   * @param userId The ID of the user.
   * @param data The data to encrypt.
   * @returns A promise that resolves to the encrypted data with the encryption key.
   */
  async encryptRiskInsightsReport<T>(
    organizationId: OrganizationId,
    userId: UserId,
    data: T,
  ): Promise<EncryptedDataWithKey> {
    const orgKey = await firstValueFrom(
      this.keyService
        .orgKeys$(userId)
        .pipe(
          map((organizationKeysById) =>
            organizationKeysById ? organizationKeysById[organizationId] : null,
          ),
        ),
    );

    if (!orgKey) {
      throw new Error("Organization key not found");
    }

    const contentEncryptionKey = await this.keyGeneratorService.createKey(512);

    const dataEncrypted = await this.encryptService.encryptString(
      JSON.stringify(data),
      contentEncryptionKey,
    );

    const wrappedEncryptionKey = await this.encryptService.wrapSymmetricKey(
      contentEncryptionKey,
      orgKey,
    );

    if (!dataEncrypted.encryptedString || !wrappedEncryptionKey.encryptedString) {
      throw new Error("Encryption failed, encrypted strings are null");
    }

    const encryptedData = dataEncrypted.encryptedString;
    const encryptionKey = wrappedEncryptionKey.encryptedString;

    const encryptedDataPacket = {
      organizationId,
      encryptedData,
      contentEncryptionKey: encryptionKey,
    };

    return encryptedDataPacket;
  }

  /**
   * Decrypts the risk insights report data for a specific organization.
   * @param organizationId The ID of the organization.
   * @param userId The ID of the user.
   * @param encryptedData The encrypted data to decrypt.
   * @param wrappedKey The wrapped encryption key.
   * @param parser A function to parse the decrypted JSON data.
   * @returns A promise that resolves to the decrypted data or null if decryption fails.
   */
  async decryptRiskInsightsReport<T>(
    organizationId: OrganizationId,
    userId: UserId,
    encryptedData: EncString,
    wrappedKey: EncString,
    parser: (data: Jsonify<T>) => T,
  ): Promise<T | null> {
    try {
      const orgKey = await firstValueFrom(
        this.keyService
          .orgKeys$(userId)
          .pipe(
            map((organizationKeysById) =>
              organizationKeysById ? organizationKeysById[organizationId] : null,
            ),
          ),
      );

      if (!orgKey) {
        throw new Error("Organization key not found");
      }

      const unwrappedEncryptionKey = await this.encryptService.unwrapSymmetricKey(
        wrappedKey,
        orgKey,
      );

      const dataUnencrypted = await this.encryptService.decryptString(
        encryptedData,
        unwrappedEncryptionKey,
      );

      const dataUnencryptedJson = parser(JSON.parse(dataUnencrypted));

      return dataUnencryptedJson as T;
    } catch {
      return null;
    }
  }
}
