import { mock, MockProxy } from "jest-mock-extended";

import { makeEncString, makeSymmetricCryptoKey } from "../../../../spec";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";

import Domain from "./domain-base";

class TestDomain extends Domain {
  plainText: string;
  encToString: EncString;
  encString2: EncString;
}

describe("DomainBase", () => {
  let encryptService: MockProxy<EncryptService>;
  const key = makeSymmetricCryptoKey(64);

  beforeEach(() => {
    encryptService = mock<EncryptService>();
  });

  function setUpCryptography() {
    encryptService.encryptString.mockImplementation((value) =>
      Promise.resolve(makeEncString(value)),
    );

    encryptService.decryptString.mockImplementation((value) => {
      return Promise.resolve(value.data);
    });
  }

  describe("decryptWithKey", () => {
    it("domain property types are decryptable", async () => {
      const domain = new TestDomain();

      await domain["decryptObjWithKey"](
        // @ts-expect-error -- clear is not of type EncString
        ["plainText"],
        makeSymmetricCryptoKey(64),
        mock<EncryptService>(),
      );

      await domain["decryptObjWithKey"](
        // @ts-expect-error -- Clear is not of type EncString
        ["encToString", "encString2", "plainText"],
        makeSymmetricCryptoKey(64),
        mock<EncryptService>(),
      );

      const decrypted = await domain["decryptObjWithKey"](
        ["encToString"],
        makeSymmetricCryptoKey(64),
        mock<EncryptService>(),
      );

      // @ts-expect-error -- encString2 was not decrypted
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      decrypted as { encToString: string; encString2: string; plainText: string };

      // encString2 was not decrypted, so it's still an EncString
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      decrypted as { encToString: string; encString2: EncString; plainText: string };
    });

    it("decrypts the encrypted properties", async () => {
      setUpCryptography();

      const domain = new TestDomain();

      domain.encToString = await encryptService.encryptString("string", key);

      const decrypted = await domain["decryptObjWithKey"](["encToString"], key, encryptService);

      expect(decrypted).toEqual({
        encToString: "string",
      });
    });

    it("decrypts multiple encrypted properties", async () => {
      setUpCryptography();

      const domain = new TestDomain();

      domain.encToString = await encryptService.encryptString("string", key);
      domain.encString2 = await encryptService.encryptString("string2", key);

      const decrypted = await domain["decryptObjWithKey"](
        ["encToString", "encString2"],
        key,
        encryptService,
      );

      expect(decrypted).toEqual({
        encToString: "string",
        encString2: "string2",
      });
    });

    it("does not decrypt properties that are not encrypted", async () => {
      const domain = new TestDomain();
      domain.plainText = "clear";

      const decrypted = await domain["decryptObjWithKey"]([], key, encryptService);

      expect(decrypted).toEqual({
        plainText: "clear",
      });
    });

    it("does not decrypt properties that were not requested to be decrypted", async () => {
      setUpCryptography();

      const domain = new TestDomain();

      domain.plainText = "clear";
      domain.encToString = makeEncString("string");
      domain.encString2 = makeEncString("string2");

      const decrypted = await domain["decryptObjWithKey"]([], key, encryptService);

      expect(decrypted).toEqual({
        plainText: "clear",
        encToString: makeEncString("string"),
        encString2: makeEncString("string2"),
      });
    });
  });
});
