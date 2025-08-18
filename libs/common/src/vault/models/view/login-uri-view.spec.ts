import { LoginUriView as SdkLoginUriView, UriMatchType } from "@bitwarden/sdk-internal";

import { UriMatchStrategy, UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { Utils } from "../../../platform/misc/utils";

import { LoginUriView } from "./login-uri.view";

const testData = [
  {
    match: UriMatchStrategy.Host,
    uri: "http://example.com/login",
    expected: "http://example.com/login",
  },
  {
    match: UriMatchStrategy.Host,
    uri: "bitwarden.com",
    expected: "http://bitwarden.com",
  },
  {
    match: UriMatchStrategy.Host,
    uri: "bitwarden.de",
    expected: "http://bitwarden.de",
  },
  {
    match: UriMatchStrategy.Host,
    uri: "bitwarden.br",
    expected: "http://bitwarden.br",
  },
];

const exampleUris = {
  standard: "https://www.exampleapp.com.au:4000/userauth/login.html",
  standardRegex: "https://www.exampleapp.com.au:[0-9]*/[A-Za-z]+/login.html",
  standardNotMatching: "https://www.exampleapp.com.au:4000/userauth123/login.html",
  subdomain: "https://www.auth.exampleapp.com.au",
  differentDomain: "https://www.exampleapp.co.uk/subpage",
  differentHost: "https://www.exampleapp.com.au/userauth/login.html",
  equivalentDomains: () =>
    new Set(["exampleapp.com.au", "exampleapp.com", "exampleapp.co.uk", "example.com"]),
  noEquivalentDomains: () => new Set<string>(),
};

describe("LoginUriView", () => {
  it("isWebsite() given an invalid domain should return false", async () => {
    const uri = new LoginUriView();
    Object.assign(uri, { match: UriMatchStrategy.Host, uri: "bit!:_&ward.com" });
    expect(uri.isWebsite).toBe(false);
  });

  testData.forEach((data) => {
    it(`isWebsite() given ${data.uri} should return true`, async () => {
      const uri = new LoginUriView();
      Object.assign(uri, { match: data.match, uri: data.uri });
      expect(uri.isWebsite).toBe(true);
    });

    it(`launchUri() given ${data.uri} should return ${data.expected}`, async () => {
      const uri = new LoginUriView();
      Object.assign(uri, { match: data.match, uri: data.uri });
      expect(uri.launchUri).toBe(data.expected);
    });

    it(`canLaunch() given ${data.uri} should return true`, async () => {
      const uri = new LoginUriView();
      Object.assign(uri, { match: data.match, uri: data.uri });
      expect(uri.canLaunch).toBe(true);
    });
  });

  it(`canLaunch should return false when MatchDetection is set to Regex`, async () => {
    const uri = new LoginUriView();
    Object.assign(uri, { match: UriMatchStrategy.RegularExpression, uri: "bitwarden.com" });
    expect(uri.canLaunch).toBe(false);
  });

  it(`canLaunch() should return false when the given protocol does not match CanLaunchWhiteList`, async () => {
    const uri = new LoginUriView();
    Object.assign(uri, { match: UriMatchStrategy.Host, uri: "someprotocol://bitwarden.com" });
    expect(uri.canLaunch).toBe(false);
  });

  describe("uri matching", () => {
    describe("using domain matching", () => {
      it("matches the same domain", () => {
        const uri = uriFactory(UriMatchStrategy.Domain, exampleUris.standard);
        const actual = uri.matchesUri(exampleUris.subdomain, exampleUris.noEquivalentDomains());
        expect(actual).toBe(true);
      });

      it("matches equivalent domains", () => {
        const uri = uriFactory(UriMatchStrategy.Domain, exampleUris.standard);
        const actual = uri.matchesUri(exampleUris.differentDomain, exampleUris.equivalentDomains());
        expect(actual).toBe(true);
      });

      it("does not match a different domain", () => {
        const uri = uriFactory(UriMatchStrategy.Domain, exampleUris.standard);
        const actual = uri.matchesUri(
          exampleUris.differentDomain,
          exampleUris.noEquivalentDomains(),
        );
        expect(actual).toBe(false);
      });

      // Actual integration test with the real blacklist, not ideal
      it("does not match domains that are blacklisted", () => {
        const googleEquivalentDomains = new Set(["google.com", "script.google.com"]);
        const uri = uriFactory(UriMatchStrategy.Domain, "google.com");

        const actual = uri.matchesUri("script.google.com", googleEquivalentDomains);

        expect(actual).toBe(false);
      });
    });

    describe("using host matching", () => {
      it("matches the same host", () => {
        const uri = uriFactory(UriMatchStrategy.Host, Utils.getHost(exampleUris.standard));
        const actual = uri.matchesUri(exampleUris.standard, exampleUris.noEquivalentDomains());
        expect(actual).toBe(true);
      });

      it("does not match a different host", () => {
        const uri = uriFactory(UriMatchStrategy.Host, Utils.getHost(exampleUris.differentDomain));
        const actual = uri.matchesUri(exampleUris.standard, exampleUris.noEquivalentDomains());
        expect(actual).toBe(false);
      });
    });

    describe("using exact matching", () => {
      it("matches if both uris are the same", () => {
        const uri = uriFactory(UriMatchStrategy.Exact, exampleUris.standard);
        const actual = uri.matchesUri(exampleUris.standard, exampleUris.noEquivalentDomains());
        expect(actual).toBe(true);
      });

      it("does not match if the uris are different", () => {
        const uri = uriFactory(UriMatchStrategy.Exact, exampleUris.standard);
        const actual = uri.matchesUri(
          exampleUris.standard + "#",
          exampleUris.noEquivalentDomains(),
        );
        expect(actual).toBe(false);
      });
    });

    describe("using startsWith matching", () => {
      it("matches if the target URI starts with the saved URI", () => {
        const uri = uriFactory(UriMatchStrategy.StartsWith, exampleUris.standard);
        const actual = uri.matchesUri(
          exampleUris.standard + "#bookmark",
          exampleUris.noEquivalentDomains(),
        );
        expect(actual).toBe(true);
      });

      it("does not match if the start of the uri is not the same", () => {
        const uri = uriFactory(UriMatchStrategy.StartsWith, exampleUris.standard);
        const actual = uri.matchesUri(
          exampleUris.standard.slice(1),
          exampleUris.noEquivalentDomains(),
        );
        expect(actual).toBe(false);
      });
    });

    describe("using regular expression matching", () => {
      it("matches if the regular expression matches", () => {
        const uri = uriFactory(UriMatchStrategy.RegularExpression, exampleUris.standard);
        const actual = uri.matchesUri(exampleUris.standardRegex, exampleUris.noEquivalentDomains());
        expect(actual).toBe(false);
      });

      it("does not match if the regular expression does not match", () => {
        const uri = uriFactory(UriMatchStrategy.RegularExpression, exampleUris.standardNotMatching);
        const actual = uri.matchesUri(exampleUris.standardRegex, exampleUris.noEquivalentDomains());
        expect(actual).toBe(false);
      });
    });

    describe("using never matching", () => {
      it("does not match even if uris are identical", () => {
        const uri = uriFactory(UriMatchStrategy.Never, exampleUris.standard);
        const actual = uri.matchesUri(exampleUris.standard, exampleUris.noEquivalentDomains());
        expect(actual).toBe(false);
      });
    });
  });

  describe("fromSdkLoginUriView", () => {
    it("should return undefined when the input is null", () => {
      const result = LoginUriView.fromSdkLoginUriView(null as unknown as SdkLoginUriView);
      expect(result).toBeUndefined();
    });

    it("should create a LoginUriView from a SdkLoginUriView", () => {
      const sdkLoginUriView = {
        uri: "https://example.com",
        match: UriMatchType.Host,
      } as SdkLoginUriView;

      const loginUriView = LoginUriView.fromSdkLoginUriView(sdkLoginUriView);

      expect(loginUriView).toBeInstanceOf(LoginUriView);
      expect(loginUriView!.uri).toBe(sdkLoginUriView.uri);
      expect(loginUriView!.match).toBe(sdkLoginUriView.match);
    });
  });
});

function uriFactory(match: UriMatchStrategySetting, uri: string) {
  const loginUri = new LoginUriView();
  loginUri.match = match;
  loginUri.uri = uri;
  return loginUri;
}
