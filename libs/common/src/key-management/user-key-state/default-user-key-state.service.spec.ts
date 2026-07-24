import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { makeSymmetricCryptoKey } from "../../../spec";
import { UserKey } from "../../types/key";

import { DefaultUserKeyStateService } from "./default-user-key-state.service";

describe("DefaultUserKeyStateService", () => {
  const userId = "user-id" as UserId;
  const otherUserId = "other-user-id" as UserId;

  let sut: DefaultUserKeyStateService;

  beforeEach(() => {
    sut = new DefaultUserKeyStateService();
  });

  it("returns null when no key has been set", async () => {
    expect(await sut.getUserKey(userId)).toBeNull();
  });

  it("emits null when no key has been set", async () => {
    expect(await firstValueFrom(sut.userKey$(userId))).toBeNull();
  });

  it("returns and emits a set key", async () => {
    const key = makeSymmetricCryptoKey<UserKey>(64);

    await sut.setUserKey(userId, key);

    expect(await sut.getUserKey(userId)).toBe(key);
    expect(await firstValueFrom(sut.userKey$(userId))).toBe(key);
  });

  it("clears the key when set to null", async () => {
    const key = makeSymmetricCryptoKey<UserKey>(64);
    await sut.setUserKey(userId, key);

    await sut.setUserKey(userId, null);

    expect(await sut.getUserKey(userId)).toBeNull();
    expect(await firstValueFrom(sut.userKey$(userId))).toBeNull();
  });

  it("isolates keys between users", async () => {
    const key = makeSymmetricCryptoKey<UserKey>(64);
    const otherKey = makeSymmetricCryptoKey<UserKey>(64);

    await sut.setUserKey(userId, key);
    await sut.setUserKey(otherUserId, otherKey);
    await sut.setUserKey(otherUserId, null);

    expect(await sut.getUserKey(userId)).toBe(key);
    expect(await sut.getUserKey(otherUserId)).toBeNull();
  });

  it("emits to existing subscribers on set and clear", async () => {
    const key = makeSymmetricCryptoKey<UserKey>(64);
    const emissions: (UserKey | null)[] = [];
    const subscription = sut.userKey$(userId).subscribe((k) => emissions.push(k));

    await sut.setUserKey(userId, key);
    await sut.setUserKey(userId, null);
    subscription.unsubscribe();

    expect(emissions).toEqual([null, key, null]);
  });
});
