import { UnexpectedIdentityError, SendAccessTokenApiErrorResponse } from "@bitwarden/sdk-internal";

export type TryGetSendAccessTokenError =
  | { kind: "expired" }
  | { kind: "unexpected"; error: UnexpectedIdentityError }
  | { kind: "expected"; error: SendAccessTokenApiErrorResponse };

// --------------------------------------------------------------------------
// Invalid request helpers
export type InvalidRequest = Extract<SendAccessTokenApiErrorResponse, { error: "invalid_request" }>;

export function isInvalidRequest(e: SendAccessTokenApiErrorResponse): e is InvalidRequest {
  return e.error === "invalid_request";
}

export type BareInvalidRequest = Extract<
  SendAccessTokenApiErrorResponse,
  { error: "invalid_request" }
> & { send_access_error_type?: undefined };

export function isBareInvalidRequest(e: SendAccessTokenApiErrorResponse): e is BareInvalidRequest {
  return e.error === "invalid_request" && e.send_access_error_type === undefined;
}

export type SendIdRequired = InvalidRequest & {
  send_access_error_type: "send_id_required";
};

export function sendIdRequired(e: SendAccessTokenApiErrorResponse): e is SendIdRequired {
  return e.error === "invalid_request" && e.send_access_error_type === "send_id_required";
}

export type PasswordHashB64Required = InvalidRequest & {
  send_access_error_type: "password_hash_b64_required";
};

export function passwordHashB64Required(
  e: SendAccessTokenApiErrorResponse,
): e is PasswordHashB64Required {
  return e.error === "invalid_request" && e.send_access_error_type === "password_hash_b64_required";
}

export type EmailRequired = InvalidRequest & { send_access_error_type: "email_required" };

export function emailRequired(e: SendAccessTokenApiErrorResponse): e is EmailRequired {
  return e.error === "invalid_request" && e.send_access_error_type === "email_required";
}

export type EmailAndOtpRequiredEmailSent = InvalidRequest & {
  send_access_error_type: "email_and_otp_required_otp_sent";
};

export function emailAndOtpRequiredEmailSent(
  e: SendAccessTokenApiErrorResponse,
): e is EmailAndOtpRequiredEmailSent {
  return (
    e.error === "invalid_request" && e.send_access_error_type === "email_and_otp_required_otp_sent"
  );
}

export type UnknownInvalidRequest = InvalidRequest & {
  send_access_error_type: "unknown";
};

export function isUnknownInvalidRequest(
  e: SendAccessTokenApiErrorResponse,
): e is UnknownInvalidRequest {
  return e.error === "invalid_request" && e.send_access_error_type === "unknown";
}

// --------------------------------------------------------------------------
// Invalid grant type helpers
export type InvalidGrant = Extract<SendAccessTokenApiErrorResponse, { error: "invalid_grant" }>;

export function isInvalidGrant(e: SendAccessTokenApiErrorResponse): e is InvalidGrant {
  return e.error === "invalid_grant";
}

export type BareInvalidGrant = Extract<
  SendAccessTokenApiErrorResponse,
  { error: "invalid_grant" }
> & { send_access_error_type?: undefined };

export function isBareInvalidGrant(e: SendAccessTokenApiErrorResponse): e is BareInvalidGrant {
  return e.error === "invalid_grant" && e.send_access_error_type === undefined;
}

export type SendIdInvalid = InvalidGrant & {
  send_access_error_type: "send_id_invalid";
};
export function sendIdInvalid(e: SendAccessTokenApiErrorResponse): e is SendIdInvalid {
  return e.error === "invalid_grant" && e.send_access_error_type === "send_id_invalid";
}

export type PasswordHashB64Invalid = InvalidGrant & {
  send_access_error_type: "password_hash_b64_invalid";
};
export function passwordHashB64Invalid(
  e: SendAccessTokenApiErrorResponse,
): e is PasswordHashB64Invalid {
  return e.error === "invalid_grant" && e.send_access_error_type === "password_hash_b64_invalid";
}

export type EmailInvalid = InvalidGrant & {
  send_access_error_type: "email_invalid";
};
export function emailInvalid(e: SendAccessTokenApiErrorResponse): e is EmailInvalid {
  return e.error === "invalid_grant" && e.send_access_error_type === "email_invalid";
}

export type OtpInvalid = InvalidGrant & {
  send_access_error_type: "otp_invalid";
};
export function otpInvalid(e: SendAccessTokenApiErrorResponse): e is OtpInvalid {
  return e.error === "invalid_grant" && e.send_access_error_type === "otp_invalid";
}

export type UnknownInvalidGrant = InvalidGrant & {
  send_access_error_type: "unknown";
};
export function isUnknownInvalidGrant(
  e: SendAccessTokenApiErrorResponse,
): e is UnknownInvalidGrant {
  return e.error === "invalid_grant" && e.send_access_error_type === "unknown";
}
