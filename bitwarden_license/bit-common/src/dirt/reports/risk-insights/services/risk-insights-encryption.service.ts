import { firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { EncryptedDataWithKey } from "../models/password-health";

export class RiskInsightsEncryptionService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private keyGeneratorService: KeyGenerationService,
  ) {}

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
      organizationId: organizationId,
      encryptedData: encryptedData,
      encryptionKey: encryptionKey,
    };

    return encryptedDataPacket;
  }

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
