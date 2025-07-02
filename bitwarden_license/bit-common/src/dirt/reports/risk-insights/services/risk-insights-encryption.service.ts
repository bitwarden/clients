import { firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
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
        .pipe(map((organizationKeysById) => organizationKeysById[organizationId])),
    );

    if (orgKey === null) {
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

    const encryptedDataPacket = {
      organizationId: organizationId,
      encryptedData: dataEncrypted.encryptedString,
      encryptionKey: wrappedEncryptionKey.encryptedString,
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
          .pipe(map((organizationKeysById) => organizationKeysById[organizationId])),
      );

      if (orgKey === null) {
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
