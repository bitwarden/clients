import { mock, MockProxy } from "jest-mock-extended";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Lazy } from "@bitwarden/common/platform/misc/lazy";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeStorageService, makeEncString } from "@bitwarden/common/spec";

import { LocalBackedSessionStorageService } from "./local-backed-session-storage.service";

describe("LocalBackedSessionStorage", () => {
  const sessionKey = new SymmetricCryptoKey(
    Utils.fromUtf8ToArray("00000000000000000000000000000000"),
  );
  let localStorage: FakeStorageService;
  let encryptService: MockProxy<EncryptService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let logService: MockProxy<LogService>;

  let sut: LocalBackedSessionStorageService;

  beforeEach(() => {
    localStorage = new FakeStorageService();
    encryptService = mock<EncryptService>();
    platformUtilsService = mock<PlatformUtilsService>();
    logService = mock<LogService>();

    sut = new LocalBackedSessionStorageService(
      new Lazy(async () => sessionKey),
      localStorage,
      encryptService,
      platformUtilsService,
      logService,
    );
  });

  describe("get", () => {
    it("return the cached value when one is cached", async () => {
      sut["cache"]["test"] = "cached";
      const result = await sut.get("test");
      expect(result).toEqual("cached");
    });

    it("returns a decrypted value when one is stored in local storage", async () => {
      const encrypted = makeEncString("encrypted");
      localStorage.internalStore["session_test"] = encrypted.encryptedString;
      encryptService.decryptToUtf8.mockResolvedValue(JSON.stringify("decrypted"));
      const result = await sut.get("test");
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(encryptService.decryptToUtf8).toHaveBeenCalledWith(
        encrypted,
        sessionKey,
        "browser-session-key",
      ),
        expect(result).toEqual("decrypted");
    });

    it("caches the decrypted value when one is stored in local storage", async () => {
      const encrypted = makeEncString("encrypted");
      localStorage.internalStore["session_test"] = encrypted.encryptedString;
      encryptService.decryptToUtf8.mockResolvedValue(JSON.stringify("decrypted"));
      await sut.get("test");
      expect(sut["cache"]["test"]).toEqual("decrypted");
    });

    it("returns a decrypted value when one is stored in local storage", async () => {
      const encrypted = makeEncString("encrypted");
      localStorage.internalStore["session_test"] = encrypted.encryptedString;
      encryptService.decryptToUtf8.mockResolvedValue(JSON.stringify("decrypted"));
      const result = await sut.get("test");
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(encryptService.decryptToUtf8).toHaveBeenCalledWith(
        encrypted,
        sessionKey,
        "browser-session-key",
      ),
        expect(result).toEqual("decrypted");
    });

    it("caches the decrypted value when one is stored in local storage", async () => {
      const encrypted = makeEncString("encrypted");
      localStorage.internalStore["session_test"] = encrypted.encryptedString;
      encryptService.decryptToUtf8.mockResolvedValue(JSON.stringify("decrypted"));
      await sut.get("test");
      expect(sut["cache"]["test"]).toEqual("decrypted");
    });
  });

  describe("has", () => {
    it("returns false when the key is not in cache", async () => {
      const result = await sut.has("test");
      expect(result).toBe(false);
    });

    it("returns true when the key is in cache", async () => {
      sut["cache"]["test"] = "cached";
      const result = await sut.has("test");
      expect(result).toBe(true);
    });

    it("returns true when the key is in local storage", async () => {
      localStorage.internalStore["session_test"] = makeEncString("encrypted").encryptedString;
      encryptService.decryptToUtf8.mockResolvedValue(JSON.stringify("decrypted"));
      const result = await sut.has("test");
      expect(result).toBe(true);
    });

    it.each([null, undefined])("returns false when %s is cached", async (nullish) => {
      sut["cache"]["test"] = nullish;
      await expect(sut.has("test")).resolves.toBe(false);
    });

    it.each([null, undefined])(
      "returns false when null is stored in local storage",
      async (nullish) => {
        localStorage.internalStore["session_test"] = nullish;
        await expect(sut.has("test")).resolves.toBe(false);
        expect(encryptService.decryptToUtf8).not.toHaveBeenCalled();
      },
    );
  });

  describe("save", () => {
    const encString = makeEncString("encrypted");
    beforeEach(() => {
      encryptService.encrypt.mockResolvedValue(encString);
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
      const spy = jest.spyOn(sut, "remove");
      await sut.save("test", null);
      expect(spy).toHaveBeenCalledWith("test");
    });

    it("saves the value to cache", async () => {
      await sut.save("test", "value");
      expect(sut["cache"]["test"]).toEqual("value");
    });

    it("encrypts and saves the value to local storage", async () => {
      await sut.save("test", "value");
      expect(encryptService.encrypt).toHaveBeenCalledWith(JSON.stringify("value"), sessionKey);
      expect(localStorage.internalStore["session_test"]).toEqual(encString.encryptedString);
    });

    it("emits an update", async () => {
      const spy = jest.spyOn(sut["updatesSubject"], "next");
      await sut.save("test", "value");
      expect(spy).toHaveBeenCalledWith({ key: "test", updateType: "save" });
    });
  });

  describe("remove", () => {
    it("nulls the value in cache", async () => {
      sut["cache"]["test"] = "cached";
      await sut.remove("test");
      expect(sut["cache"]["test"]).toBeNull();
    });

    it("removes the key from local storage", async () => {
      localStorage.internalStore["session_test"] = makeEncString("encrypted").encryptedString;
      await sut.remove("test");
      expect(localStorage.internalStore["session_test"]).toBeUndefined();
    });

    it("emits an update", async () => {
      const spy = jest.spyOn(sut["updatesSubject"], "next");
      await sut.remove("test");
      expect(spy).toHaveBeenCalledWith({ key: "test", updateType: "remove" });
    });
  });
});
