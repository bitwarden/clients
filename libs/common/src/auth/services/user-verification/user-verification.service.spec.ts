import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  BiometricsService,
  BiometricsStatus,
  KdfConfig,
  KeyService,
  KdfConfigService,
} from "@bitwarden/key-management";

import { FakeAccountService, mockAccountServiceWith } from "../../../../spec";
import { InternalMasterPasswordServiceAbstraction } from "../../../key-management/master-password/abstractions/master-password.service.abstraction";
import { PinLockType } from "../../../key-management/pin/pin-lock-type";
import { PinServiceAbstraction } from "../../../key-management/pin/pin.service.abstraction";
import { VaultTimeoutSettingsService } from "../../../key-management/vault-timeout";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { HashPurpose } from "../../../platform/enums";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { MasterKey } from "../../../types/key";
import { UserVerificationApiServiceAbstraction } from "../../abstractions/user-verification/user-verification-api.service.abstraction";
import { VerificationType } from "../../enums/verification-type";
import { MasterPasswordPolicyResponse } from "../../models/response/master-password-policy.response";
import { MasterPasswordVerification } from "../../types/verification";

import { UserVerificationService } from "./user-verification.service";

describe("UserVerificationService", () => {
  let sut: UserVerificationService;

  const keyService = mock<KeyService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const i18nService = mock<I18nService>();
  const userVerificationApiService = mock<UserVerificationApiServiceAbstraction>();
  const userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
  const pinService = mock<PinServiceAbstraction>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const kdfConfigService = mock<KdfConfigService>();
  const biometricsService = mock<BiometricsService>();

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;

  beforeEach(() => {
    jest.clearAllMocks();
    accountService = mockAccountServiceWith(mockUserId);

    sut = new UserVerificationService(
      keyService,
      accountService,
      masterPasswordService,
      i18nService,
      userVerificationApiService,
      userDecryptionOptionsService,
      pinService,
      kdfConfigService,
      biometricsService,
    );
  });

  describe("getAvailableVerificationOptions", () => {
    describe("client verification type", () => {
      it("correctly returns master password availability", async () => {
        setMasterPasswordAvailability(true);
        setPinAvailability("DISABLED");
        disableBiometricsAvailability();

        const result = await sut.getAvailableVerificationOptions("client");

        expect(result).toEqual({
          client: {
            masterPassword: true,
            pin: false,
            biometrics: false,
          },
          server: {
            masterPassword: false,
            otp: false,
          },
        });
      });

      test.each([
        [true, "PERSISTENT"],
        [true, "EPHEMERAL"],
        [false, "DISABLED"],
      ])(
        "returns %s for PIN availability when pin lock type is %s",
        async (expectedPin: boolean, pinLockType: PinLockType) => {
          setMasterPasswordAvailability(false);
          setPinAvailability(pinLockType);
          disableBiometricsAvailability();

          const result = await sut.getAvailableVerificationOptions("client");

          expect(result).toEqual({
            client: {
              masterPassword: false,
              pin: expectedPin,
              biometrics: false,
            },
            server: {
              masterPassword: false,
              otp: false,
            },
          });
        },
      );

      test.each([
        [true, BiometricsStatus.Available],
        [false, BiometricsStatus.DesktopDisconnected],
        [false, BiometricsStatus.HardwareUnavailable],
      ])(
        "returns %s for biometrics availability when isBiometricLockSet is %s, hasUserKeyStored is %s, and supportsSecureStorage is %s",
        async (expectedReturn: boolean, biometricsStatus: BiometricsStatus) => {
          setMasterPasswordAvailability(false);
          setPinAvailability("DISABLED");
          biometricsService.getBiometricsStatus.mockResolvedValue(biometricsStatus);

          const result = await sut.getAvailableVerificationOptions("client");

          expect(result).toEqual({
            client: {
              masterPassword: false,
              pin: false,
              biometrics: expectedReturn,
            },
            server: {
              masterPassword: false,
              otp: false,
            },
          });
        },
      );
    });

    describe("server verification type", () => {
      it("correctly returns master password availability", async () => {
        userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
          of({
            hasMasterPassword: true,
          } as UserDecryptionOptions),
        );

        const result = await sut.getAvailableVerificationOptions("server");

        expect(result).toEqual({
          client: {
            masterPassword: false,
            pin: false,
            biometrics: false,
          },
          server: {
            masterPassword: true,
            otp: false,
          },
        });
      });

      it("correctly returns OTP availability", async () => {
        userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
          of({
            hasMasterPassword: false,
          } as UserDecryptionOptions),
        );

        const result = await sut.getAvailableVerificationOptions("server");

        expect(result).toEqual({
          client: {
            masterPassword: false,
            pin: false,
            biometrics: false,
          },
          server: {
            masterPassword: false,
            otp: true,
          },
        });
      });
    });
  });

  describe("verifyUserByMasterPassword", () => {
    beforeAll(() => {
      i18nService.t.calledWith("invalidMasterPassword").mockReturnValue("Invalid master password");

      kdfConfigService.getKdfConfig.mockResolvedValue("kdfConfig" as unknown as KdfConfig);
      masterPasswordService.masterKey$.mockReturnValue(of("masterKey" as unknown as MasterKey));
      keyService.hashMasterKey
        .calledWith("password", "masterKey" as unknown as MasterKey, HashPurpose.LocalAuthorization)
        .mockResolvedValue("localHash");
    });

    describe("client-side verification", () => {
      beforeEach(() => {
        setMasterPasswordAvailability(true);
      });

      it("returns if verification is successful", async () => {
        keyService.compareKeyHash.mockResolvedValueOnce(true);

        const result = await sut.verifyUserByMasterPassword(
          {
            type: VerificationType.MasterPassword,
            secret: "password",
          } as MasterPasswordVerification,
          mockUserId,
          "email",
        );

        expect(keyService.compareKeyHash).toHaveBeenCalled();
        expect(masterPasswordService.setMasterKeyHash).toHaveBeenCalledWith(
          "localHash",
          mockUserId,
        );
        expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith("masterKey", mockUserId);
        expect(result).toEqual({
          policyOptions: null,
          masterKey: "masterKey",
          kdfConfig: "kdfConfig",
          email: "email",
        });
      });

      it("throws if verification fails", async () => {
        keyService.compareKeyHash.mockResolvedValueOnce(false);

        await expect(
          sut.verifyUserByMasterPassword(
            {
              type: VerificationType.MasterPassword,
              secret: "password",
            } as MasterPasswordVerification,
            mockUserId,
            "email",
          ),
        ).rejects.toThrow("Invalid master password");

        expect(keyService.compareKeyHash).toHaveBeenCalled();
        expect(masterPasswordService.setMasterKeyHash).not.toHaveBeenCalledWith();
        expect(masterPasswordService.setMasterKey).not.toHaveBeenCalledWith();
      });
    });

    describe("server-side verification", () => {
      beforeEach(() => {
        setMasterPasswordAvailability(false);
      });

      it("returns if verification is successful", async () => {
        keyService.hashMasterKey
          .calledWith(
            "password",
            "masterKey" as unknown as MasterKey,
            HashPurpose.ServerAuthorization,
          )
          .mockResolvedValueOnce("serverHash");
        userVerificationApiService.postAccountVerifyPassword.mockResolvedValueOnce(
          "MasterPasswordPolicyOptions" as unknown as MasterPasswordPolicyResponse,
        );

        const result = await sut.verifyUserByMasterPassword(
          {
            type: VerificationType.MasterPassword,
            secret: "password",
          } as MasterPasswordVerification,
          mockUserId,
          "email",
        );

        expect(keyService.compareKeyHash).not.toHaveBeenCalled();
        expect(masterPasswordService.setMasterKeyHash).toHaveBeenCalledWith(
          "localHash",
          mockUserId,
        );
        expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith("masterKey", mockUserId);
        expect(result).toEqual({
          policyOptions: "MasterPasswordPolicyOptions",
          masterKey: "masterKey",
          kdfConfig: "kdfConfig",
          email: "email",
        });
      });

      it("throws if verification fails", async () => {
        keyService.hashMasterKey
          .calledWith(
            "password",
            "masterKey" as unknown as MasterKey,
            HashPurpose.ServerAuthorization,
          )
          .mockResolvedValueOnce("serverHash");
        userVerificationApiService.postAccountVerifyPassword.mockRejectedValueOnce(new Error());

        await expect(
          sut.verifyUserByMasterPassword(
            {
              type: VerificationType.MasterPassword,
              secret: "password",
            } as MasterPasswordVerification,
            mockUserId,
            "email",
          ),
        ).rejects.toThrow("Invalid master password");

        expect(keyService.compareKeyHash).not.toHaveBeenCalled();
        expect(masterPasswordService.setMasterKeyHash).not.toHaveBeenCalledWith();
        expect(masterPasswordService.setMasterKey).not.toHaveBeenCalledWith();
      });
    });

    describe("error handling", () => {
      it("throws if any of the parameters are nullish", async () => {
        await expect(
          sut.verifyUserByMasterPassword(
            {
              type: VerificationType.MasterPassword,
              secret: null,
            } as MasterPasswordVerification,
            mockUserId,
            "email",
          ),
        ).rejects.toThrow(
          "Master Password is required. Cannot verify user without a master password.",
        );

        await expect(
          sut.verifyUserByMasterPassword(
            {
              type: VerificationType.MasterPassword,
              secret: "password",
            } as MasterPasswordVerification,
            null,
            "email",
          ),
        ).rejects.toThrow("User ID is required. Cannot verify user by master password.");

        await expect(
          sut.verifyUserByMasterPassword(
            {
              type: VerificationType.MasterPassword,
              secret: "password",
            } as MasterPasswordVerification,
            mockUserId,
            null,
          ),
        ).rejects.toThrow("Email is required. Cannot verify user by master password.");
      });

      it("throws if kdf config is not available", async () => {
        kdfConfigService.getKdfConfig.mockResolvedValueOnce(null);

        await expect(
          sut.verifyUserByMasterPassword(
            {
              type: VerificationType.MasterPassword,
              secret: "password",
            } as MasterPasswordVerification,
            mockUserId,
            "email",
          ),
        ).rejects.toThrow("KDF config is required. Cannot verify user by master password.");
      });

      it("throws if master key cannot be created", async () => {
        kdfConfigService.getKdfConfig.mockResolvedValueOnce("kdfConfig" as unknown as KdfConfig);
        masterPasswordService.masterKey$.mockReturnValueOnce(of(null));
        keyService.makeMasterKey.mockResolvedValueOnce(null);

        await expect(
          sut.verifyUserByMasterPassword(
            {
              type: VerificationType.MasterPassword,
              secret: "password",
            } as MasterPasswordVerification,
            mockUserId,
            "email",
          ),
        ).rejects.toThrow("Master key could not be created to verify the master password.");
      });
    });
  });

  // Helpers
  function setMasterPasswordAvailability(hasMasterPassword: boolean) {
    userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
      of({
        hasMasterPassword: hasMasterPassword,
      } as UserDecryptionOptions),
    );
    masterPasswordService.masterKeyHash$.mockReturnValue(
      of(hasMasterPassword ? "masterKeyHash" : null),
    );
  }

  function setPinAvailability(type: PinLockType) {
    pinService.getPinLockType.mockResolvedValue(type);

    if (type === "EPHEMERAL" || type === "PERSISTENT") {
      pinService.isPinDecryptionAvailable.mockResolvedValue(true);
    } else if (type === "DISABLED") {
      pinService.isPinDecryptionAvailable.mockResolvedValue(false);
    }
  }

  function disableBiometricsAvailability() {
    vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(false);
  }
});
