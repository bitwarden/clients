import { mock, MockProxy } from "jest-mock-extended";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeStorageService, makeEncString, makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { StorageService } from "@bitwarden/storage-core";

import BrowserLocalStorageService from "./browser-local-storage.service";
import {
  LocalBackedSessionStorageService,
  SessionKeyResolveService,
} from "./local-backed-session-storage.service";

describe("SessionKeyResolveService", () => {
  let storageService: FakeStorageService;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let sut: SessionKeyResolveService;

  const mockKey = makeSymmetricCryptoKey();

  beforeEach(() => {
    storageService = new FakeStorageService();
    keyGenerationService = mock<KeyGenerationService>();
    sut = new SessionKeyResolveService(storageService, keyGenerationService);
  });

  describe("get", () => {
    it("returns null when no session key exists", async () => {
      const result = await sut.get();
      expect(result).toBeNull();
    });

    it("returns the session key from storage", async () => {
      await storageService.save("session-key", mockKey);
      const result = await sut.get();
      expect(result).toEqual(mockKey);
    });

    it("deserializes the session key when storage requires deserialization", async () => {
      const mockStorageService = mock<FakeStorageService>();
      Object.defineProperty(mockStorageService, "valuesRequireDeserialization", {
        get: () => true,
      });
      mockStorageService.get.mockResolvedValue(mockKey.toJSON());

      const deserializableSut = new SessionKeyResolveService(
        mockStorageService,
        keyGenerationService,
      );

      const result = await deserializableSut.get();

      expect(result).toBeInstanceOf(SymmetricCryptoKey);
      expect(result?.toJSON()).toEqual(mockKey.toJSON());
    });
  });

  describe("create", () => {
    it("creates a new session key and saves it to storage", async () => {
      keyGenerationService.createKeyWithPurpose.mockResolvedValue({
        salt: "salt",
        material: new Uint8Array(16) as any,
        derivedKey: mockKey,
      });

      const result = await sut.create();

      expect(keyGenerationService.createKeyWithPurpose).toHaveBeenCalledWith(
        128,
        "ephemeral",
        "bitwarden-ephemeral",
      );
      expect(result).toEqual(mockKey);
      expect(await storageService.get("session-key")).toEqual(mockKey.toJSON());
    });
  });
});

describe("LocalBackedSessionStorage", () => {
  const sessionKey = makeSymmetricCryptoKey();
  let memoryStorage: MockProxy<StorageService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let localStorage: MockProxy<BrowserLocalStorageService>;
  let encryptService: MockProxy<EncryptService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let logService: MockProxy<LogService>;

  let sut: LocalBackedSessionStorageService;

  beforeEach(() => {
    memoryStorage = mock<StorageService>();
    keyGenerationService = mock<KeyGenerationService>();
    localStorage = mock<BrowserLocalStorageService>();
    encryptService = mock<EncryptService>();
    platformUtilsService = mock<PlatformUtilsService>();
    logService = mock<LogService>();

    // Default: session key exists
    memoryStorage.get.mockResolvedValue(sessionKey);
    Object.defineProperty(memoryStorage, "valuesRequireDeserialization", {
      get: () => true,
    });

    sut = new LocalBackedSessionStorageService(
      memoryStorage,
      localStorage,
      keyGenerationService,
      encryptService,
      platformUtilsService,
      logService,
    );
  });

  describe("get", () => {
    const encString = makeEncString("encrypted");

    it("returns the cached value when one is cached", async () => {
      sut["cache"]["test"] = "cached";
      const result = await sut.get("test");
      expect(result).toEqual("cached");
    });

    it("returns null when both cache and storage are null", async () => {
      sut["cache"]["test"] = null;
      localStorage.get.mockResolvedValue(null);

      const result = await sut.get("test");

      expect(result).toBeNull();
      expect(localStorage.get).toHaveBeenCalledWith("session_test");
    });

    it("returns a decrypted value when one is stored in local storage", async () => {
      localStorage.get.mockResolvedValue(encString.encryptedString);
      encryptService.decryptString.mockResolvedValue(JSON.stringify("decrypted"));

      const result = await sut.get("test");

      expect(encryptService.decryptString).toHaveBeenCalledWith(encString, sessionKey);
      expect(result).toEqual("decrypted");
      expect(sut["cache"]["test"]).toEqual("decrypted");
    });

    it("returns the cached value when cache is populated during storage retrieval", async () => {
      localStorage.get.mockImplementation(async () => {
        sut["cache"]["test"] = "cached-during-read";
        return encString.encryptedString;
      });
      encryptService.decryptString.mockResolvedValue(JSON.stringify("decrypted-from-storage"));

      const result = await sut.get("test");

      expect(result).toEqual("cached-during-read");
    });

    it("returns the cached value when storage returns null but cache was filled", async () => {
      localStorage.get.mockImplementation(async () => {
        sut["cache"]["test"] = "cached-during-read";
        return null;
      });

      const result = await sut.get("test");

      expect(result).toEqual("cached-during-read");
    });

    it("creates new session key, clears old data, and returns null when session key is missing", async () => {
      const newSessionKey = makeSymmetricCryptoKey();
      const clearSpy = jest.spyOn(sut as any, "clear");
      memoryStorage.get.mockResolvedValue(null);
      keyGenerationService.createKeyWithPurpose.mockResolvedValue({
        salt: "salt",
        material: new Uint8Array(16) as any,
        derivedKey: newSessionKey,
      });
      localStorage.get.mockResolvedValue(null);
      localStorage.getKeys.mockResolvedValue([]);

      const result = await sut.get("test");

      expect(keyGenerationService.createKeyWithPurpose).toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("has", () => {
    it("returns true when the key is in cache", async () => {
      sut["cache"]["test"] = "cached";
      const result = await sut.has("test");
      expect(result).toBe(true);
    });

    it("returns true when the key is in local storage", async () => {
      const encString = makeEncString("encrypted");
      localStorage.get.mockResolvedValue(encString.encryptedString);
      encryptService.decryptString.mockResolvedValue(JSON.stringify("decrypted"));
      const result = await sut.has("test");
      expect(result).toBe(true);
    });

    it.each([null, undefined])(
      "returns false when the key does not exist in local storage (%s)",
      async (value) => {
        localStorage.get.mockResolvedValue(value);
        await expect(sut.has("test")).resolves.toBe(false);
        expect(encryptService.decryptString).not.toHaveBeenCalled();
      },
    );
  });

  describe("save", () => {
    const encString = makeEncString("encrypted");

    beforeEach(() => {
      encryptService.encryptString.mockResolvedValue(encString);
    });

    it("logs a warning when saving the same value twice and in a dev environment", async () => {
      platformUtilsService.isDev.mockReturnValue(true);
      sut["cache"]["test"] = "cached";
      await sut.save("test", "cached");
      expect(logService.warning).toHaveBeenCalled();
    });

    it("does not log when saving the same value twice and not in a dev environment", async () => {
      platformUtilsService.isDev.mockReturnValue(false);
      sut["cache"]["test"] = "cached";
      await sut.save("test", "cached");
      expect(logService.warning).not.toHaveBeenCalled();
    });

    it("removes the key when saving a null value", async () => {
      const removeSpy = jest.spyOn(sut, "remove");
      await sut.save("test", null);
      expect(removeSpy).toHaveBeenCalledWith("test");
    });

    it("uses the session key when encrypting", async () => {
      await sut.save("test", "value");

      expect(memoryStorage.get).toHaveBeenCalledWith("session-key");
      expect(encryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify("value"),
        sessionKey,
      );
    });

    it("emits an update", async () => {
      const updateSpy = jest.spyOn(sut["updatesSubject"], "next");
      await sut.save("test", "value");
      expect(updateSpy).toHaveBeenCalledWith({ key: "test", updateType: "save" });
    });

    it("creates a new session key when session key is missing before saving", async () => {
      const newSessionKey = makeSymmetricCryptoKey();
      memoryStorage.get.mockResolvedValue(null);
      keyGenerationService.createKeyWithPurpose.mockResolvedValue({
        salt: "salt",
        material: new Uint8Array(16) as any,
        derivedKey: newSessionKey,
      });
      localStorage.getKeys.mockResolvedValue([]);

      await sut.save("test", "value");

      expect(keyGenerationService.createKeyWithPurpose).toHaveBeenCalled();
      expect(encryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify("value"),
        newSessionKey,
      );
    });
  });

  describe("remove", () => {
    it("nulls the value in cache", async () => {
      sut["cache"]["test"] = "cached";
      await sut.remove("test");
      expect(sut["cache"]["test"]).toBeNull();
    });

    it("removes the key from local storage", async () => {
      await sut.remove("test");
      expect(localStorage.remove).toHaveBeenCalledWith("session_test");
    });

    it("emits an update", async () => {
      const updateSpy = jest.spyOn(sut["updatesSubject"], "next");
      await sut.remove("test");
      expect(updateSpy).toHaveBeenCalledWith({ key: "test", updateType: "remove" });
    });
  });

  describe("sessionStorageKey", () => {
    it("prefixes keys with session_ prefix", () => {
      expect(sut["sessionStorageKey"]("test")).toBe("session_test");
    });
  });

  describe("clear", () => {
    it("only removes keys with session_ prefix", async () => {
      const removeSpy = jest.spyOn(sut, "remove");
      localStorage.getKeys.mockResolvedValue([
        "session_data1",
        "session_data2",
        "regular_key",
        "another_key",
        "session_data3",
        "my_session_key",
        "mysession",
        "sessiondata",
        "user_session",
      ]);

      await sut["clear"]();

      expect(removeSpy).toHaveBeenCalledWith("data1");
      expect(removeSpy).toHaveBeenCalledWith("data2");
      expect(removeSpy).toHaveBeenCalledWith("data3");
      expect(removeSpy).not.toHaveBeenCalledWith("regular_key");
      expect(removeSpy).not.toHaveBeenCalledWith("another_key");
      expect(removeSpy).not.toHaveBeenCalledWith("my_session_key");
      expect(removeSpy).not.toHaveBeenCalledWith("mysession");
      expect(removeSpy).not.toHaveBeenCalledWith("sessiondata");
      expect(removeSpy).not.toHaveBeenCalledWith("user_session");
      expect(removeSpy).toHaveBeenCalledTimes(3);
    });
  });
});
