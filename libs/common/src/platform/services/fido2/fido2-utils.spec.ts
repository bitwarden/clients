import { mock } from "jest-mock-extended";

import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";

import { Fido2Utils } from "./fido2-utils";

describe("Fido2 Utils", () => {
  const asciiHelloWorldArray = [104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100];
  const b64HelloWorldString = "aGVsbG8gd29ybGQ=";

  describe("bufferSourceToUint8Array(..)", () => {
    it("should convert an ArrayBuffer", () => {
      const buffer = new Uint8Array(asciiHelloWorldArray).buffer;
      const out = Fido2Utils.bufferSourceToUint8Array(buffer);
      expect(out).toEqual(new Uint8Array(asciiHelloWorldArray));
    });
    it("should convert an ArrayBuffer slice", () => {
      const buffer = new Uint8Array(asciiHelloWorldArray).buffer.slice(8);
      const out = Fido2Utils.bufferSourceToUint8Array(buffer);
      expect(out).toEqual(new Uint8Array([114, 108, 100])); // 8th byte onwards
    });
    it("should pass through an Uint8Array", () => {
      const typedArray = new Uint8Array(asciiHelloWorldArray);
      const out = Fido2Utils.bufferSourceToUint8Array(typedArray);
      expect(out).toEqual(new Uint8Array(asciiHelloWorldArray));
    });
    it("should preserve the view of TypedArray", () => {
      const buffer = new Uint8Array(asciiHelloWorldArray).buffer;
      const input = new Uint8Array(buffer, 8, 1);
      const out = Fido2Utils.bufferSourceToUint8Array(input);
      expect(out).toEqual(new Uint8Array([114]));
    });
    it("should convert different TypedArrays", () => {
      const buffer = new Uint8Array(asciiHelloWorldArray).buffer;
      const input = new Uint16Array(buffer, 8, 1);
      const out = Fido2Utils.bufferSourceToUint8Array(input);
      expect(out).toEqual(new Uint8Array([114, 108]));
    });
  });

  describe("fromBufferToB64(...)", () => {
    it("should convert an ArrayBuffer to a b64 string", () => {
      const buffer = new Uint8Array(asciiHelloWorldArray).buffer;
      const b64String = Fido2Utils.fromBufferToB64(buffer);
      expect(b64String).toBe(b64HelloWorldString);
    });

    it("should return an empty string when given an empty ArrayBuffer", () => {
      const buffer = new Uint8Array([]).buffer;
      const b64String = Fido2Utils.fromBufferToB64(buffer);
      expect(b64String).toBe("");
    });

    it("should return null when given null input", () => {
      const b64String = Fido2Utils.fromBufferToB64(null);
      expect(b64String).toBeNull();
    });
  });

  describe("fromB64ToArray(...)", () => {
    it("should convert a b64 string to an Uint8Array", () => {
      const expectedArray = new Uint8Array(asciiHelloWorldArray);

      const resultArray = Fido2Utils.fromB64ToArray(b64HelloWorldString);

      expect(resultArray).toEqual(expectedArray);
    });

    it("should return null when given null input", () => {
      const expectedArray = Fido2Utils.fromB64ToArray(null);
      expect(expectedArray).toBeNull();
    });
  });

  describe("cipherHasNoOtherPasskeys(...)", () => {
    const emptyPasskeyCipher = mock<CipherView>({
      id: "id-5",
      localData: { lastUsedDate: 222 },
      name: "name-5",
      type: CipherType.Login,
      login: {
        username: "username-5",
        password: "password",
        uri: "https://example.com",
        fido2Credentials: [],
      },
    });

    const passkeyCipher = mock<CipherView>({
      id: "id-5",
      localData: { lastUsedDate: 222 },
      name: "name-5",
      type: CipherType.Login,
      login: {
        username: "username-5",
        password: "password",
        uri: "https://example.com",
        fido2Credentials: [
          mock<Fido2CredentialView>({
            credentialId: "credential-id",
            rpName: "credential-name",
            userHandle: "user-handle-1",
            userName: "credential-username",
            rpId: "jest-testing-website.com",
          }),
          mock<Fido2CredentialView>({
            credentialId: "credential-id",
            rpName: "credential-name",
            userHandle: "user-handle-2",
            userName: "credential-username",
            rpId: "jest-testing-website.com",
          }),
        ],
      },
    });

    it("should return true when there is no userHandle", () => {
      const userHandle = "user-handle-1";
      expect(Fido2Utils.cipherHasNoOtherPasskeys(emptyPasskeyCipher, userHandle)).toBeTruthy();
    });

    it("should return true when userHandle matches", () => {
      const userHandle = "user-handle-1";
      expect(Fido2Utils.cipherHasNoOtherPasskeys(passkeyCipher, userHandle)).toBeTruthy();
    });

    it("should return false when userHandle doesn't match", () => {
      const userHandle = "testing";
      expect(Fido2Utils.cipherHasNoOtherPasskeys(passkeyCipher, userHandle)).toBeFalsy();
    });
  });
});
