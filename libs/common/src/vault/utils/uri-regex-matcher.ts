import { firstValueFrom } from "rxjs";

import {
  isUriMatcherError,
  uri_regex_matches,
  uri_regex_matches_batch,
  UriMatcherError,
  validate_uri_regex,
} from "@bitwarden/sdk-internal";

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
 *
 * Only construct this once the SDK has loaded, i.e. after `SdkService.client$` emits.
 */
export class SdkUriRegexMatcher implements UriRegexMatcher {
  private primedTarget: string | undefined;
  private primedResults = new Map<string, boolean>();

  /** Waits for the SDK to load, since its functions can't be called before then. */
  static async create(sdkService: SdkService): Promise<SdkUriRegexMatcher> {
    await firstValueFrom(sdkService.client$);
    return new SdkUriRegexMatcher();
  }

  /**
   * Evaluates `patterns` against `target` in batches, so later `matches` calls are lookups. Each
   * batch is time-bounded by the SDK; patterns it skips are retried after yielding to the event loop.
   */
  async prime(patterns: Iterable<string>, target: string): Promise<void> {
    this.primedTarget = target;
    this.primedResults = new Map();

    let pending = [...new Set(patterns)];
    while (pending.length > 0) {
      let results;
      try {
        results = uri_regex_matches_batch(pending, target);
      } catch (e) {
        // An oversized target matches no pattern, as in `matches`.
        if (isUriMatcherError(e) && e.variant === "TargetTooLong") {
          pending.forEach((pattern) => this.primedResults.set(pattern, false));
          return;
        }
        throw e;
      }

      const skipped: string[] = [];
      pending.forEach((pattern, i) => {
        if (results[i] === "Skipped") {
          skipped.push(pattern);
        } else {
          this.primedResults.set(pattern, results[i] === "Match");
        }
      });
      pending = skipped;

      if (pending.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  matches(pattern: string, target: string): boolean {
    if (target === this.primedTarget) {
      const primed = this.primedResults.get(pattern);
      if (primed !== undefined) {
        return primed;
      }
    }

    return uri_regex_matches(pattern, target);
  }

  /** Returns why `pattern` can't be saved, or `undefined` if it can. */
  validate(pattern: string): UriRegexValidationError | undefined {
    try {
      validate_uri_regex(pattern);
      return undefined;
    } catch (e) {
      if (isUriMatcherError(e)) {
        return e.variant;
      }
      throw e;
    }
  }
}
