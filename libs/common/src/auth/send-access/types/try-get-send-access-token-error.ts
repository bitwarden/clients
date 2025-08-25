import { UnexpectedIdentityError, SendAccessTokenApiErrorResponse } from "@bitwarden/sdk-internal";

export type TryGetSendAccessTokenError =
  | { kind: "expired" }
  | { kind: "unexpected_server"; error: UnexpectedIdentityError }
  | { kind: "expected_server"; error: SendAccessTokenApiErrorResponse }
  | { kind: "unknown"; error: string };
