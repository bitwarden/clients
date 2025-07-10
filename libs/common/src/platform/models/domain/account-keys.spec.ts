import { makeStaticByteArray } from "../../../../spec";
import { Utils } from "../../misc/utils";

import { AccountKeys, EncryptionPair } from "./account";

describe("AccountKeys", () => {
  describe("toJSON", () => {
    it("should serialize itself", () => {
      const keys = new AccountKeys();
      const buffer = makeStaticByteArray(64);
      keys.publicKey = buffer;

      const bufferSpy = jest.spyOn(Utils, "fromBufferToByteString");
      keys.toJSON();
      expect(bufferSpy).toHaveBeenCalledWith(buffer);
    });

    it("should serialize public key as a string", () => {
      const keys = new AccountKeys();
      keys.publicKey = Utils.fromByteStringToArray("hello");
      const json = JSON.stringify(keys);
      expect(json).toContain('"publicKey":"hello"');
    });
  });

  describe("fromJSON", () => {
    it("should deserialize public key to a buffer", () => {
      const keys = AccountKeys.fromJSON({
        publicKey: "hello",
      });
      expect(keys.publicKey).toEqual(Utils.fromByteStringToArray("hello"));
    });

    it("should deserialize privateKey", () => {
      const spy = jest.spyOn(EncryptionPair, "fromJSON");
      AccountKeys.fromJSON({
        privateKey: { encrypted: "encrypted", decrypted: "decrypted" },
      } as any);
      expect(spy).toHaveBeenCalled();
    });
  });
});
