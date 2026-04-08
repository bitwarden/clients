import { firstValueFrom } from "rxjs";

import { FakeSingleUserStateProvider } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";

import { UserDecryptionOptions } from "../../models/domain/user-decryption-options";

import {
  USER_DECRYPTION_OPTIONS,
  UserDecryptionOptionsService,
} from "./user-decryption-options.service";

describe("UserDecryptionOptionsService", () => {
  let sut: UserDecryptionOptionsService;
  let fakeStateProvider: FakeSingleUserStateProvider;

  beforeEach(() => {
    fakeStateProvider = new FakeSingleUserStateProvider();
    sut = new UserDecryptionOptionsService(fakeStateProvider);
  });

  const userDecryptionOptions: UserDecryptionOptions = {
    hasMasterPassword: true,
    trustedDeviceOption: {
      hasAdminApproval: false,
      hasLoginApprovingDevice: false,
      hasManageResetPasswordPermission: true,
      isTdeOffboarding: false,
    },
    keyConnectorOption: {
      keyConnectorUrl: "https://keyconnector.bitwarden.com",
    },
  };

  describe("userDecryptionOptionsById$", () => {
    it("should return user decryption options for a specific user", async () => {
      const userId = newGuid() as UserId;

      fakeStateProvider.getFake(userId, USER_DECRYPTION_OPTIONS).nextState(userDecryptionOptions);

      const result = await firstValueFrom(sut.userDecryptionOptionsById$(userId));

      expect(result).toEqual(userDecryptionOptions);
    });
  });

  describe("hasMasterPasswordById$", () => {
    it("should return true when user has a master password", async () => {
      const userId = newGuid() as UserId;

      fakeStateProvider.getFake(userId, USER_DECRYPTION_OPTIONS).nextState(userDecryptionOptions);

      const result = await firstValueFrom(sut.hasMasterPasswordById$(userId));

      expect(result).toBe(true);
    });

    it("should return false when user does not have a master password", async () => {
      const userId = newGuid() as UserId;
      const optionsWithoutMasterPassword = {
        ...userDecryptionOptions,
        hasMasterPassword: false,
      };

      fakeStateProvider
        .getFake(userId, USER_DECRYPTION_OPTIONS)
        .nextState(optionsWithoutMasterPassword);

      const result = await firstValueFrom(sut.hasMasterPasswordById$(userId));

      expect(result).toBe(false);
    });
  });

  describe("setUserDecryptionOptionsById", () => {
    it("should set user decryption options for a specific user", async () => {
      const userId = newGuid() as UserId;

      await sut.setUserDecryptionOptionsById(userId, userDecryptionOptions);

      const fakeState = fakeStateProvider.getFake(userId, USER_DECRYPTION_OPTIONS);
      const result = await firstValueFrom(fakeState.state$);

      expect(result).toEqual(userDecryptionOptions);
    });

    it("should overwrite existing user decryption options", async () => {
      const userId = newGuid() as UserId;
      const initialOptions = { ...userDecryptionOptions, hasMasterPassword: false };
      const updatedOptions = { ...userDecryptionOptions, hasMasterPassword: true };

      const fakeState = fakeStateProvider.getFake(userId, USER_DECRYPTION_OPTIONS);
      fakeState.nextState(initialOptions);

      await sut.setUserDecryptionOptionsById(userId, updatedOptions);

      const result = await firstValueFrom(fakeState.state$);

      expect(result).toEqual(updatedOptions);
    });
  });
});
