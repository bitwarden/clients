import { CipherType } from "../../vault/enums";
import { CipherView } from "../../vault/models/view/cipher.view";

/**
 * Whether a cipher may answer an HTTP authentication challenge: a login with at least one URI. This does
 * not check whether HTTP authentication is turned on for the login; see
 * {@link hasOptedInToHTTPAuthentication}.
 */
export function isEligibleForHTTPAuthentication(cipher: CipherView): boolean {
  return cipher.type === CipherType.Login && cipher.login?.hasUris === true;
}

/** Whether a login has HTTP authentication turned on in its own settings. */
export function hasOptedInToHTTPAuthentication(cipher: CipherView): boolean {
  return cipher.type === CipherType.Login && cipher.login?.httpAuthenticationEnabled === true;
}
