import { mock } from "jest-mock-extended";
import { NEVER, of } from "rxjs";

import {
  PasswordManagerClient,
  uri_regex_matches,
  uri_regex_matches_batch,
  validate_uri_regex,
} from "@bitwarden/sdk-internal";

import { SdkService } from "../../platform/abstractions/sdk/sdk.service";

import { NO_REGEX_MATCHES, SdkUriRegexMatcher } from "./uri-regex-matcher";

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  isUriMatcherError: (error: unknown) => (error as Error)?.name === "UriMatcherError",
  uri_regex_matches: jest.fn(),
  uri_regex_matches_batch: jest.fn(),
  validate_uri_regex: jest.fn(),
}));

const uriMatcherError = (variant: string) =>
  Object.assign(new Error("Pattern is not usable"), { name: "UriMatcherError", variant });

describe("SdkUriRegexMatcher", () => {
  const matches = uri_regex_matches as jest.MockedFunction<typeof uri_regex_matches>;
  const matchesBatch = uri_regex_matches_batch as jest.MockedFunction<
    typeof uri_regex_matches_batch
  >;
  const validate = validate_uri_regex as jest.MockedFunction<typeof validate_uri_regex>;
  let matcher: SdkUriRegexMatcher;

  beforeEach(() => {
    jest.resetAllMocks();
    matcher = new SdkUriRegexMatcher();
  });

  describe("create", () => {
    it("resolves once the SDK has loaded", async () => {
      const sdkService = mock<SdkService>();
      sdkService.client$ = of({} as PasswordManagerClient);
      matches.mockReturnValue(true);

      const created = await SdkUriRegexMatcher.create(sdkService);

      expect(created.matches("^a", "abc")).toBe(true);
    });

    it("waits while the SDK is loading", async () => {
      const sdkService = mock<SdkService>();
      sdkService.client$ = NEVER;
      const onCreated = jest.fn();

      void SdkUriRegexMatcher.create(sdkService).then(onCreated);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onCreated).not.toHaveBeenCalled();
    });
  });

  describe("prime", () => {
    it("evaluates unique patterns in one call and answers later matches from the results", async () => {
      matchesBatch.mockReturnValue(["Match", "NoMatch"]);

      await matcher.prime(["^a", "^b", "^a"], "abc");

      expect(matchesBatch).toHaveBeenCalledTimes(1);
      expect(matchesBatch).toHaveBeenCalledWith(["^a", "^b"], "abc");
      expect(matcher.matches("^a", "abc")).toBe(true);
      expect(matcher.matches("^b", "abc")).toBe(false);
      expect(matches).not.toHaveBeenCalled();
    });

    it("does not call the SDK when there are no patterns", async () => {
      await matcher.prime([], "abc");

      expect(matchesBatch).not.toHaveBeenCalled();
    });

    it("retries patterns the SDK skipped until all are evaluated", async () => {
      matchesBatch
        .mockReturnValueOnce(["NoMatch", "Skipped", "Skipped"])
        .mockReturnValueOnce(["Match", "Skipped"])
        .mockReturnValueOnce(["NoMatch"]);

      await matcher.prime(["^a", "^b", "^c"], "abc");

      expect(matchesBatch.mock.calls).toEqual([
        [["^a", "^b", "^c"], "abc"],
        [["^b", "^c"], "abc"],
        [["^c"], "abc"],
      ]);
      expect(matcher.matches("^a", "abc")).toBe(false);
      expect(matcher.matches("^b", "abc")).toBe(true);
      expect(matcher.matches("^c", "abc")).toBe(false);
      expect(matches).not.toHaveBeenCalled();
    });

    it("matches no pattern against an oversized target", async () => {
      matchesBatch.mockImplementation(() => {
        throw uriMatcherError("TargetTooLong");
      });

      await matcher.prime(["^a", "^b"], "abc");

      expect(matcher.matches("^a", "abc")).toBe(false);
      expect(matcher.matches("^b", "abc")).toBe(false);
      expect(matches).not.toHaveBeenCalled();
    });

    it("rethrows unexpected errors", async () => {
      matchesBatch.mockImplementation(() => {
        throw new Error("unexpected");
      });

      await expect(matcher.prime(["^a"], "abc")).rejects.toThrow("unexpected");
    });

    it("falls back to single evaluation for other patterns or targets", async () => {
      matchesBatch.mockReturnValue(["Match"]);
      matches.mockReturnValue(false);
      await matcher.prime(["^a"], "abc");

      expect(matcher.matches("^a", "xyz")).toBe(false);
      expect(matcher.matches("^c", "abc")).toBe(false);
      expect(matches).toHaveBeenCalledWith("^a", "xyz");
      expect(matches).toHaveBeenCalledWith("^c", "abc");
    });

    it("discards results from a previous target", async () => {
      matchesBatch.mockReturnValueOnce(["Match"]).mockReturnValueOnce(["NoMatch"]);

      await matcher.prime(["^a"], "abc");
      await matcher.prime(["^a"], "abd");

      expect(matcher.matches("^a", "abd")).toBe(false);
    });
  });

  describe("validate", () => {
    it("returns undefined for a usable pattern", () => {
      expect(matcher.validate("^https://example\\.com/")).toBeUndefined();
    });

    it("returns the reason a pattern can't be saved", () => {
      validate.mockImplementation(() => {
        throw uriMatcherError("UnsupportedLookaround");
      });

      expect(matcher.validate("x(?!.*logout)")).toBe("UnsupportedLookaround");
    });

    it("rethrows unexpected errors", () => {
      validate.mockImplementation(() => {
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
