import { mockEnc } from "../../../../spec";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { EncryptionType } from "../../../platform/enums";
import { Fido2CredentialData } from "../data/fido2-credential.data";

import { Fido2Credential } from "./fido2-credential";

describe("Fido2Credential", () => {
  let mockDate: Date;

  beforeEach(() => {
    mockDate = new Date("2023-01-01T12:00:00.000Z");
  });

  describe("constructor", () => {
    it("returns all fields undefined when given empty data parameter", () => {
      const data = new Fido2CredentialData();
      const credential = new Fido2Credential(data);

      expect(credential.credentialId).toBeDefined();
      expect(credential.keyType).toBeDefined();
      expect(credential.keyAlgorithm).toBeDefined();
      expect(credential.keyCurve).toBeDefined();
      expect(credential.keyValue).toBeDefined();
      expect(credential.rpId).toBeDefined();
      expect(credential.counter).toBeDefined();
      expect(credential.discoverable).toBeDefined();
      expect(credential.userHandle).toBeUndefined();
      expect(credential.userName).toBeUndefined();
      expect(credential.rpName).toBeUndefined();
      expect(credential.userDisplayName).toBeUndefined();
      expect(credential.creationDate).toBeInstanceOf(Date);
    });

    it("returns all fields as EncStrings except creationDate when given full Fido2CredentialData", () => {
      const data: Fido2CredentialData = {
        credentialId: "credentialId",
        keyType: "public-key",
        keyAlgorithm: "ECDSA",
        keyCurve: "P-256",
        keyValue: "keyValue",
        rpId: "rpId",
        userHandle: "userHandle",
        userName: "userName",
        counter: "counter",
        rpName: "rpName",
        userDisplayName: "userDisplayName",
        discoverable: "discoverable",
        creationDate: mockDate.toISOString(),
      };
      const credential = new Fido2Credential(data);

      expect(credential).toEqual({
        credentialId: { encryptedString: "credentialId", encryptionType: 0 },
        keyType: { encryptedString: "public-key", encryptionType: 0 },
        keyAlgorithm: { encryptedString: "ECDSA", encryptionType: 0 },
        keyCurve: { encryptedString: "P-256", encryptionType: 0 },
        keyValue: { encryptedString: "keyValue", encryptionType: 0 },
        rpId: { encryptedString: "rpId", encryptionType: 0 },
        userHandle: { encryptedString: "userHandle", encryptionType: 0 },
        userName: { encryptedString: "userName", encryptionType: 0 },
        counter: { encryptedString: "counter", encryptionType: 0 },
        rpName: { encryptedString: "rpName", encryptionType: 0 },
        userDisplayName: { encryptedString: "userDisplayName", encryptionType: 0 },
        discoverable: { encryptedString: "discoverable", encryptionType: 0 },
        creationDate: mockDate,
      });
    });

    it("should not populate fields when data parameter is not given except creationDate", () => {
      const credential = new Fido2Credential();

      expect(credential.credentialId).toBeUndefined();
      expect(credential.keyType).toBeUndefined();
      expect(credential.keyAlgorithm).toBeUndefined();
      expect(credential.keyCurve).toBeUndefined();
      expect(credential.keyValue).toBeUndefined();
      expect(credential.rpId).toBeUndefined();
      expect(credential.userHandle).toBeUndefined();
      expect(credential.userName).toBeUndefined();
      expect(credential.counter).toBeUndefined();
      expect(credential.rpName).toBeUndefined();
      expect(credential.userDisplayName).toBeUndefined();
      expect(credential.discoverable).toBeUndefined();
      expect(credential.creationDate).toBeInstanceOf(Date);
    });
  });

  describe("decrypt", () => {
    it("decrypts and populates all fields when populated with EncStrings", async () => {
      const credential = new Fido2Credential();
      credential.credentialId = mockEnc("credentialId");
      credential.keyType = mockEnc("keyType");
      credential.keyAlgorithm = mockEnc("keyAlgorithm");
      credential.keyCurve = mockEnc("keyCurve");
      credential.keyValue = mockEnc("keyValue");
      credential.rpId = mockEnc("rpId");
      credential.userHandle = mockEnc("userHandle");
      credential.userName = mockEnc("userName");
      credential.counter = mockEnc("2");
      credential.rpName = mockEnc("rpName");
      credential.userDisplayName = mockEnc("userDisplayName");
      credential.discoverable = mockEnc("true");
      credential.creationDate = mockDate;

      const credentialView = await credential.decrypt(null, null);

      expect(credentialView).toEqual({
        credentialId: "credentialId",
        keyType: "keyType",
        keyAlgorithm: "keyAlgorithm",
        keyCurve: "keyCurve",
        keyValue: "keyValue",
        rpId: "rpId",
        userHandle: "userHandle",
        userName: "userName",
        rpName: "rpName",
        userDisplayName: "userDisplayName",
        counter: 2,
        discoverable: true,
        creationDate: mockDate,
      });
    });
  });

  describe("toFido2CredentialData", () => {
    it("encodes to data object when converted from Fido2CredentialData and back", () => {
      const data: Fido2CredentialData = {
        credentialId: "credentialId",
        keyType: "public-key",
        keyAlgorithm: "ECDSA",
        keyCurve: "P-256",
        keyValue: "keyValue",
        rpId: "rpId",
        userHandle: "userHandle",
        userName: "userName",
        counter: "2",
        rpName: "rpName",
        userDisplayName: "userDisplayName",
        discoverable: "true",
        creationDate: mockDate.toISOString(),
      };

      const credential = new Fido2Credential(data);
      const result = credential.toFido2CredentialData();

      expect(result).toEqual(data);
    });
  });

  describe("fromJSON", () => {
    it("recreates equivalent object when converted to JSON and back", () => {
      const credential = new Fido2Credential();
      credential.credentialId = createEncryptedEncString("credentialId");
      credential.keyType = createEncryptedEncString("keyType");
      credential.keyAlgorithm = createEncryptedEncString("keyAlgorithm");
      credential.keyCurve = createEncryptedEncString("keyCurve");
      credential.keyValue = createEncryptedEncString("keyValue");
      credential.rpId = createEncryptedEncString("rpId");
      credential.userHandle = createEncryptedEncString("userHandle");
      credential.userName = createEncryptedEncString("userName");
      credential.counter = createEncryptedEncString("2");
      credential.rpName = createEncryptedEncString("rpName");
      credential.userDisplayName = createEncryptedEncString("userDisplayName");
      credential.discoverable = createEncryptedEncString("discoverable");
      credential.creationDate = mockDate;

      const json = JSON.stringify(credential);
      const result = Fido2Credential.fromJSON(JSON.parse(json));

      expect(result).toEqual(credential);
    });

    it("returns undefined if input is null", () => {
      expect(Fido2Credential.fromJSON(null)).toBeUndefined();
    });
  });

  describe("SDK Fido2Credential Mapping", () => {
    it("should map to SDK Fido2Credential", () => {
      const data: Fido2CredentialData = {
        credentialId: "credentialId",
        keyType: "public-key",
        keyAlgorithm: "ECDSA",
        keyCurve: "P-256",
        keyValue: "keyValue",
        rpId: "rpId",
        userHandle: "userHandle",
        userName: "userName",
        counter: "2",
        rpName: "rpName",
        userDisplayName: "userDisplayName",
        discoverable: "discoverable",
        creationDate: mockDate.toISOString(),
      };

      const credential = new Fido2Credential(data);
      const sdkCredential = credential.toSdkFido2Credential();

      expect(sdkCredential).toEqual({
        credentialId: "credentialId",
        keyType: "public-key",
        keyAlgorithm: "ECDSA",
        keyCurve: "P-256",
        keyValue: "keyValue",
        rpId: "rpId",
        userHandle: "userHandle",
        userName: "userName",
        counter: "2",
        rpName: "rpName",
        userDisplayName: "userDisplayName",
        discoverable: "discoverable",
        creationDate: mockDate.toISOString(),
      });
    });
  });
});

function createEncryptedEncString(s: string): EncString {
  return new EncString(`${EncryptionType.AesCbc256_HmacSha256_B64}.${s}`);
}
