import { SendAccessTokenApiErrorResponse } from "@bitwarden/sdk-internal";

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

export type OtpGenerationFailed = InvalidGrant & {
  send_access_error_type: "otp_generation_failed";
};
export function otpGenerationFailed(e: SendAccessTokenApiErrorResponse): e is OtpGenerationFailed {
  return e.error === "invalid_grant" && e.send_access_error_type === "otp_generation_failed";
}

export type UnknownInvalidGrant = InvalidGrant & {
  send_access_error_type: "unknown";
};
export function isUnknownInvalidGrant(
  e: SendAccessTokenApiErrorResponse,
): e is UnknownInvalidGrant {
  return e.error === "invalid_grant" && e.send_access_error_type === "unknown";
}
