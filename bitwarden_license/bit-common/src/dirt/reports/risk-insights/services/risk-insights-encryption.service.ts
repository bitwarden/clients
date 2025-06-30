import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";
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
    data: T,
  ): Promise<EncryptedDataWithKey> {
    const orgKey = await this.keyService.getOrgKey(organizationId as string);
    if (orgKey === null) {
      throw new Error("Organization key not found");
    }

    const encryptionKey = await this.keyGeneratorService.createKey(512);

    const dataEncrypted = await this.encryptService.encryptString(
      JSON.stringify(data),
      encryptionKey,
    );

    const wrappedEncryptionKey = await this.encryptService.wrapSymmetricKey(encryptionKey, orgKey);

    const encryptedDataPacket = {
      organizationId: organizationId,
      encryptedData: dataEncrypted.encryptedString,
      encryptionKey: wrappedEncryptionKey.encryptedString,
    };

    return encryptedDataPacket;
  }

  async decryptRiskInsightsReport<T>(
    organizationId: OrganizationId,
    encryptedData: string,
    key: string,
  ): Promise<T | null> {
    try {
      const orgKey = await this.keyService.getOrgKey(organizationId as string);
      if (orgKey === null) {
        throw new Error("Organization key not found");
      }

      const dataEncrypted = encryptedData;
      const wrappedEncryptionKey = key;

      const unwrappedEncryptionKey = await this.encryptService.unwrapSymmetricKey(
        new EncString(wrappedEncryptionKey),
        orgKey,
      );

      const dataUnencrypted = await this.encryptService.decryptString(
        new EncString(dataEncrypted),
        unwrappedEncryptionKey,
      );

      const dataUnencryptedJson = JSON.parse(dataUnencrypted);

      return dataUnencryptedJson as T;
    } catch {
      return null;
    }
  }
}
