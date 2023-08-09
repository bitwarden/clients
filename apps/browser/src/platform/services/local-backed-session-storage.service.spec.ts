// eslint-disable-next-line no-restricted-imports
import { Arg, Substitute, SubstituteOf } from "@fluffy-spoon/substitute";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { EncryptServiceImplementation } from "@bitwarden/common/platform/services/cryptography/encrypt.service.implementation";

import BrowserLocalStorageService from "./browser-local-storage.service";
import BrowserMemoryStorageService from "./browser-memory-storage.service";
import { KeyGenerationService } from "./key-generation.service";
import { LocalBackedSessionStorageService } from "./local-backed-session-storage.service";

describe("Browser Session Storage Service", () => {
  let encryptService: SubstituteOf<EncryptServiceImplementation>;
  let keyGenerationService: SubstituteOf<KeyGenerationService>;

  let cache: Map<string, any>;
  const testObj = { a: 1, b: 2 };

  let localStorage: BrowserLocalStorageService;
  let sessionStorage: BrowserMemoryStorageService;

  const key = new SymmetricCryptoKey(Utils.fromUtf8ToArray("00000000000000000000000000000000"));
  let getSessionKeySpy: jest.SpyInstance;
  const mockEnc = (input: string) => Promise.resolve(new EncString("ENCRYPTED" + input));

  let sut: LocalBackedSessionStorageService;

  beforeEach(() => {
    encryptService = Substitute.for();
    keyGenerationService = Substitute.for();

    sut = new LocalBackedSessionStorageService(encryptService, keyGenerationService);

    cache = sut["cache"];
    localStorage = sut["localStorage"];
    sessionStorage = sut["sessionStorage"];
    getSessionKeySpy = jest.spyOn(sut, "getSessionEncKey");
    getSessionKeySpy.mockResolvedValue(key);
  });

  it("should exist", () => {
    expect(sut).toBeInstanceOf(LocalBackedSessionStorageService);
  });

  describe("get", () => {
    it("should return from cache", async () => {
      cache.set("test", testObj);
      const result = await sut.get("test");
      expect(result).toStrictEqual(testObj);
    });

    describe("not in cache", () => {
      const session = { test: testObj };

      beforeEach(() => {
        jest.spyOn(sut, "getSessionEncKey").mockResolvedValue(key);
      });

      describe("no session retrieved", () => {
        let result: any;
        let spy: jest.SpyInstance;
        beforeEach(async () => {
          spy = jest.spyOn(sut, "getLocalSession").mockResolvedValue(null);
          result = await sut.get("test");
        });

        it("should grab from session if not in cache", async () => {
          expect(spy).toHaveBeenCalledWith(key);
        });

        it("should return null if session is null", async () => {
          expect(result).toBeNull();
        });
      });

      describe("session retrieved from storage", () => {
        beforeEach(() => {
          jest.spyOn(sut, "getLocalSession").mockResolvedValue(session);
        });

        it("should return null if session does not have the key", async () => {
          const result = await sut.get("DNE");
          expect(result).toBeNull();
        });

        it("should return the value retrieved from session", async () => {
          const result = await sut.get("test");
          expect(result).toEqual(session.test);
        });

        it("should set retrieved values in cache", async () => {
          await sut.get("test");
          expect(cache.has("test")).toBe(true);
          expect(cache.get("test")).toEqual(session.test);
        });

        it("should use a deserializer if provided", async () => {
          const deserializer = jest.fn().mockReturnValue(testObj);
          const result = await sut.get("test", { deserializer: deserializer });
          expect(deserializer).toHaveBeenCalledWith(session.test);
          expect(result).toEqual(testObj);
        });
      });
    });
  });

  describe("has", () => {
    it("should be false if `get` returns null", async () => {
      const spy = jest.spyOn(sut, "get");
      spy.mockResolvedValue(null);
      expect(await sut.has("test")).toBe(false);
      expect(spy).toHaveBeenCalledWith("test");
    });

    it("should be true if `get` returns non-null", async () => {
      const spy = jest.spyOn(sut, "get");
      spy.mockResolvedValue({});
      expect(await sut.has("test")).toBe(true);
      expect(spy).toHaveBeenCalledWith("test");
    });
  });

  describe("remove", () => {
    it("should save null", async () => {
      const spy = jest.spyOn(sut, "save");
      spy.mockResolvedValue(null);
      await sut.remove("test");
      expect(spy).toHaveBeenCalledWith("test", null);
    });
  });

  describe("save", () => {
    describe("caching", () => {
      beforeEach(() => {
        jest.spyOn(localStorage, "get").mockResolvedValue(null);
        jest.spyOn(sessionStorage, "get").mockResolvedValue(null);
        jest.spyOn(localStorage, "save").mockResolvedValue();
        jest.spyOn(sessionStorage, "save").mockResolvedValue();
      });

      it("should remove key from cache if value is null", async () => {
        cache.set("test", {});
        const deleteSpy = jest.spyOn(cache, "delete");
        expect(cache.has("test")).toBe(true);
        await sut.save("test", null);
        expect(cache.has("test")).toBe(false);
        expect(deleteSpy).toHaveBeenCalledWith("test");
      });

      it("should set cache if value is non-null", async () => {
        expect(cache.has("test")).toBe(false);
        const setSpy = jest.spyOn(cache, "set");
        await sut.save("test", testObj);
        expect(cache.get("test")).toBe(testObj);
        expect(setSpy).toHaveBeenCalledWith("test", testObj);
      });
    });

    describe("local storing", () => {
      let setSpy: jest.SpyInstance;

      beforeEach(() => {
        setSpy = jest.spyOn(sut, "setLocalSession").mockResolvedValue();
      });

      it("should store a new session", async () => {
        jest.spyOn(sut, "getLocalSession").mockResolvedValue(null);
        await sut.save("test", testObj);

        expect(setSpy).toHaveBeenCalledWith({ test: testObj }, key);
      });

      it("should update an existing session", async () => {
        const existingObj = { test: testObj };
        jest.spyOn(sut, "getLocalSession").mockResolvedValue(existingObj);
        await sut.save("test2", testObj);

        expect(setSpy).toHaveBeenCalledWith({ test2: testObj, ...existingObj }, key);
      });

      it("should overwrite an existing item in session", async () => {
        const existingObj = { test: {} };
        jest.spyOn(sut, "getLocalSession").mockResolvedValue(existingObj);
        await sut.save("test", testObj);

        expect(setSpy).toHaveBeenCalledWith({ test: testObj }, key);
      });
    });
  });

  describe("getSessionKey", () => {
    beforeEach(() => {
      getSessionKeySpy.mockRestore();
    });

    it("should return the stored symmetric crypto key", async () => {
      jest.spyOn(sessionStorage, "get").mockResolvedValue({ ...key });
      const result = await sut.getSessionEncKey();

      expect(result).toStrictEqual(key);
    });

    describe("new key creation", () => {
      beforeEach(() => {
        jest.spyOn(sessionStorage, "get").mockResolvedValue(null);
        keyGenerationService.makeEphemeralKey().resolves(key);
        jest.spyOn(sut, "setSessionEncKey").mockResolvedValue();
      });

      it("should create a symmetric crypto key", async () => {
        const result = await sut.getSessionEncKey();

        expect(result).toStrictEqual(key);
        keyGenerationService.received(1).makeEphemeralKey();
      });

      it("should store a symmetric crypto key if it makes one", async () => {
        const spy = jest.spyOn(sut, "setSessionEncKey").mockResolvedValue();
        await sut.getSessionEncKey();

        expect(spy).toBeCalledWith(key);
      });
    });
  });

  describe("getLocalSession", () => {
    it("should return null if session is null", async () => {
      const spy = jest.spyOn(localStorage, "get").mockResolvedValue(null);
      const result = await sut.getLocalSession(key);

      expect(result).toBeNull();
      expect(spy).toBeCalledWith("session");
    });

    describe("non-null sessions", () => {
      const session = { test: "test" };
      const encSession = new EncString(JSON.stringify(session));
      const decryptedSession = JSON.stringify(session);

      beforeEach(() => {
        jest.spyOn(localStorage, "get").mockResolvedValue(encSession.encryptedString);
      });

      it("should decrypt returned sessions", async () => {
        encryptService.decryptToUtf8(encSession, key).resolves(decryptedSession);
        await sut.getLocalSession(key);
        encryptService.received(1).decryptToUtf8(encSession, key);
      });

      it("should parse session", async () => {
        encryptService.decryptToUtf8(encSession, key).resolves(decryptedSession);
        const result = await sut.getLocalSession(key);
        expect(result).toEqual(session);
      });

      it("should remove state if decryption fails", async () => {
        encryptService.decryptToUtf8(Arg.any(), Arg.any()).resolves(null);
        const setSessionEncKeySpy = jest.spyOn(sut, "setSessionEncKey").mockResolvedValue();
        const removeLocalSessionSpy = jest.spyOn(localStorage, "remove").mockResolvedValue();

        const result = await sut.getLocalSession(key);

        expect(result).toBeNull();
        expect(setSessionEncKeySpy).toHaveBeenCalledWith(null);
        expect(removeLocalSessionSpy).toHaveBeenCalledWith("session");
      });
    });
  });

  describe("setLocalSession", () => {
    const testSession = { test: "a" };
    const testJSON = JSON.stringify(testSession);

    it("should encrypt a stringified session", async () => {
      encryptService.encrypt(Arg.any(), Arg.any()).mimicks(mockEnc);
      jest.spyOn(localStorage, "save").mockResolvedValue();
      await sut.setLocalSession(testSession, key);

      encryptService.received(1).encrypt(testJSON, key);
    });

    it("should remove local session if null", async () => {
      encryptService.encrypt(Arg.any(), Arg.any()).resolves(null);
      const spy = jest.spyOn(localStorage, "remove").mockResolvedValue();
      await sut.setLocalSession(null, key);

      expect(spy).toHaveBeenCalledWith("session");
    });

    it("should save encrypted string", async () => {
      encryptService.encrypt(Arg.any(), Arg.any()).mimicks(mockEnc);
      const spy = jest.spyOn(localStorage, "save").mockResolvedValue();
      await sut.setLocalSession(testSession, key);

      expect(spy).toHaveBeenCalledWith("session", (await mockEnc(testJSON)).encryptedString);
    });
  });

  describe("setSessionKey", () => {
    it("should remove if null", async () => {
      const spy = jest.spyOn(sessionStorage, "remove").mockResolvedValue();
      await sut.setSessionEncKey(null);
      expect(spy).toHaveBeenCalledWith("localEncryptionKey");
    });

    it("should save key when not null", async () => {
      const spy = jest.spyOn(sessionStorage, "save").mockResolvedValue();
      await sut.setSessionEncKey(key);
      expect(spy).toHaveBeenCalledWith("localEncryptionKey", key);
    });
  });
});
