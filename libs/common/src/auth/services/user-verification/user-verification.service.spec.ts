import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  PinLockType,
  PinServiceAbstraction,
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";

import { FakeAccountService, mockAccountServiceWith } from "../../../../spec";
import { VaultTimeoutSettingsService } from "../../../abstractions/vault-timeout/vault-timeout-settings.service";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { HashPurpose } from "../../../platform/enums";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { MasterKey } from "../../../types/key";
import { KdfConfigService } from "../../abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "../../abstractions/master-password.service.abstraction";
import { UserVerificationApiServiceAbstraction } from "../../abstractions/user-verification/user-verification-api.service.abstraction";
import { VerificationType } from "../../enums/verification-type";
import { KdfConfig } from "../../models/domain/kdf-config";
import { MasterPasswordPolicyResponse } from "../../models/response/master-password-policy.response";
import { MasterPasswordVerification } from "../../types/verification";

import { UserVerificationService } from "./user-verification.service";

describe("UserVerificationService", () => {
  let sut: UserVerificationService;

  const cryptoService = mock<CryptoService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const i18nService = mock<I18nService>();
  const userVerificationApiService = mock<UserVerificationApiServiceAbstraction>();
  const userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
  const pinService = mock<PinServiceAbstraction>();
  const logService = mock<LogService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const kdfConfigService = mock<KdfConfigService>();

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;

  beforeEach(() => {
    jest.clearAllMocks();
    accountService = mockAccountServiceWith(mockUserId);

    sut = new UserVerificationService(
      cryptoService,
      accountService,
      masterPasswordService,
      i18nService,
      userVerificationApiService,
      userDecryptionOptionsService,
      pinService,
      logService,
      vaultTimeoutSettingsService,
      platformUtilsService,
      kdfConfigService,
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
        [true, true, true, true],
        [true, true, true, false],
        [true, true, false, false],
        [false, true, false, true],
        [false, false, false, false],
        [false, false, true, false],
        [false, false, false, true],
      ])(
        "returns %s for biometrics availability when isBiometricLockSet is %s, hasUserKeyStored is %s, and supportsSecureStorage is %s",
        async (
          expectedReturn: boolean,
          isBiometricsLockSet: boolean,
          isBiometricsUserKeyStored: boolean,
          platformSupportSecureStorage: boolean,
        ) => {
          setMasterPasswordAvailability(false);
          setPinAvailability("DISABLED");
          vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(isBiometricsLockSet);
          cryptoService.hasUserKeyStored.mockResolvedValue(isBiometricsUserKeyStored);
          platformUtilsService.supportsSecureStorage.mockReturnValue(platformSupportSecureStorage);

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
      cryptoService.hashMasterKey
        .calledWith("password", "masterKey" as unknown as MasterKey, HashPurpose.LocalAuthorization)
        .mockResolvedValue("localHash");
    });

    describe("client-side verification", () => {
      beforeEach(() => {
        setMasterPasswordAvailability(true);
      });

      it("returns if verification is successful", async () => {
        cryptoService.compareAndUpdateKeyHash.mockResolvedValueOnce(true);

        const result = await sut.verifyUserByMasterPassword(
          {
            type: VerificationType.MasterPassword,
            secret: "password",
          } as MasterPasswordVerification,
          mockUserId,
          "email",
        );

        expect(cryptoService.compareAndUpdateKeyHash).toHaveBeenCalled();
        expect(masterPasswordService.setMasterKeyHash).toHaveBeenCalledWith(
          "localHash",
          mockUserId,
        );
        expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith("masterKey", mockUserId);
        expect(result).toEqual({
          policyOptions: null,
          masterKey: "masterKey",
        });
      });

      it("throws if verification fails", async () => {
        cryptoService.compareAndUpdateKeyHash.mockResolvedValueOnce(false);

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

        expect(cryptoService.compareAndUpdateKeyHash).toHaveBeenCalled();
        expect(masterPasswordService.setMasterKeyHash).not.toHaveBeenCalledWith();
        expect(masterPasswordService.setMasterKey).not.toHaveBeenCalledWith();
      });
    });

    describe("server-side verification", () => {
      beforeEach(() => {
        setMasterPasswordAvailability(false);
      });

      it("returns if verification is successful", async () => {
        cryptoService.hashMasterKey
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

        expect(cryptoService.compareAndUpdateKeyHash).not.toHaveBeenCalled();
        expect(masterPasswordService.setMasterKeyHash).toHaveBeenCalledWith(
          "localHash",
          mockUserId,
        );
        expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith("masterKey", mockUserId);
        expect(result).toEqual({
          policyOptions: "MasterPasswordPolicyOptions",
          masterKey: "masterKey",
        });
      });

      it("throws if verification fails", async () => {
        cryptoService.hashMasterKey
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

        expect(cryptoService.compareAndUpdateKeyHash).not.toHaveBeenCalled();
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
        cryptoService.makeMasterKey.mockResolvedValueOnce(null);

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
