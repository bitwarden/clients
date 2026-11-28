import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptionType } from "@bitwarden/legacy-crypto";

import { SecurityKeysComponentService } from "./security-keys-component.service";

describe("SecurityKeysComponentService", () => {
  let service: SecurityKeysComponentService;

  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let deviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let keyService: MockProxy<KeyService>;
  let configService: MockProxy<ConfigService>;

  const mockUserId = newGuid() as UserId;

  const userKeyOfType = (type: EncryptionType) => ({ inner: () => ({ type }) }) as UserKey;
  const v1UserKey = userKeyOfType(EncryptionType.AesCbc256_HmacSha256_B64);
  const v2UserKey = userKeyOfType(EncryptionType.CoseEncrypt0);

  beforeEach(() => {
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    keyConnectorService = mock<KeyConnectorService>();
    deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    keyService = mock<KeyService>();
    configService = mock<ConfigService>();

    // Baseline: no decryption options. Each arrangement below adds the ones that it needs.
    userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(false));
    keyConnectorService.getUsesKeyConnector.mockResolvedValue(false);
    keyConnectorService.getManagingOrganization.mockResolvedValue(null as unknown as Organization);
    deviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(false));
    keyService.userKey$.mockReturnValue(of(v2UserKey));
    configService.getFeatureFlag$.mockReturnValue(of(false));

    TestBed.configureTestingModule({
      providers: [
        SecurityKeysComponentService,
        { provide: AccountService, useValue: mockAccountServiceWith(mockUserId) },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: userDecryptionOptionsService,
        },
        { provide: KeyConnectorService, useValue: keyConnectorService },
        { provide: DeviceTrustServiceAbstraction, useValue: deviceTrustService },
        { provide: KeyService, useValue: keyService },
        { provide: ConfigService, useValue: configService },
      ],
    });
  });

  function createService() {
    service = TestBed.inject(SecurityKeysComponentService);
    return service;
  }

  describe("showChangeKdf$", () => {
    it("shows the KDF settings for a master password user", async () => {
      userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));

      const showChangeKdf = await firstValueFrom(createService().showChangeKdf$);

      expect(showChangeKdf).toBe(true);
    });

    it("hides the KDF settings for a user without a master password", async () => {
      userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(false));

      const showChangeKdf = await firstValueFrom(createService().showChangeKdf$);

      expect(showChangeKdf).toBe(false);
    });
  });

  describe("showKeyRotation$", () => {
    describe("when the rotation keeps the user's key version", () => {
      beforeEach(() => {
        keyService.userKey$.mockReturnValue(of(v2UserKey));
      });

      it("shows key rotation for a master password user", async () => {
        userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));

        const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

        expect(showKeyRotation).toBe(true);
      });

      it("shows key rotation for a Key Connector user with a managing organization", async () => {
        keyConnectorService.getUsesKeyConnector.mockResolvedValue(true);
        keyConnectorService.getManagingOrganization.mockResolvedValue({} as Organization);

        const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

        expect(showKeyRotation).toBe(true);
      });

      it("shows key rotation for a TDE user", async () => {
        deviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(true));

        const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

        expect(showKeyRotation).toBe(true);
      });

      it("hides key rotation for a Key Connector user without a managing organization", async () => {
        keyConnectorService.getUsesKeyConnector.mockResolvedValue(true);

        const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

        expect(showKeyRotation).toBe(false);
      });
    });

    describe("when the rotation would upgrade a V1 user without force-upgrade-v2-encryption", () => {
      beforeEach(() => {
        keyService.userKey$.mockReturnValue(of(v1UserKey));
        configService.getFeatureFlag$.mockReturnValue(of(false));
      });

      it("hides key rotation for a master password user", async () => {
        userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));

        const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

        expect(showKeyRotation).toBe(false);
      });

      it("hides key rotation for a Key Connector user with a managing organization", async () => {
        keyConnectorService.getUsesKeyConnector.mockResolvedValue(true);
        keyConnectorService.getManagingOrganization.mockResolvedValue({} as Organization);

        const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

        expect(showKeyRotation).toBe(false);
      });

      it("hides key rotation for a TDE user", async () => {
        deviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(true));

        const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

        expect(showKeyRotation).toBe(false);
      });

      it("hides key rotation for a Key Connector user without a managing organization", async () => {
        keyConnectorService.getUsesKeyConnector.mockResolvedValue(true);

        const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

        expect(showKeyRotation).toBe(false);
      });
    });

    it("shows key rotation for a V1 master password user with force-upgrade-v2-encryption", async () => {
      userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));
      keyService.userKey$.mockReturnValue(of(v1UserKey));
      configService.getFeatureFlag$.mockReturnValue(of(true));

      const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

      expect(showKeyRotation).toBe(true);
      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.ForceUpgradeV2Encryption,
      );
    });

    it("hides key rotation when the user key is not available", async () => {
      userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));
      keyService.userKey$.mockReturnValue(of(null));

      const showKeyRotation = await firstValueFrom(createService().showKeyRotation$);

      expect(showKeyRotation).toBe(false);
    });
  });
});
