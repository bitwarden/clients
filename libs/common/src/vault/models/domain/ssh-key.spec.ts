import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { EncString as SdkEncString, SshKey as SdkSshKey } from "@bitwarden/sdk-internal";

import { mockEnc } from "../../../../spec";
import { SshKeyApi } from "../api/ssh-key.api";
import { SshKeyData } from "../data/ssh-key.data";

import { SshKey } from "./ssh-key";

describe("Sshkey", () => {
  let data: SshKeyData;

  beforeEach(() => {
    data = new SshKeyData(
      new SshKeyApi({
        PrivateKey: "privateKey",
        PublicKey: "publicKey",
        KeyFingerprint: "keyFingerprint",
      }),
    );
  });

  it("Convert", () => {
    const sshKey = new SshKey(data);

    expect(sshKey).toEqual({
      privateKey: { encryptedString: "privateKey", encryptionType: 0 },
      publicKey: { encryptedString: "publicKey", encryptionType: 0 },
      keyFingerprint: { encryptedString: "keyFingerprint", encryptionType: 0 },
    });
  });

  it("Convert from empty", () => {
    const data = new SshKeyData();
    const sshKey = new SshKey(data);

    expect(sshKey).toBeInstanceOf(SshKey);
    expect(sshKey.privateKey).toBeInstanceOf(EncString);
    expect(sshKey.publicKey).toBeInstanceOf(EncString);
    expect(sshKey.keyFingerprint).toBeInstanceOf(EncString);
    expect(data.privateKey).toBeUndefined();
    expect(data.publicKey).toBeUndefined();
    expect(data.keyFingerprint).toBeUndefined();
  });

  it("toSshKeyData", () => {
    const sshKey = new SshKey(data);
    expect(sshKey.toSshKeyData()).toEqual(data);
  });

  it("Decrypt", async () => {
    const sshKey = Object.assign(new SshKey(), {
      privateKey: mockEnc("privateKey"),
      publicKey: mockEnc("publicKey"),
      keyFingerprint: mockEnc("keyFingerprint"),
    });
    const expectedView = {
      privateKey: "privateKey",
      publicKey: "publicKey",
      keyFingerprint: "keyFingerprint",
    };

    const loginView = await sshKey.decrypt(null);
    expect(loginView).toEqual(expectedView);
  });

  describe("fromJSON", () => {
    it("returns undefined if object is null", () => {
      expect(SshKey.fromJSON(null)).toBeUndefined();
    });

    it("creates SshKey instance from JSON object", () => {
      const jsonObj = {
        privateKey: "2.privateKey|encryptedData",
        publicKey: "2.publicKey|encryptedData",
        keyFingerprint: "2.keyFingerprint|encryptedData",
      };

      const result = SshKey.fromJSON(jsonObj);

      expect(result).toBeInstanceOf(SshKey);
      expect(result.privateKey).toBeDefined();
      expect(result.publicKey).toBeDefined();
      expect(result.keyFingerprint).toBeDefined();
    });
  });

  describe("toSdkSshKey", () => {
    it("returns the correct SDK SshKey object", () => {
      const sshKey = new SshKey(data);
      const sdkSshKey = sshKey.toSdkSshKey();

      expect(sdkSshKey).toEqual({
        privateKey: "privateKey",
        publicKey: "publicKey",
        fingerprint: "keyFingerprint",
      });
    });
  });

  describe("fromSdkSshKey", () => {
    it("returns undefined when null is provided", () => {
      const result = SshKey.fromSdkSshKey(null);

      expect(result).toBeUndefined();
    });

    it("returns undefined when undefined is provided", () => {
      const result = SshKey.fromSdkSshKey(undefined);

      expect(result).toBeUndefined();
    });

    it("creates SshKey from SDK object", () => {
      const sdkSshKey: SdkSshKey = {
        privateKey: "2.privateKey|encryptedData" as SdkEncString,
        publicKey: "2.publicKey|encryptedData" as SdkEncString,
        fingerprint: "2.keyFingerprint|encryptedData" as SdkEncString,
      };

      const result = SshKey.fromSdkSshKey(sdkSshKey);

      expect(result).toBeInstanceOf(SshKey);
      expect(result.privateKey).toBeDefined();
      expect(result.publicKey).toBeDefined();
      expect(result.keyFingerprint).toBeDefined();
    });

    it("creates a new SshKey instance", () => {
      const sdkSshKey: SdkSshKey = {
        privateKey: "2.privateKey|encryptedData" as SdkEncString,
        publicKey: "2.publicKey|encryptedData" as SdkEncString,
        fingerprint: "2.keyFingerprint|encryptedData" as SdkEncString,
      };

      const result = SshKey.fromSdkSshKey(sdkSshKey);

      expect(result).not.toBe(sdkSshKey);
      expect(result).toBeInstanceOf(SshKey);
    });

    it("is symmetric with toSdkSshKey", () => {
      const original = new SshKey(data);
      const sdkFormat = original.toSdkSshKey();
      const reconstructed = SshKey.fromSdkSshKey(sdkFormat);

      expect(reconstructed.privateKey.encryptedString).toBe(original.privateKey.encryptedString);
      expect(reconstructed.publicKey.encryptedString).toBe(original.publicKey.encryptedString);
      expect(reconstructed.keyFingerprint.encryptedString).toBe(
        original.keyFingerprint.encryptedString,
      );
    });
  });
});
