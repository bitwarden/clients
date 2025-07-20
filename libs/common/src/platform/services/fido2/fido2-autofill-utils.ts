// TODO: Add tests for this method

import { CipherType } from "../../../vault/enums";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { Fido2CredentialAutofillView } from "../../../vault/models/view/fido2-credential-autofill.view";
import { Utils } from "../../misc/utils";

import { parseCredentialId } from "./credential-id-utils";

// TODO: Move into Fido2AuthenticatorService
export async function getCredentialsForAutofill(
  ciphers: CipherView[],
): Promise<Fido2CredentialAutofillView[]> {
  return ciphers
    .filter(
      (cipher) =>
        !cipher.isDeleted && cipher.type === CipherType.Login && cipher.login.hasFido2Credentials,
    )
    .map((cipher) => {
      const credential = cipher.login.fido2Credentials[0];

      // Credentials are stored as a GUID or b64 string with `b64.` prepended,
      // but we need to return them as a URL-safe base64 string
      const credId = Utils.fromBufferToUrlB64(parseCredentialId(credential.credentialId));

      return {
        cipherId: cipher.id,
        credentialId: credId,
        rpId: credential.rpId,
        userHandle: credential.userHandle,
        userName: credential.userName,
      };
    });
}
