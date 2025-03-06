import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { FakeStateProvider, awaitAsync, mockAccountServiceWith } from "../../../../../common/spec";

import { LocalGeneratorHistoryService } from "./local-generator-history.service";

const SomeUser = "SomeUser" as UserId;
const AnotherUser = "AnotherUser" as UserId;

describe("LocalGeneratorHistoryService", () => {
  const encryptService = mock<EncryptService>();
  const keyService = mock<KeyService>();
  const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

  beforeEach(() => {
    encryptService.encrypt.mockImplementation((p) => Promise.resolve(p as unknown as EncString));
    encryptService.decryptToUtf8.mockImplementation((c) => Promise.resolve(c.encryptedString));
    keyService.getUserKey.mockImplementation(() => Promise.resolve(userKey));
    keyService.userKey$.mockImplementation(() => of(true as unknown as UserKey));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("credential$", () => {
    it("returns an empty list when no credentials are stored", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);

      const result = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toEqual([]);
    });
  });

  describe("track", () => {
    it("stores a password", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);

      await history.track(SomeUser, "example", "password");
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toMatchObject({ credential: "example", category: "password" });
    });

    it("stores a passphrase", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);

      await history.track(SomeUser, "example", "passphrase");
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toMatchObject({ credential: "example", category: "passphrase" });
    });

    it("stores a specific date when one is provided", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);

      await history.track(SomeUser, "example", "password", new Date(100));
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toEqual({
        credential: "example",
        category: "password",
        generationDate: new Date(100),
      });
    });

    it("skips storing a credential when it's already stored (ignores category)", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);

      await history.track(SomeUser, "example", "password");
      await history.track(SomeUser, "example", "password");
      await history.track(SomeUser, "example", "passphrase");
      await awaitAsync();
      const [firstResult, secondResult] = await firstValueFrom(history.credentials$(SomeUser));

      expect(firstResult).toMatchObject({ credential: "example", category: "password" });
      expect(secondResult).toBeUndefined();
    });

    it("stores multiple credentials when the credential value is different", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);

      await history.track(SomeUser, "secondResult", "password");
      await history.track(SomeUser, "firstResult", "password");
      await awaitAsync();
      const [firstResult, secondResult] = await firstValueFrom(history.credentials$(SomeUser));

      expect(firstResult).toMatchObject({ credential: "firstResult", category: "password" });
      expect(secondResult).toMatchObject({ credential: "secondResult", category: "password" });
    });

    it("removes history items exceeding maxTotal configuration", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider, {
        maxTotal: 1,
      });

      await history.track(SomeUser, "removed result", "password");
      await history.track(SomeUser, "example", "password");
      await awaitAsync();
      const [firstResult, secondResult] = await firstValueFrom(history.credentials$(SomeUser));

      expect(firstResult).toMatchObject({ credential: "example", category: "password" });
      expect(secondResult).toBeUndefined();
    });

    it("stores history items in per-user collections", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider, {
        maxTotal: 1,
      });

      await history.track(SomeUser, "some user example", "password");
      await history.track(AnotherUser, "another user example", "password");
      await awaitAsync();
      const [someFirstResult, someSecondResult] = await firstValueFrom(
        history.credentials$(SomeUser),
      );
      const [anotherFirstResult, anotherSecondResult] = await firstValueFrom(
        history.credentials$(AnotherUser),
      );

      expect(someFirstResult).toMatchObject({
        credential: "some user example",
        category: "password",
      });
      expect(someSecondResult).toBeUndefined();
      expect(anotherFirstResult).toMatchObject({
        credential: "another user example",
        category: "password",
      });
      expect(anotherSecondResult).toBeUndefined();
    });
  });

  describe("take", () => {
    it("returns null when there are no credentials stored", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);

      const result = await history.take(SomeUser, "example");

      expect(result).toBeNull();
    });

    it("returns null when the credential wasn't found", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);
      await history.track(SomeUser, "example", "password");

      const result = await history.take(SomeUser, "not found");

      expect(result).toBeNull();
    });

    it("returns a matching credential", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);
      await history.track(SomeUser, "example", "password");

      const result = await history.take(SomeUser, "example");

      expect(result).toMatchObject({
        credential: "example",
        category: "password",
      });
    });

    it("removes a matching credential", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(encryptService, keyService, stateProvider);
      await history.track(SomeUser, "example", "password");

      await history.take(SomeUser, "example");
      await awaitAsync();
      const results = await firstValueFrom(history.credentials$(SomeUser));

      expect(results).toEqual([]);
    });
  });
});
