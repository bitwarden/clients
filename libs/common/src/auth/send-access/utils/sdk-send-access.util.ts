import { SendAccessCredentials, SendAccessTokenError } from "@bitwarden/sdk-internal";

import { GetSendAccessTokenError } from "../types/get-send-access-token-error.type";
import { SendAccessDomainCredentials } from "../types/send-access-domain-credentials.type";

/**
 * Maps domain send access credentials to the SDK's request shape.
 * @param credentials The domain credentials, or undefined when the Send needs none.
 * @returns The SDK credentials, or undefined when no credentials were given.
 */
export function toSdkSendAccessCredentials(
  credentials: SendAccessDomainCredentials,
): SendAccessCredentials;
export function toSdkSendAccessCredentials(
  credentials: SendAccessDomainCredentials | undefined,
): SendAccessCredentials | undefined;
export function toSdkSendAccessCredentials(
  credentials: SendAccessDomainCredentials | undefined,
): SendAccessCredentials | undefined {
  switch (credentials?.kind) {
    case "password":
      return { passwordHashB64: credentials.passwordHashB64 };
    case "email":
      return { email: credentials.email };
    case "email_otp":
      return { email: credentials.email, otp: credentials.otp };
    default:
      return undefined;
  }
}

/**
 * Normalizes an error from an SDK send access token request into a {@link GetSendAccessTokenError},
 * so callers' error predicates behave the same regardless of which SDK client minted the token.
 * @param e The error thrown by the SDK.
 * @returns A normalized GetSendAccessTokenError.
 */
export function normalizeSendAccessTokenError(e: unknown): GetSendAccessTokenError {
  if (isSendAccessTokenError(e)) {
    if (e.kind === "unexpected") {
      return { kind: "unexpected_server", error: e.data };
    }
    return { kind: "expected_server", error: e.data };
  }

  if (e instanceof Error) {
    return { kind: "unknown", error: e.message };
  }

  try {
    return { kind: "unknown", error: JSON.stringify(e) };
  } catch {
    return { kind: "unknown", error: "error cannot be stringified" };
  }
}

/**
 * Type guard for the SDK's {@link SendAccessTokenError}. It is a plain tagged union, so the SDK
 * generates no guard for it.
 */
export function isSendAccessTokenError(e: unknown): e is SendAccessTokenError {
  return (
    typeof e === "object" &&
    e !== null &&
    "kind" in e &&
    (e.kind === "expected" || e.kind === "unexpected")
  );
}
