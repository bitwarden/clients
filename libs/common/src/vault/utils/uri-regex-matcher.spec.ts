import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PasswordManagerClient, UriMatcherClient } from "@bitwarden/sdk-internal";

import { SdkService } from "../../platform/abstractions/sdk/sdk.service";

import { NO_REGEX_MATCHES, SdkUriRegexMatcher } from "./uri-regex-matcher";

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  isUriMatcherError: (error: unknown) => (error as Error)?.name === "UriMatcherError",
}));

const uriMatcherError = (variant: string) =>
  Object.assign(new Error("Pattern is not usable"), { name: "UriMatcherError", variant });

describe("SdkUriRegexMatcher", () => {
  let client: jest.Mocked<Pick<UriMatcherClient, "matches" | "matches_batch" | "validate">>;
  let matcher: SdkUriRegexMatcher;

  beforeEach(() => {
    client = { matches: jest.fn(), matches_batch: jest.fn(), validate: jest.fn() };
    matcher = new SdkUriRegexMatcher(client as unknown as UriMatcherClient);
  });

  it("is created from the SDK client", async () => {
    const sdkService = mock<SdkService>();
    sdkService.client$ = of({
      vault: () => ({ uri_matcher: () => client }),
    } as unknown as PasswordManagerClient);

    const created = await SdkUriRegexMatcher.create(sdkService);
    client.matches.mockReturnValue(true);

    expect(created.matches("^a", "abc")).toBe(true);
  });

  describe("prime", () => {
    it("evaluates unique patterns in one call and answers later matches from the results", () => {
      client.matches_batch.mockReturnValue([true, false]);

      matcher.prime(["^a", "^b", "^a"], "abc");

      expect(client.matches_batch).toHaveBeenCalledTimes(1);
      expect(client.matches_batch).toHaveBeenCalledWith(["^a", "^b"], "abc");
      expect(matcher.matches("^a", "abc")).toBe(true);
      expect(matcher.matches("^b", "abc")).toBe(false);
      expect(client.matches).not.toHaveBeenCalled();
    });

    it("does not call the SDK when there are no patterns", () => {
      matcher.prime([], "abc");

      expect(client.matches_batch).not.toHaveBeenCalled();
    });

    it("falls back to single evaluation for other patterns or targets", () => {
      client.matches_batch.mockReturnValue([true]);
      client.matches.mockReturnValue(false);
      matcher.prime(["^a"], "abc");

      expect(matcher.matches("^a", "xyz")).toBe(false);
      expect(matcher.matches("^c", "abc")).toBe(false);
      expect(client.matches).toHaveBeenCalledWith("^a", "xyz");
      expect(client.matches).toHaveBeenCalledWith("^c", "abc");
    });

    it("discards results from a previous target", () => {
      client.matches_batch.mockReturnValueOnce([true]).mockReturnValueOnce([false]);

      matcher.prime(["^a"], "abc");
      matcher.prime(["^a"], "abd");

      expect(matcher.matches("^a", "abd")).toBe(false);
    });
  });

  describe("validate", () => {
    it("returns undefined for a usable pattern", () => {
      expect(matcher.validate("^https://example\\.com/")).toBeUndefined();
    });

    it("returns the reason a pattern can't be saved", () => {
      client.validate.mockImplementation(() => {
        throw uriMatcherError("UnsupportedConstruct");
      });

      expect(matcher.validate("x(?!.*logout)")).toBe("UnsupportedConstruct");
    });

    it("rethrows unexpected errors", () => {
      client.validate.mockImplementation(() => {
        throw new Error("unexpected");
      });

      expect(() => matcher.validate("^a")).toThrow("unexpected");
    });
  });
});

describe("NO_REGEX_MATCHES", () => {
  it("never matches", () => {
    expect(NO_REGEX_MATCHES.matches(".*", "anything")).toBe(false);
  });
});
