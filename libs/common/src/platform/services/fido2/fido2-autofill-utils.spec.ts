import { CipherType } from "../../../vault/enums";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import { LoginUriView } from "../../../vault/models/view/login-uri.view";
import { LoginView } from "../../../vault/models/view/login.view";

import { getCredentialsForAutofill } from "./fido2-autofill-utils";

function createCipher(fido2Overrides: Partial<Fido2CredentialView> = {}): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-id";
  cipher.type = CipherType.Login;
  cipher.name = "acme.com";

  cipher.login = new LoginView();
  cipher.login.username = "user@example.com";
  cipher.login.uris = [Object.assign(new LoginUriView(), { uri: "https://acme.com" })];

  const fido2Credential = Object.assign(new Fido2CredentialView(), {
    credentialId: "e75fc430-01f5-482d-a4ec-c72d710705de",
    keyType: "public-key",
    keyAlgorithm: "ECDSA",
    keyCurve: "P-256",
    rpId: "acme.com",
    userHandle: "NWZuGJdmCKnVupDQ5dsXOB1MSm_RKkoPV2jmcXOtNRo",
    userName: undefined,
    counter: 0,
    rpName: "Acme Corp",
    userDisplayName: "Bob Parr",
    discoverable: true,
    ...fido2Overrides,
  } satisfies Partial<Fido2CredentialView>);

  cipher.login.fido2Credentials = [fido2Credential];

  return cipher;
}

describe("getCredentialsForAutofill", () => {
  describe("when the fido2Credential userName is null", () => {
    it("falls back to the userDisplayName", async () => {
      const cipher = createCipher({ userName: undefined, userDisplayName: "Bob Parr" });

      const [result] = await getCredentialsForAutofill([cipher]);

      expect(result.userName).toBe("Bob Parr");
    });

    it("falls back to the cipher login username when userDisplayName is also empty", async () => {
      const cipher = createCipher({ userName: undefined, userDisplayName: undefined });

      const [result] = await getCredentialsForAutofill([cipher]);

      expect(result.userName).toBe("user@example.com");
    });

    it("falls back to the cipher name when userDisplayName and login username are empty", async () => {
      const cipher = createCipher({ userName: undefined, userDisplayName: undefined });
      cipher.login.username = undefined;

      const [result] = await getCredentialsForAutofill([cipher]);

      expect(result.userName).toBe("acme.com");
    });
  });
});
