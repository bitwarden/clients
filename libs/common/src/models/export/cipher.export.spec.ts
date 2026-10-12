import { CipherType } from "../../vault/enums";
import { Cipher } from "../../vault/models/domain/cipher";
import { Login } from "../../vault/models/domain/login";
import { CipherView } from "../../vault/models/view/cipher.view";
import { conditionalEncString } from "../../vault/utils/domain-utils";

import { CipherExport } from "./cipher.export";
import { SecureNoteExport } from "./secure-note.export";
import { SshKeyExport } from "./ssh-key.export";

describe("Cipher Export", () => {
  describe("toView", () => {
    it("should preserve existing date values when request dates are undefined", () => {
      const existingView = new CipherView();
      existingView.creationDate = new Date("2023-01-01T00:00:00Z");
      existingView.revisionDate = new Date("2023-01-02T00:00:00Z");
      existingView.deletedDate = new Date("2023-01-03T00:00:00Z");

      const request = CipherExport.template();
      request.type = CipherType.SecureNote;
      request.secureNote = SecureNoteExport.template();
      request.creationDate = undefined;
      request.revisionDate = undefined;
      request.deletedDate = undefined;

      const resultView = CipherExport.toView(request, existingView);
      expect(resultView.creationDate).toEqual(existingView.creationDate);
      expect(resultView.revisionDate).toEqual(existingView.revisionDate);
      expect(resultView.deletedDate).toEqual(existingView.deletedDate);
    });

    it("should set date values when request dates are provided", () => {
      const request = CipherExport.template();
      request.type = CipherType.SecureNote;
      request.secureNote = SecureNoteExport.template();
      request.creationDate = new Date("2023-01-01T00:00:00Z");
      request.revisionDate = new Date("2023-01-02T00:00:00Z");
      request.deletedDate = new Date("2023-01-03T00:00:00Z");

      const resultView = CipherExport.toView(request);
      expect(resultView.creationDate).toEqual(request.creationDate);
      expect(resultView.revisionDate).toEqual(request.revisionDate);
      expect(resultView.deletedDate).toEqual(request.deletedDate);
    });
  });

  // Blob ciphers seal all content in `data`; the legacy per-field properties are undefined.
  describe("blob ciphers", () => {
    const sealedData = '{"format_version":1,"wrapped_cek":"2.a|b|c","envelope":"g1hH"}';
    const cipherKey = "CIPHER_KEY";

    function blobCipher(): Cipher {
      const cipher = new Cipher();
      cipher.id = "25c8c414-b446-48e9-a1bd-b10700bbd740";
      cipher.type = CipherType.Login;
      cipher.key = conditionalEncString(cipherKey);
      cipher.data = sealedData;
      return cipher;
    }

    it("build exports the sealed data", () => {
      const exported = new CipherExport();
      exported.build(blobCipher());

      expect(exported.data).toBe(sealedData);
    });

    it("build exports the cipher key", () => {
      const exported = new CipherExport();
      exported.build(blobCipher());

      expect(exported.key).toBe(cipherKey);
    });

    it("build does not export empty legacy content", () => {
      const exported = new CipherExport();
      exported.build(blobCipher());

      expect(exported.login).toBeUndefined();
    });

    it("build does not export the name", () => {
      const exported = new CipherExport();
      exported.build(blobCipher());

      expect(JSON.parse(JSON.stringify(exported))).not.toHaveProperty("name");
    });

    it("toDomain restores the sealed data", () => {
      const exported = new CipherExport();
      exported.build(blobCipher());

      const domain = CipherExport.toDomain(exported);

      expect(domain.data).toBe(sealedData);
    });

    it("toDomain leaves legacy content undefined", () => {
      const exported = new CipherExport();
      exported.build(blobCipher());

      const domain = CipherExport.toDomain(exported);

      expect(domain.name).toBeUndefined();
      expect(domain.login).toBeUndefined();
    });
  });

  // Legacy ciphers carry a non-blob `data` copy; export their per-field properties instead.
  describe("legacy ciphers", () => {
    const encName = "2.name|iv|mac";
    const encUsername = "2.user|iv|mac";

    function legacyCipher(): Cipher {
      const cipher = new Cipher();
      cipher.type = CipherType.Login;
      cipher.name = conditionalEncString(encName);
      cipher.login = new Login();
      cipher.login.username = conditionalEncString(encUsername);
      cipher.data = JSON.stringify({ Name: encName, Username: encUsername });
      return cipher;
    }

    it("build does not export the data", () => {
      const exported = new CipherExport();
      exported.build(legacyCipher());

      expect(exported.data).toBeUndefined();
    });

    it("build exports the name", () => {
      const exported = new CipherExport();
      exported.build(legacyCipher());

      expect(exported.name).toBe(encName);
    });

    it("build exports the type specific content", () => {
      const exported = new CipherExport();
      exported.build(legacyCipher());

      expect(exported.login?.username).toBe(encUsername);
    });
  });

  describe("SshKeyExport.toView", () => {
    const validSshKey = {
      privateKey: "PRIVATE_KEY",
      publicKey: "PUBLIC_KEY",
      keyFingerprint: "FINGERPRINT",
    };

    it.each([null, undefined, "", "   "])("should throw when privateKey is %p", (value) => {
      const sshKey = { ...validSshKey, privateKey: value } as any;
      expect(() => SshKeyExport.toView(sshKey)).toThrow("SSH key private key is required.");
    });

    it.each([null, undefined, "", "   "])("should throw when publicKey is %p", (value) => {
      const sshKey = { ...validSshKey, publicKey: value } as any;
      expect(() => SshKeyExport.toView(sshKey)).toThrow("SSH key public key is required.");
    });

    it.each([null, undefined, "", "   "])("should throw when keyFingerprint is %p", (value) => {
      const sshKey = { ...validSshKey, keyFingerprint: value } as any;
      expect(() => SshKeyExport.toView(sshKey)).toThrow("SSH key fingerprint is required.");
    });

    it.each([null, undefined, ""])(
      "should not throw for a missing publicKey when derived keys are allowed (value %p)",
      (value) => {
        const sshKey = { ...validSshKey, publicKey: value } as any;
        expect(() => SshKeyExport.toView(sshKey, undefined, true)).not.toThrow();
      },
    );

    it.each([null, undefined, ""])(
      "should not throw for a missing keyFingerprint when derived keys are allowed (value %p)",
      (value) => {
        const sshKey = { ...validSshKey, keyFingerprint: value } as any;
        expect(() => SshKeyExport.toView(sshKey, undefined, true)).not.toThrow();
      },
    );

    it("should succeed with valid inputs", () => {
      const sshKey = { ...validSshKey };
      const result = SshKeyExport.toView(sshKey);
      expect(result).toBeDefined();
      expect(result?.privateKey).toBe(validSshKey.privateKey);
      expect(result?.publicKey).toBe(validSshKey.publicKey);
      expect(result?.keyFingerprint).toBe(validSshKey.keyFingerprint);
    });
  });
});
