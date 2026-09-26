import { firstValueFrom, map } from "rxjs";

import { isUriMatcherError, UriMatcherClient, UriMatcherError } from "@bitwarden/sdk-internal";

import { SdkService } from "../../platform/abstractions/sdk/sdk.service";

/** Why a regular-expression URI pattern can't be saved. */
export type UriRegexValidationError = UriMatcherError["variant"];

/** Evaluates regular-expression URI match rules. */
export interface UriRegexMatcher {
  /** Returns whether `target` matches `pattern`, case-insensitively. Unusable patterns never match. */
  matches(pattern: string, target: string): boolean;
}

/** Used when the SDK is unavailable: regular-expression rules never match. */
export const NO_REGEX_MATCHES: UriRegexMatcher = { matches: () => false };

/**
 * Evaluates regular-expression URI match rules in the SDK, which caps pattern and target length,
 * rejects patterns whose matching cost can't be bounded, and bounds match time.
 */
export class SdkUriRegexMatcher implements UriRegexMatcher {
  private primedTarget: string | undefined;
  private primedResults = new Map<string, boolean>();

  constructor(private readonly client: UriMatcherClient) {}

  static async create(sdkService: SdkService): Promise<SdkUriRegexMatcher> {
    return await firstValueFrom(
      sdkService.client$.pipe(map((sdk) => new SdkUriRegexMatcher(sdk.vault().uri_matcher()))),
    );
  }

  /** Evaluates `patterns` against `target` in one SDK call, so later `matches` calls are lookups. */
  prime(patterns: Iterable<string>, target: string): void {
    const unique = [...new Set(patterns)];
    this.primedTarget = target;
    this.primedResults = new Map();
    if (unique.length === 0) {
      return;
    }

    const results = this.client.matches_batch(unique, target);
    unique.forEach((pattern, i) => this.primedResults.set(pattern, results[i] === true));
  }

  matches(pattern: string, target: string): boolean {
    if (target === this.primedTarget) {
      const primed = this.primedResults.get(pattern);
      if (primed !== undefined) {
        return primed;
      }
    }

    return this.client.matches(pattern, target);
  }

  /** Returns why `pattern` can't be saved, or `undefined` if it can. */
  validate(pattern: string): UriRegexValidationError | undefined {
    try {
      this.client.validate(pattern);
      return undefined;
    } catch (e) {
      if (isUriMatcherError(e)) {
        return e.variant;
      }
      throw e;
    }
  }
}
