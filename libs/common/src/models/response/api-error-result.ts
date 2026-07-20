import { ErrorResponse } from "./error.response";

/**
 * A failed API call mapped to a discriminated result variant. `TKind` is the failure discriminant;
 * `cause` carries a human-readable / loggable reason.
 */
export type ApiErrorResult<TKind extends string> = { kind: TKind; cause: string };

/**
 * Describes how to translate a caught API error into a caller's result kinds. Every field is a
 * `kind` from the caller's discriminated union.
 */
export interface ApiErrorKindMap<TKind extends string> {
  /**
   * Maps RFC 7807 validation-problem `type` codes (HTTP 400) to a kind. The first matching problem
   * wins; unmatched 400s fall back to `unexpected`.
   */
  validationErrorTypes?: Record<string, TKind>;
  /** Kind for 401 Unauthorized and 403 Forbidden. */
  unauthorized: TKind;
  /** Kind for 404 Not Found. Omit to fall back to `unexpected`. */
  notFound?: TKind;
  /**
   * Fallback kind for anything unmapped: non-`ErrorResponse` throwables, unrecognized status codes,
   * and 400s with no recognized `type`.
   */
  unexpected: TKind;
}

/**
 * Translates a caught API error into a caller-defined result kind, centralizing the shared shape of
 * Bitwarden API failures: RFC 7807 validation problems (`errors.<property>[].type`) on 400,
 * status-code cases (401 / 403 / 404), and a catch-all fallback.
 *
 * Intended for use inside a `catch` block, so it never produces a success kind.
 */
export function mapApiErrorToResult<TKind extends string>(
  error: unknown,
  map: ApiErrorKindMap<TKind>,
): ApiErrorResult<TKind> {
  if (!(error instanceof ErrorResponse)) {
    return { kind: map.unexpected, cause: String(error) };
  }

  switch (error.statusCode) {
    case 401:
    case 403:
      return { kind: map.unauthorized, cause: error.getSingleMessage() };
    case 404:
      if (map.notFound != null) {
        return { kind: map.notFound, cause: error.getSingleMessage() };
      }
      break;
    case 400: {
      const problems = error.getValidationProblemErrors();
      for (const { type, detail } of problems) {
        const kind = map.validationErrorTypes?.[type];
        if (kind != null) {
          return { kind, cause: detail };
        }
      }
      // The RFC 7807 `errors` extension isn't surfaced by `getSingleMessage()`, so fall back to the
      // first problem's detail before the generic message.
      return { kind: map.unexpected, cause: problems[0]?.detail ?? error.getSingleMessage() };
    }
  }

  return { kind: map.unexpected, cause: error.getSingleMessage() };
}
