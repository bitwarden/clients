import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { EncString, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { makeEncString } from "../../../../spec";
import { UserId } from "../../../types/guid";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../types/master-password.types";

import {
  InternalMasterPasswordServiceAbstraction,
  syncLegacyMasterKeyState,
} from "./master-password.service.abstraction";

describe("syncLegacyMasterKeyState", () => {
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();

  const userId = "00000000-0000-0000-0000-000000000000" as UserId;
  const masterPassword = "masterPassword";
  const wrappedUserKey = makeEncString("wrappedUserKey");
  const unlockData = new MasterPasswordUnlockData(
    "test@bitwarden.com" as MasterPasswordSalt,
    new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.min),
    wrappedUserKey.encryptedString as unknown as MasterKeyWrappedUserKey,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    masterPasswordService.masterPasswordUnlockData$ = jest.fn(() => of(unlockData)) as any;
  });

  it("derives and stores the legacy master key and wrapped user key from the persisted unlock data", async () => {
    await syncLegacyMasterKeyState(userId, masterPassword, masterPasswordService);

    expect(masterPasswordService.setLegacyMasterKeyFromUnlockData).toHaveBeenCalledWith(
      masterPassword,
      unlockData,
      userId,
    );
    expect(masterPasswordService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
      new EncString(wrappedUserKey.encryptedString),
      userId,
    );
  });

  it("throws when the unlock data is not present in state", async () => {
    masterPasswordService.masterPasswordUnlockData$ = jest.fn(() => of(null)) as any;

    await expect(
      syncLegacyMasterKeyState(userId, masterPassword, masterPasswordService),
    ).rejects.toThrow("unlockData");

    expect(masterPasswordService.setLegacyMasterKeyFromUnlockData).not.toHaveBeenCalled();
    expect(masterPasswordService.setMasterKeyEncryptedUserKey).not.toHaveBeenCalled();
  });
});
