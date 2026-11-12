import type { PasswordPolicy, TargetSystemCreateRequest } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";
import { sanitizeUntrusted } from "../shared/sanitize-untrusted";

/** The kinds the pinned SDK publishes. The Active Directory kind is not published yet. */
export const TARGET_SYSTEM_KINDS = ["entra", "custom_script"] as const;
export const TARGET_SYSTEM_METHODS = ["automatic", "manual"] as const;
export type TargetSystemMethodInput = (typeof TARGET_SYSTEM_METHODS)[number];

/** The server's bounds for a name, from `RotationValidationError`. */
const MAX_NAME_LENGTH = 200;
/** Longest request JSON accepted, from a file, stdin or an argument. */
export const MAX_TARGET_SYSTEM_JSON_LENGTH = 64 * 1024;

const POLICY_KEYS = [
  "minLength",
  "maxLength",
  "includeUppercase",
  "includeLowercase",
  "includeDigits",
  "includeSymbols",
] as const;
const MANUAL_KEYS = ["method", "name", "passwordPolicy"];
const AUTOMATIC_KEYS = [...MANUAL_KEYS, "kind", "supportsSessionTermination"];

/** The request template printed by `bw pam target template`. */
export function targetSystemTemplate(method: TargetSystemMethodInput): TargetSystemCreateRequest {
  const passwordPolicy: PasswordPolicy = {
    minLength: 20,
    maxLength: 32,
    includeUppercase: true,
    includeLowercase: true,
    includeDigits: true,
    includeSymbols: true,
  };
  return method === "automatic"
    ? {
        method: "automatic",
        name: "My target system",
        kind: "entra",
        passwordPolicy,
        supportsSessionTermination: false,
      }
    : { method: "manual", name: "My target system", passwordPolicy };
}

/**
 * Parses the JSON text of a create or update request.
 * @throws PamInputError, whose text never echoes a value the operator typed other than key names.
 */
export function parseTargetSystemJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new PamInputError("The target system request is empty.");
  }
  if (trimmed.length > MAX_TARGET_SYSTEM_JSON_LENGTH) {
    throw new PamInputError(
      `The target system request is longer than ${MAX_TARGET_SYSTEM_JSON_LENGTH} characters.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new PamInputError(
      "The target system request is not valid JSON. Run `bw pam target template` for the shape.",
    );
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PamInputError("The target system request must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

/**
 * Validates a request object as the SDK's union. The `object` key is ignored. Other unknown keys are refused, so a typo such as
 * `supportsSessionTerminaton` cannot silently drop a sealed field.
 *
 * @param fallback Values to use for `name` and `method` when the object omits them. This is how
 *   `update` reuses the existing row's non-sealed values.
 * @throws PamInputError
 */
export function validateTargetSystemRequest(
  rawInput: Record<string, unknown>,
  fallback: { name?: string; method?: TargetSystemMethodInput } = {},
): TargetSystemCreateRequest {
  // `object` is the discriminator every `bw` response carries, so a printed template is valid input.
  const input = { ...rawInput };
  delete input.object;
  const method = input.method ?? fallback.method;
  if (method == null) {
    throw new PamInputError('The request needs a "method": "automatic" or "manual".');
  }
  if (method !== "automatic" && method !== "manual") {
    throw new PamInputError('"method" must be "automatic" or "manual".');
  }
  const name = validateName(input.name ?? fallback.name);
  const allowed = method === "automatic" ? AUTOMATIC_KEYS : MANUAL_KEYS;
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new PamInputError(
      `A ${method} target system does not take ${unknown
        .map((key) => `"${sanitizeUntrusted(key, 40)}"`)
        .join(", ")}.`,
    );
  }
  const passwordPolicy = validatePasswordPolicy(input.passwordPolicy);

  if (method === "manual") {
    return { method, name, passwordPolicy };
  }
  const kind = input.kind;
  if (kind == null) {
    throw new PamInputError(
      `An automatic target system needs a "kind": ${TARGET_SYSTEM_KINDS.join(" or ")}.`,
    );
  }
  if (!(TARGET_SYSTEM_KINDS as readonly unknown[]).includes(kind)) {
    throw new PamInputError(`"kind" must be ${TARGET_SYSTEM_KINDS.join(" or ")}.`);
  }
  if (typeof input.supportsSessionTermination !== "boolean") {
    throw new PamInputError(
      'An automatic target system needs "supportsSessionTermination": true or false.',
    );
  }
  return {
    method,
    name,
    kind: kind as (typeof TARGET_SYSTEM_KINDS)[number],
    passwordPolicy,
    supportsSessionTermination: input.supportsSessionTermination,
  };
}

function validateName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PamInputError('The request needs a "name".');
  }
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) {
    throw new PamInputError(`"name" must be between 1 and ${MAX_NAME_LENGTH} characters.`);
  }
  return name;
}

function validatePasswordPolicy(value: unknown): PasswordPolicy {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new PamInputError('The request needs a "passwordPolicy" object.');
  }
  const policy = value as Record<string, unknown>;
  const unknown = Object.keys(policy).filter(
    (key) => !(POLICY_KEYS as readonly string[]).includes(key),
  );
  if (unknown.length > 0) {
    throw new PamInputError(
      `"passwordPolicy" does not take ${unknown.map((key) => `"${sanitizeUntrusted(key, 40)}"`).join(", ")}.`,
    );
  }
  for (const key of ["minLength", "maxLength"] as const) {
    const length = policy[key];
    if (typeof length !== "number" || !Number.isInteger(length) || length < 1) {
      throw new PamInputError(`"passwordPolicy.${key}" must be a positive whole number.`);
    }
  }
  for (const key of POLICY_KEYS.slice(2)) {
    if (typeof policy[key] !== "boolean") {
      throw new PamInputError(`"passwordPolicy.${key}" must be true or false.`);
    }
  }
  if ((policy.minLength as number) > (policy.maxLength as number)) {
    throw new PamInputError('"passwordPolicy.minLength" must not exceed "maxLength".');
  }
  return {
    minLength: policy.minLength as number,
    maxLength: policy.maxLength as number,
    includeUppercase: policy.includeUppercase as boolean,
    includeLowercase: policy.includeLowercase as boolean,
    includeDigits: policy.includeDigits as boolean,
    includeSymbols: policy.includeSymbols as boolean,
  };
}
