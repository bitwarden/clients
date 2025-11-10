import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";

import { Fido2CredentialExport } from "./fido2-credential.export";

describe("Fido2CredentialsExport", () => {
  describe("toView", () => {
    const validFido2Credential = {
      credentialId: "CREDENTIAL_ID",
      keyType: "keyType",
      keyAlgorithm: "keyAlgorithm",
      keyCurve: "keyCurve",
      keyValue: "keyValue",
      rpId: "rpId",
      userHandle: "userHandle",
      userName: "userName",
      counter: 123,
      discoverable: "true",
      creationDate: new Date(),
    };

    it.each([null, undefined, "", "   "])("should throw when credentialId is %p", (value) => {
      const fido2Credential = new Fido2CredentialExport({
        ...validFido2Credential,
        credentialId: value as any,
      } as any);
      expect(() => Fido2CredentialExport.toView(fido2Credential)).toThrow(
        "FIDO2 credential ID is required.",
      );
    });

    it.each([null, undefined, "", "   "])("should throw when keyType is %p", (value) => {
      const fido2Credential = new Fido2CredentialExport({
        ...validFido2Credential,
        keyType: value as any,
      } as any);
      expect(() => Fido2CredentialExport.toView(fido2Credential)).toThrow(
        "FIDO2 key type is required.",
      );
    });

    it.each([null, undefined, "", "   "])("should throw when keyAlgorithm is %p", (value) => {
      const fido2Credential = new Fido2CredentialExport({
        ...validFido2Credential,
        keyAlgorithm: value as any,
      } as any);
      expect(() => Fido2CredentialExport.toView(fido2Credential)).toThrow(
        "FIDO2 key algorithm is required.",
      );
    });

    it.each([null, undefined, "", "   "])("should throw when keyCurve is %p", (value) => {
      const fido2Credential = new Fido2CredentialExport({
        ...validFido2Credential,
        keyCurve: value as any,
      } as any);
      expect(() => Fido2CredentialExport.toView(fido2Credential)).toThrow(
        "FIDO2 key curve is required.",
      );
    });

    it.each([null, undefined, "", "   "])("should throw when keyValue is %p", (value) => {
      const fido2Credential = new Fido2CredentialExport({
        ...validFido2Credential,
        keyValue: value as any,
      } as any);
      expect(() => Fido2CredentialExport.toView(fido2Credential)).toThrow(
        "FIDO2 key value is required.",
      );
    });

    it.each([null, undefined, "", "   "])("should throw when rpId is %p", (value) => {
      const fido2Credential = new Fido2CredentialExport({
        ...validFido2Credential,
        rpId: value as any,
      } as any);
      expect(() => Fido2CredentialExport.toView(fido2Credential)).toThrow(
        "FIDO2 relying party ID is required.",
      );
    });

    it.each([null, undefined])("should throw when counter is %p", (value) => {
      const fido2Credential = new Fido2CredentialExport({
        ...validFido2Credential,
        counter: value as any,
      } as any);
      expect(() => Fido2CredentialExport.toView(fido2Credential)).toThrow(
        "FIDO2 counter is required.",
      );
    });

    it("should succeed with valid inputs", () => {
      const fido2Credential = new Fido2CredentialExport(
        Fido2CredentialView.fromJSON({ ...validFido2Credential } as any),
      );
      const result = Fido2CredentialExport.toView(fido2Credential);
      expect(result).toBeDefined();
      expect(result?.credentialId).toBe(validFido2Credential.credentialId);
      expect(result?.keyType).toBe(validFido2Credential.keyType);
      expect(result?.counter).toBe(validFido2Credential.counter);
    });
  });
});
