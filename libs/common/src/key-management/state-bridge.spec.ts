import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { FakeStateProvider, mockAccountServiceWith } from "../../spec";
import { UserId } from "../types/guid";

import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "./master-password/types/master-password.types";
import { JsWasmStateBridge } from "./state-bridge";
import { MASTER_PASSWORD_UNLOCK_DATA } from "./state-definitions";

describe("JsWasmStateBridge", () => {
  const userId = "00000000-0000-0000-0000-000000000001" as UserId;

  let stateProvider: FakeStateProvider;
  let sut: JsWasmStateBridge;

  const unlockData = new MasterPasswordUnlockData(
    "salt" as MasterPasswordSalt,
    new PBKDF2KdfConfig(600_000),
    "2.wrapped|user|key" as MasterKeyWrappedUserKey,
  );

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    sut = new JsWasmStateBridge(stateProvider, userId);
  });

  describe("get_kdf_config", () => {
    it("returns the KDF from the master-password unlock data", async () => {
      await stateProvider.setUserState(MASTER_PASSWORD_UNLOCK_DATA, unlockData, userId);

      await expect(sut.get_kdf_config()).resolves.toEqual(
        new PBKDF2KdfConfig(600_000).toSdkConfig(),
      );
    });

    it("returns null when there is no master-password unlock data", async () => {
      await expect(sut.get_kdf_config()).resolves.toBeNull();
    });
  });

  describe("set_kdf_config", () => {
    it("does not change the master-password unlock data", async () => {
      await stateProvider.setUserState(MASTER_PASSWORD_UNLOCK_DATA, unlockData, userId);

      await sut.set_kdf_config(new Argon2KdfConfig(3, 64, 4).toSdkConfig());

      await expect(
        firstValueFrom(stateProvider.getUserState$(MASTER_PASSWORD_UNLOCK_DATA, userId)),
      ).resolves.toEqual(unlockData);
    });
  });

  describe("clear_kdf_config", () => {
    it("does not clear the master-password unlock data", async () => {
      await stateProvider.setUserState(MASTER_PASSWORD_UNLOCK_DATA, unlockData, userId);

      await sut.clear_kdf_config();

      await expect(
        firstValueFrom(stateProvider.getUserState$(MASTER_PASSWORD_UNLOCK_DATA, userId)),
      ).resolves.toEqual(unlockData);
    });
  });
});
