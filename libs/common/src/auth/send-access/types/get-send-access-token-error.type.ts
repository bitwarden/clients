import { UnexpectedIdentityError, SendAccessTokenApiErrorResponse } from "@bitwarden/sdk-internal";

/**
 * Represents the possible errors that can occur when retrieving a SendAccessToken.
 * Note: for expected_server errors, see invalid-request-errors.type.ts and
 * invalid-grant-errors.type.ts for type guards that identify specific
 * SendAccessTokenApiErrorResponse errors
 */
export type GetSendAccessTokenError =
  | { kind: "unexpected_server"; error: UnexpectedIdentityError }
  | { kind: "expected_server"; error: SendAccessTokenApiErrorResponse }
  | { kind: "unknown"; error: string };
