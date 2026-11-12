import type {
  CipherId,
  RotationConfigCreateRequest,
  RotationConfigView,
  TargetSystemId,
} from "@bitwarden/sdk-internal";

import { toSdkId } from "../shared/pam-ids";
import { PamInputError } from "../shared/pam-input-error";

/** The longest request body accepted, which is far above any real one. */
const MAX_REQUEST_LENGTH = 64 * 1024;
const MAX_ACCOUNT_IDENTITY_LENGTH = 500;

const REQUEST_KEYS: ReadonlySet<string> = new Set([
  "cipherId",
  "targetSystemId",
  "accountIdentity",
  "terminateSessions",
  "scheduleCron",
  "rotateOnAccessEnd",
]);

/**
 * Parses the request JSON of `create` and `update`. `existing` seeds an update, so a field the
 * JSON leaves out keeps its current value, and a create has none.
 *
 * Every refusal names a field and never repeats a value, because `accountIdentity` is sensitive
 * and a JSON syntax error can quote the text.
 * @throws PamInputError for malformed JSON, an unknown field or a field of the wrong type.
 */
export function parseRotationRequest(
  json: string,
  existing?: RotationConfigView,
): RotationConfigCreateRequest {
  if (json.length > MAX_REQUEST_LENGTH) {
    throw new PamInputError(`The request is longer than ${MAX_REQUEST_LENGTH} characters.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new PamInputError("The request is not valid JSON.");
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PamInputError("The request must be a JSON object.");
  }
  const body = parsed as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!REQUEST_KEYS.has(key)) {
      throw new PamInputError(
        `The request has an unknown field. Allowed fields: ${[...REQUEST_KEYS].join(", ")}.`,
      );
    }
  }

  const cipherId = pickId<CipherId>(body.cipherId, existing?.cipherId, "cipherId");
  const targetSystemId = pickId<TargetSystemId>(
    body.targetSystemId,
    existing?.targetSystemId,
    "targetSystemId",
  );
  const accountIdentity = pickAccountIdentity(body.accountIdentity, existing);
  const terminateSessions = pickTerminateSessions(body.terminateSessions, existing);
  const rotateOnAccessEnd = pickBoolean(
    body.rotateOnAccessEnd,
    existing?.rotateOnAccessEnd ?? false,
    "rotateOnAccessEnd",
  );

  let scheduleCron: string | undefined = existing?.scheduleCron;
  if ("scheduleCron" in body) {
    if (body.scheduleCron === null || body.scheduleCron === undefined) {
      scheduleCron = undefined;
    } else if (typeof body.scheduleCron === "string" && body.scheduleCron.trim().length > 0) {
      scheduleCron = body.scheduleCron.trim();
    } else {
      throw new PamInputError("`scheduleCron` must be a cron string or null.");
    }
  }

  return {
    cipherId,
    targetSystemId,
    accountIdentity,
    terminateSessions,
    scheduleCron,
    rotateOnAccessEnd,
  };
}

function pickId<T extends CipherId | TargetSystemId>(
  value: unknown,
  fallback: T | undefined,
  label: string,
): T {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }
  if (typeof value !== "string") {
    throw new PamInputError(`\`${label}\` is required and must be a GUID string.`);
  }
  return toSdkId<T>(value, label);
}

function pickAccountIdentity(value: unknown, existing: RotationConfigView | undefined): string {
  const candidate = value === undefined ? existing?.sealed?.accountIdentity : value;
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    throw new PamInputError(
      existing != null && value === undefined
        ? "`accountIdentity` is required: the existing one could not be read."
        : "`accountIdentity` is required and must be a non-empty string.",
    );
  }
  if (candidate.length > MAX_ACCOUNT_IDENTITY_LENGTH) {
    throw new PamInputError(
      `\`accountIdentity\` is longer than ${MAX_ACCOUNT_IDENTITY_LENGTH} characters.`,
    );
  }
  return candidate;
}

function pickTerminateSessions(value: unknown, existing: RotationConfigView | undefined): boolean {
  if (
    value === undefined &&
    existing != null &&
    typeof existing.sealed?.terminateSessions !== "boolean"
  ) {
    // Defaulting to false here would silently turn session termination off.
    throw new PamInputError("`terminateSessions` is required: the existing one could not be read.");
  }
  return pickBoolean(value, existing?.sealed?.terminateSessions ?? false, "terminateSessions");
}

function pickBoolean(value: unknown, fallback: boolean, label: string): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new PamInputError(`\`${label}\` must be true or false.`);
  }
  return value;
}
