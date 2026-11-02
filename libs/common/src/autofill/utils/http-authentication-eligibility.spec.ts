import { UriMatchStrategy, UriMatchStrategySetting } from "../../models/domain/domain-service";
import { CipherRepromptType, CipherType } from "../../vault/enums";
import { CipherView } from "../../vault/models/view/cipher.view";
import { LoginUriView } from "../../vault/models/view/login-uri.view";
import { LoginView } from "../../vault/models/view/login.view";

import {
  everyUriHasExplicitMatchStrategy,
  isEligibleForHTTPAuthentication,
  isRepromptOff,
} from "./http-authentication-eligibility";

describe("everyUriHasExplicitMatchStrategy", () => {
  it("returns true when every URI has an explicit match strategy", () => {
    expect(
      everyUriHasExplicitMatchStrategy([
        UriMatchStrategy.Domain,
        UriMatchStrategy.Host,
        UriMatchStrategy.StartsWith,
        UriMatchStrategy.Exact,
        UriMatchStrategy.RegularExpression,
        UriMatchStrategy.Never,
      ]),
    ).toBe(true);
  });

  it.each([null, undefined])("returns false when any URI uses the default (%s)", (match) => {
    expect(everyUriHasExplicitMatchStrategy([UriMatchStrategy.Host, match])).toBe(false);
  });

  it("returns true when there are no URIs", () => {
    expect(everyUriHasExplicitMatchStrategy([])).toBe(true);
  });
});

describe("isRepromptOff", () => {
  it("returns true when reprompt is off", () => {
    expect(isRepromptOff(CipherRepromptType.None)).toBe(true);
  });

  it("returns false when master password reprompt is on", () => {
    expect(isRepromptOff(CipherRepromptType.Password)).toBe(false);
  });
});

describe("isEligibleForHTTPAuthentication", () => {
  const createLoginUri = (match: UriMatchStrategySetting) => {
    const loginUri = new LoginUriView();
    loginUri.uri = "https://example.com";
    loginUri.match = match;
    return loginUri;
  };

  const createLoginCipher = (
    matches: UriMatchStrategySetting[] = [UriMatchStrategy.Host],
    reprompt: CipherRepromptType = CipherRepromptType.None,
  ) => {
    const cipher = new CipherView();
    cipher.type = CipherType.Login;
    cipher.reprompt = reprompt;
    cipher.login = new LoginView();
    cipher.login.uris = matches.map(createLoginUri);
    return cipher;
  };

  it("returns true for a login with explicit match strategies and reprompt off", () => {
    expect(
      isEligibleForHTTPAuthentication(
        createLoginCipher([UriMatchStrategy.Host, UriMatchStrategy.Never]),
      ),
    ).toBe(true);
  });

  it("returns false when master password reprompt is on", () => {
    expect(
      isEligibleForHTTPAuthentication(
        createLoginCipher([UriMatchStrategy.Host], CipherRepromptType.Password),
      ),
    ).toBe(false);
  });

  it("returns false when any URI uses the default match strategy", () => {
    expect(isEligibleForHTTPAuthentication(createLoginCipher([UriMatchStrategy.Host, null]))).toBe(
      false,
    );
  });

  it("returns false for a login with no URIs", () => {
    expect(isEligibleForHTTPAuthentication(createLoginCipher([]))).toBe(false);
  });

  it("returns false for a cipher that is not a login", () => {
    const cipher = createLoginCipher();
    cipher.type = CipherType.Card;

    expect(isEligibleForHTTPAuthentication(cipher)).toBe(false);
  });
});
