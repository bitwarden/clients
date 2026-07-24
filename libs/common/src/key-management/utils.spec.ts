import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/key-management";

import { makeEncString } from "../../spec";
import { UserId } from "../types/guid";

import { EncString } from "./crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "./master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "./master-password/types/master-password.types";
import { assertParametersNonNull, syncLegacyMasterKeyState } from "./utils";

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

describe("assertParametersNonNull", () => {
  class Example {
    capturedThis: unknown;
    capturedArgs: unknown[] | undefined;

    @assertParametersNonNull()
    method(a: unknown, b: unknown, c: unknown): string {
      this.capturedThis = this;
      this.capturedArgs = [a, b, c];
      return "ok";
    }

    @assertParametersNonNull()
    noArgs(): string {
      return "no-args";
    }
  }

  it("invokes the wrapped method when all arguments are non-nullish", () => {
    const ex = new Example();

    const result = ex.method("a", 0, false);

    expect(result).toBe("ok");
    expect(ex.capturedArgs).toEqual(["a", 0, false]);
  });

  it("preserves the `this` binding of the wrapped method", () => {
    const ex = new Example();

    ex.method("a", "b", "c");

    expect(ex.capturedThis).toBe(ex);
  });

  it("throws when an argument is null", () => {
    const ex = new Example();

    expect(() => ex.method("a", null, "c")).toThrow("parameter 1 is null or undefined.");
  });

  it("throws when an argument is undefined", () => {
    const ex = new Example();

    expect(() => ex.method(undefined, "b", "c")).toThrow("parameter 0 is null or undefined.");
  });

  it("throws on the first nullish argument encountered", () => {
    const ex = new Example();

    expect(() => ex.method(null, undefined, "c")).toThrow("parameter 0 is null or undefined.");
  });

  it("invokes a no-arg method without throwing", () => {
    const ex = new Example();

    expect(ex.noArgs()).toBe("no-args");
  });
});
