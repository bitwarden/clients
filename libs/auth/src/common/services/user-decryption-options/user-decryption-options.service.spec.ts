import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { UserDecryptionOptions } from "../../models/domain/user-decryption-options";

import {
  USER_DECRYPTION_OPTIONS,
  UserDecryptionOptionsService,
} from "./user-decryption-options.service";

describe("UserDecryptionOptionsService", () => {
  let sut: UserDecryptionOptionsService;

  const fakeUserId = Utils.newGuid() as UserId;
  let fakeAccountService: FakeAccountService;
  let fakeStateProvider: FakeStateProvider;

  beforeEach(() => {
    fakeAccountService = mockAccountServiceWith(fakeUserId);
    fakeStateProvider = new FakeStateProvider(fakeAccountService);

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

  describe("userDecryptionOptions$", () => {
    it("should return the active user's decryption options", async () => {
      await fakeStateProvider.setUserState(USER_DECRYPTION_OPTIONS, userDecryptionOptions);

      const result = await firstValueFrom(sut.userDecryptionOptions$);

      expect(result).toEqual(userDecryptionOptions);
    });
  });

  describe("hasMasterPassword$", () => {
    it("should return the hasMasterPassword property of the active user's decryption options", async () => {
      await fakeStateProvider.setUserState(USER_DECRYPTION_OPTIONS, userDecryptionOptions);

      const result = await firstValueFrom(sut.hasMasterPassword$);

      expect(result).toBe(true);
    });
  });

  describe("userDecryptionOptionsById$", () => {
    it("should return the user decryption options for the given user", async () => {
      const givenUser = Utils.newGuid() as UserId;
      await fakeAccountService.addAccount(givenUser, {
        name: "Test User 1",
        email: "test1@email.com",
        emailVerified: false,
      });
      await fakeStateProvider.setUserState(
        USER_DECRYPTION_OPTIONS,
        userDecryptionOptions,
        givenUser,
      );

      const result = await firstValueFrom(sut.userDecryptionOptionsById$(givenUser));

      expect(result).toEqual(userDecryptionOptions);
    });
  });

  describe("setUserDecryptionOptions", () => {
    it("should set the specified user's decryption options", async () => {
      await sut.setUserDecryptionOptions(userDecryptionOptions, fakeUserId);

      const result = await firstValueFrom(
        fakeStateProvider.getUser(fakeUserId, USER_DECRYPTION_OPTIONS).state$,
      );

      expect(result).toEqual(userDecryptionOptions);
    });
  });
});
