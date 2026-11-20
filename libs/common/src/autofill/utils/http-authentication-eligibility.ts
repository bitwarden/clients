import { UriMatchStrategySetting } from "../../models/domain/domain-service";
import { CipherRepromptType, CipherType } from "../../vault/enums";
import { CipherView } from "../../vault/models/view/cipher.view";

/**
 * Whether every URI has an explicitly chosen match strategy. A URI using "Default" (`null` or
 * `undefined`) inherits the device's global strategy, which can change without the user editing the
 * login, so it never qualifies.
 *
 * An empty list qualifies, so a login can hold the HTTP authentication setting before any URIs are added.
 */
export function everyUriHasExplicitMatchStrategy(
  matchStrategies: ReadonlyArray<UriMatchStrategySetting | undefined>,
): boolean {
  return matchStrategies.every((matchStrategy) => matchStrategy != null);
}

/**
 * Whether master password reprompt is off. HTTP authentication answers a challenge without user
 * interaction, so it can never release a reprompt-protected credential.
 */
export function isRepromptOff(reprompt: CipherRepromptType): boolean {
  return reprompt === CipherRepromptType.None;
}

/**
 * Whether a cipher may answer an HTTP authentication challenge: a login with at least one URI, every URI
 * with an explicit match strategy, and master password reprompt off. This does not check whether HTTP
 * authentication is turned on for the login; see {@link hasOptedInToHTTPAuthentication}.
 */
export function isEligibleForHTTPAuthentication(cipher: CipherView): boolean {
  if (cipher.type !== CipherType.Login || !cipher.login?.hasUris) {
    return false;
  }

  return (
    everyUriHasExplicitMatchStrategy(cipher.login.uris.map((uri) => uri.match)) &&
    isRepromptOff(cipher.reprompt)
  );
}

/**
 * Whether a login has HTTP authentication turned on in its own settings.
 *
 * A login stored with both this setting and master password reprompt on still fails
 * {@link isEligibleForHTTPAuthentication}. The stored value is left as it is; the cipher form corrects
 * it the next time the login is saved.
 */
export function hasOptedInToHTTPAuthentication(cipher: CipherView): boolean {
  return cipher.type === CipherType.Login && cipher.login?.httpAuthenticationEnabled === true;
}
