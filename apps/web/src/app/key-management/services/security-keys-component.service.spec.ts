import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";

import { UserKeyRotationService } from "../key-rotation/user-key-rotation.service";

import { SecurityKeysComponentService } from "./security-keys-component.service";

describe("SecurityKeysComponentService", () => {
  let service: SecurityKeysComponentService;

  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let deviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let userKeyRotationService: MockProxy<UserKeyRotationService>;

  const mockUserId = newGuid() as UserId;

  beforeEach(() => {
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    keyConnectorService = mock<KeyConnectorService>();
    deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    userKeyRotationService = mock<UserKeyRotationService>();

    // Baseline: no decryption options. Each arrangement below adds the ones that it needs.
    userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(false));
    keyConnectorService.getUsesKeyConnector.mockResolvedValue(false);
    keyConnectorService.getManagingOrganization.mockResolvedValue(null as unknown as Organization);
    deviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(false));
    userKeyRotationService.shouldUseSdkKeyRotation$.mockReturnValue(of(true));

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
        { provide: UserKeyRotationService, useValue: userKeyRotationService },
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
    describe("when the user uses SDK key rotation", () => {
      beforeEach(() => {
        userKeyRotationService.shouldUseSdkKeyRotation$.mockReturnValue(of(true));
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

    describe("when the user does not use SDK key rotation", () => {
      beforeEach(() => {
        userKeyRotationService.shouldUseSdkKeyRotation$.mockReturnValue(of(false));
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
  });
});
