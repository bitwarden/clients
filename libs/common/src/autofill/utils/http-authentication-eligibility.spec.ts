import { UriMatchStrategy, UriMatchStrategySetting } from "../../models/domain/domain-service";
import { CipherRepromptType, CipherType } from "../../vault/enums";
import { CipherView } from "../../vault/models/view/cipher.view";
import { LoginUriView } from "../../vault/models/view/login-uri.view";
import { LoginView } from "../../vault/models/view/login.view";

import {
  hasOptedInToHTTPAuthentication,
  isEligibleForHTTPAuthentication,
} from "./http-authentication-eligibility";

const createLoginCipher = (matches: UriMatchStrategySetting[] = [UriMatchStrategy.Host]) => {
  const cipher = new CipherView();
  cipher.type = CipherType.Login;
  cipher.login = new LoginView();
  cipher.login.uris = matches.map((match) => {
    const loginUri = new LoginUriView();
    loginUri.uri = "https://example.com";
    loginUri.match = match;
    return loginUri;
  });
  return cipher;
};

describe("isEligibleForHTTPAuthentication", () => {
  it.each([
    ["an explicit match strategy", [UriMatchStrategy.Host]],
    ["the default match strategy", [null]],
    ["a mix of match strategies", [UriMatchStrategy.Domain, null, UriMatchStrategy.Never]],
  ])("returns true for a login with %s", (_, matches) => {
    expect(isEligibleForHTTPAuthentication(createLoginCipher(matches))).toBe(true);
  });

  it("returns true when master password reprompt is on", () => {
    const cipher = createLoginCipher();
    cipher.reprompt = CipherRepromptType.Password;

    expect(isEligibleForHTTPAuthentication(cipher)).toBe(true);
  });

  it("returns true for an organization login", () => {
    const cipher = createLoginCipher();
    cipher.organizationId = "organization-id";

    expect(isEligibleForHTTPAuthentication(cipher)).toBe(true);
  });

  it.each([true, false, undefined])(
    "does not depend on the login's own HTTP authentication setting (%s)",
    (httpAuthenticationEnabled) => {
      const cipher = createLoginCipher();
      cipher.login.httpAuthenticationEnabled = httpAuthenticationEnabled;

      expect(isEligibleForHTTPAuthentication(cipher)).toBe(true);
    },
  );

  it("returns false for a login with no URIs", () => {
    expect(isEligibleForHTTPAuthentication(createLoginCipher([]))).toBe(false);
  });

  it("returns false for a cipher that is not a login", () => {
    const cipher = createLoginCipher();
    cipher.type = CipherType.Card;

    expect(isEligibleForHTTPAuthentication(cipher)).toBe(false);
  });
});

describe("hasOptedInToHTTPAuthentication", () => {
  const createCipherWithSetting = (httpAuthenticationEnabled: boolean | undefined) => {
    const cipher = createLoginCipher();
    cipher.login.httpAuthenticationEnabled = httpAuthenticationEnabled;
    return cipher;
  };

  it("returns true when the login has HTTP authentication on", () => {
    expect(hasOptedInToHTTPAuthentication(createCipherWithSetting(true))).toBe(true);
  });

  it.each([false, undefined])(
    "returns false when the login has HTTP authentication off (%s)",
    (httpAuthenticationEnabled) => {
      expect(
        hasOptedInToHTTPAuthentication(createCipherWithSetting(httpAuthenticationEnabled)),
      ).toBe(false);
    },
  );

  it("returns false for a cipher that is not a login", () => {
    const cipher = createCipherWithSetting(true);
    cipher.type = CipherType.Card;

    expect(hasOptedInToHTTPAuthentication(cipher)).toBe(false);
  });
});
