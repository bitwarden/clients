import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { findCatalogEntry, findExceedsMax, PAM_ERROR_CATALOG } from "./pam-error-catalog";
import { PamInputError } from "./pam-input-error";
import { sanitizeUntrusted } from "./sanitize-untrusted";

/** The SDK's flat error classes, which reach TypeScript as an `Error` with a `variant`. */
const PAM_SDK_ERROR_NAMES: ReadonlySet<string> = new Set([
  "AccessRequestError",
  "ApprovalError",
  "AccessLeaseError",
  "AccessRuleError",
  "RotationError",
]);

export type PamErrorKind =
  | "input"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "unlicensed"
  | "rejected"
  | "unavailable"
  | "unexpected";

/** What a failure means, in text and a variant only. Never carries a payload. */
export interface PamErrorInfo {
  readonly kind: PamErrorKind;
  /** Safe to print. */
  readonly message: string;
  /** A stable slug from the catalog, when the server's sentence was recognised. */
  readonly code?: string;
  /** The SDK error variant, such as `Api` or `Validation`. */
  readonly variant?: string;
  /** The HTTP status of an `Api` variant or an `ErrorResponse`. */
  readonly status?: number;
}

interface SdkLikeError extends Error {
  variant: string;
}

function isPamSdkError(e: unknown): e is SdkLikeError {
  return (
    e instanceof Error &&
    PAM_SDK_ERROR_NAMES.has(e.name) &&
    typeof (e as Partial<SdkLikeError>).variant === "string"
  );
}

/**
 * Unlike the flat errors, a `TargetSystemCreateError` crosses the FFI boundary as a plain object
 * (`bitwarden-error`'s `full` mode), so this checks shape instead of a name.
 */
function isTargetSystemCreateError(e: unknown): e is { id?: string; message: string } {
  return (
    typeof e === "object" &&
    e != null &&
    !(e instanceof Error) &&
    typeof (e as { message?: unknown }).message === "string"
  );
}

/**
 * The server's `message`, decoded from the `ErrorResponseModel` JSON the SDK appends to its
 * transport string, or `undefined` when there is none. The result is untrusted text: match it
 * against the catalog, never print it.
 */
export function apiErrorBodyMessage(message: string): string | undefined {
  const bodyStart = message.indexOf("{");
  const bodyEnd = message.lastIndexOf("}");
  if (bodyStart === -1 || bodyEnd <= bodyStart) {
    return undefined;
  }
  try {
    const body: unknown = JSON.parse(message.slice(bodyStart, bodyEnd + 1));
    const serverMessage = (body as { message?: unknown }).message;
    return typeof serverMessage === "string" && serverMessage.length > 0
      ? serverMessage
      : undefined;
  } catch {
    return undefined;
  }
}

/** The HTTP status in the SDK's `error in response: status code 403 Forbidden: ...` transport text. */
function apiErrorStatus(message: string): number | undefined {
  const match = /status code (\d{3})/.exec(message);
  return match == null ? undefined : Number(match[1]);
}

function statusKind(status: number | undefined): PamErrorKind {
  switch (status) {
    case 403:
      return "forbidden";
    case 404:
      return "notFound";
    case 409:
      return "conflict";
    default:
      return "rejected";
  }
}

function statusMessage(status: number | undefined): string {
  switch (status) {
    case undefined:
      return "The request could not be completed.";
    case 400:
      return "The server rejected the request.";
    case 401:
      return "You are not authorized to do this. Log in again and retry.";
    case 403:
      return "You do not have permission to do this.";
    case 404:
      return "Not found, or you do not have access to it.";
    case 409:
      return "The request conflicts with the current state. Read it again and retry.";
    case 429:
      return "Rate limit exceeded. Try again later.";
    default:
      return status >= 500
        ? `The server could not complete the request (status ${status}).`
        : `The request failed (status ${status}).`;
  }
}

/**
 * Describes a failure from a server response: a catalog sentence when the text is recognised, else
 * the status alone. Unrecognised server text is dropped, since it may carry filesystem paths.
 */
function describeServerRefusal(
  text: string,
  status: number | undefined,
  variant: string | undefined,
): PamErrorInfo {
  const entry = findCatalogEntry(text);
  if (entry != null) {
    const unlicensed = entry.sentence === PAM_ERROR_CATALOG.Unlicensed.sentence;
    return {
      kind: unlicensed ? "unlicensed" : statusKind(status),
      message: entry.sentence,
      code: entry.code,
      variant,
      status,
    };
  }
  const exceedsMax = findExceedsMax(text);
  if (exceedsMax != null) {
    return {
      kind: "rejected",
      message: `The requested ${exceedsMax.scope} exceeds the maximum of ${exceedsMax.maxSeconds} seconds.`,
      code: `exceeds-max-${exceedsMax.scope}`,
      variant,
      status,
    };
  }
  return { kind: statusKind(status), message: statusMessage(status), variant, status };
}

function describeSdkError(e: SdkLikeError): PamErrorInfo {
  const variant = e.variant;
  switch (variant) {
    case "Api": {
      const status = apiErrorStatus(e.message);
      const text = apiErrorBodyMessage(e.message) ?? "";
      return describeServerRefusal(text, status, variant);
    }
    case "Validation": {
      // Worded by the SDK before anything is sent, so safe to show once cleaned.
      const known = describeServerRefusal(e.message, undefined, variant);
      return known.code != null
        ? { ...known, kind: "input" }
        : { kind: "input", message: sanitizeUntrusted(e.message), variant };
    }
    case "NotFound":
    case "TargetSystemNotFound":
      return { kind: "notFound", message: statusMessage(404), variant };
    default:
      return {
        kind: "unexpected",
        message: `The Privileged Controls operation failed (${e.name}: ${variant}).`,
        variant,
      };
  }
}

/**
 * Decodes a failure from the PAM SDK clients, the API service or this code's own input checks into
 * text, a kind and a variant. Never returns a payload, and never echoes unrecognised server text.
 */
export function describePamError(e: unknown): PamErrorInfo {
  if (e instanceof PamInputError) {
    return { kind: "input", message: e.message };
  }
  if (isPamSdkError(e)) {
    return describeSdkError(e);
  }
  if (e instanceof ErrorResponse) {
    const status = e.statusCode;
    return describeServerRefusal(e.message ?? "", status, "ErrorResponse");
  }
  if (isTargetSystemCreateError(e)) {
    // `TargetSystemCreateError.message` never contains sealed field values.
    const known = describeServerRefusal(e.message, undefined, undefined);
    return known.code != null
      ? { ...known, kind: "rejected" }
      : { kind: "rejected", message: sanitizeUntrusted(e.message) };
  }
  return { kind: "unexpected", message: "The operation failed unexpectedly." };
}

/** The printable message of {@link describePamError}. */
export function pamErrorMessage(e: unknown): string {
  return describePamError(e).message;
}

/** The pending target's id from a partial create failure, else `undefined`. */
export function targetSystemCreatePendingId(e: unknown): string | undefined {
  return isTargetSystemCreateError(e) && typeof e.id === "string" ? e.id : undefined;
}
