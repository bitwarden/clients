import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";

import { SshKeyExport } from "./ssh-key.export";

describe("toView", () => {
  const validSshKey = {
    privateKey: "PRIVATE_KEY",
    publicKey: "PUBLIC_KEY",
    keyFingerprint: "FINGERPRINT",
  };

  it.each([null, undefined, "", "   "])("should throw when privateKey is %p", (value) => {
    const sshKey = new SshKeyExport({ ...validSshKey, privateKey: value as any } as any);
    expect(() => SshKeyExport.toView(sshKey)).toThrow("SSH key private key is required.");
  });

  it.each([null, undefined, "", "   "])("should throw when publicKey is %p", (value) => {
    const sshKey = new SshKeyExport({ ...validSshKey, publicKey: value as any } as any);
    expect(() => SshKeyExport.toView(sshKey)).toThrow("SSH key public key is required.");
  });

  it.each([null, undefined, "", "   "])("should throw when keyFingerprint is %p", (value) => {
    const sshKey = new SshKeyExport({ ...validSshKey, keyFingerprint: value as any } as any);
    expect(() => SshKeyExport.toView(sshKey)).toThrow("SSH key fingerprint is required.");
  });

  it("should succeed with valid inputs", () => {
    const sshKey = new SshKeyExport(SshKeyView.fromJSON({ ...validSshKey }));
    const result = SshKeyExport.toView(sshKey);
    expect(result).toBeDefined();
    expect(result?.privateKey).toBe(validSshKey.privateKey);
    expect(result?.publicKey).toBe(validSshKey.publicKey);
    expect(result?.keyFingerprint).toBe(validSshKey.keyFingerprint);
  });
});
