// Polyfill for Symbol.dispose required by the service's use of `using` keyword
import "core-js/proposals/explicit-resource-management";

import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinStateServiceAbstraction } from "@bitwarden/common/key-management/pin/pin-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KdfConfigService } from "@bitwarden/key-management";

import { DefaultUnlockService } from "./default-unlock.service";

const mockUserId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;
const mockEmail = "test@example.com";
const mockPin = "1234";
const mockMasterPassword = "master-password";
const mockKdfParams = { type: "pbkdf2" } as any;
const mockAccountCryptographicState = { some: "state" } as any;
const mockPinProtectedUserKeyEnvelope = { some: "envelope" } as any;
const mockMasterPasswordUnlockData = { some: "unlockData" } as any;

describe("DefaultUnlockService", () => {
  const registerSdkService = mock<RegisterSdkService>();
  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  const pinStateService = mock<PinStateServiceAbstraction>();
  const kdfService = mock<KdfConfigService>();
  const accountService = mock<AccountService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();

  let service: DefaultUnlockService;
  let mockSdkRef: any;
  let mockSdk: any;
  let mockCrypto: any;

  beforeEach(() => {
    jest.resetAllMocks();

    mockCrypto = {
      initialize_user_crypto: jest.fn().mockResolvedValue(undefined),
    };

    mockSdkRef = {
      value: {
        crypto: jest.fn().mockReturnValue(mockCrypto),
      },
      [Symbol.dispose]: jest.fn(),
    };

    mockSdk = {
      take: jest.fn().mockReturnValue(mockSdkRef),
    };

    registerSdkService.registerClient$.mockReturnValue(of(mockSdk));
    accountCryptographicStateService.accountCryptographicState$.mockReturnValue(
      of(mockAccountCryptographicState),
    );
    kdfService.getKdfConfig$.mockReturnValue(of({ toSdkConfig: () => mockKdfParams } as any));
    accountService.accounts$ = of({
      [mockUserId]: { email: mockEmail },
    } as any);
    pinStateService.getPinLockType.mockResolvedValue("PERSISTENT" as any);
    pinStateService.getPinProtectedUserKeyEnvelope.mockResolvedValue(
      mockPinProtectedUserKeyEnvelope,
    );
    masterPasswordService.masterPasswordUnlockData$.mockReturnValue(
      of({ toSdk: () => mockMasterPasswordUnlockData } as any),
    );

    service = new DefaultUnlockService(
      registerSdkService,
      accountCryptographicStateService,
      pinStateService,
      kdfService,
      accountService,
      masterPasswordService,
    );
  });

  describe("unlockWithPin", () => {
    it("calls SDK initialize_user_crypto with correct pin method", async () => {
      await service.unlockWithPin(mockUserId, mockPin);

      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith({
        userId: mockUserId,
        kdfParams: mockKdfParams,
        email: mockEmail,
        accountCryptographicState: mockAccountCryptographicState,
        method: {
          pinEnvelope: {
            pin: mockPin,
            pin_protected_user_key_envelope: mockPinProtectedUserKeyEnvelope,
          },
        },
      });
    });

    it("throws when SDK is not available", async () => {
      registerSdkService.registerClient$.mockReturnValue(of(null as any));

      await expect(service.unlockWithPin(mockUserId, mockPin)).rejects.toThrow("SDK not available");
    });

    it("fetches PERSISTENT pin envelope when the pin lock type is persistent", async () => {
      pinStateService.getPinLockType.mockResolvedValue("PERSISTENT" as any);
      await service.unlockWithPin(mockUserId, mockPin);
      expect(pinStateService.getPinProtectedUserKeyEnvelope).toHaveBeenCalledWith(
        mockUserId,
        "PERSISTENT",
      );
    });

    it("fetches EPHEMERAL pin envelope when the pin lock type is ephemeral", async () => {
      pinStateService.getPinLockType.mockResolvedValue("EPHEMERAL" as any);
      await service.unlockWithPin(mockUserId, mockPin);
      expect(pinStateService.getPinProtectedUserKeyEnvelope).toHaveBeenCalledWith(
        mockUserId,
        "EPHEMERAL",
      );
    });
  });

  describe("unlockWithMasterPassword", () => {
    it("calls SDK initialize_user_crypto with correct master password method", async () => {
      await service.unlockWithMasterPassword(mockUserId, mockMasterPassword);

      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith({
        userId: mockUserId,
        kdfParams: mockKdfParams,
        email: mockEmail,
        accountCryptographicState: mockAccountCryptographicState,
        method: {
          masterPasswordUnlock: {
            password: mockMasterPassword,
            master_password_unlock: mockMasterPasswordUnlockData,
          },
        },
      });
    });

    it("throws when SDK is not available", async () => {
      registerSdkService.registerClient$.mockReturnValue(of(null as any));

      await expect(
        service.unlockWithMasterPassword(mockUserId, mockMasterPassword),
      ).rejects.toThrow("SDK not available");
    });
  });
});
