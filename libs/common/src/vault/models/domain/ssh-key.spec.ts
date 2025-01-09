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

    expect(sshKey).toEqual({
      privateKey: null,
      publicKey: null,
      keyFingerprint: null,
    });
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
    it("returns null if object is null", () => {
      expect(SshKey.fromJSON(null)).toBeNull();
    });
  });
});
