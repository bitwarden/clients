import type {
  AccessCondition,
  AccessRuleAddEditRequest,
  CollectionId,
} from "@bitwarden/sdk-internal";

import { MAX_PAM_DURATION_SECONDS } from "../shared/pam-duration";
import { parseGuid, toSdkId } from "../shared/pam-ids";
import { PamInputError } from "../shared/pam-input-error";
import { sanitizeUntrusted } from "../shared/sanitize-untrusted";

/** The server's limits on a rule, mirrored so a refusal comes before anything is sent. */
export const ACCESS_RULE_NAME_MAX_LENGTH = 256;
export const ACCESS_RULE_MAX_CONDITIONS = 10;

/** Decides whether `value` is a CIDR, which is the SDK's `is_valid_cidr`. Injected so no wasm loads here. */
export type CidrValidator = (value: string) => boolean;

const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "name",
  "description",
  "enabled",
  "conditions",
  "singleActiveLease",
  "defaultLeaseDurationSeconds",
  "maxLeaseDurationSeconds",
  "allowsExtensions",
  "maxExtensionDurationSeconds",
  "collections",
]);

/**
 * The fields a request must state. A write that left one out would silently pick a value, for
 * example an update that omitted `enabled` would re-enable a disabled rule and one that omitted
 * `collections` would clear them, so these have no default.
 */
const REQUIRED_KEYS: readonly string[] = [
  "name",
  "enabled",
  "conditions",
  "singleActiveLease",
  "allowsExtensions",
  "collections",
];

/** The skeleton `bw pam rule template` prints: a valid request to copy and edit. */
export function accessRuleTemplate(): AccessRuleAddEditRequest {
  return {
    name: "Example rule",
    description: undefined,
    enabled: true,
    conditions: [{ kind: "human_approval" }],
    singleActiveLease: false,
    defaultLeaseDurationSeconds: 3600,
    maxLeaseDurationSeconds: 28800,
    allowsExtensions: false,
    maxExtensionDurationSeconds: undefined,
    collections: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accepts a missing or null field as "none", else a positive whole number of seconds within the cap. */
function parseSeconds(value: unknown, field: string): number | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new PamInputError(`${field} must be a positive whole number of seconds.`);
  }
  if (value > MAX_PAM_DURATION_SECONDS) {
    throw new PamInputError(
      `${field} cannot be longer than 365 days (${MAX_PAM_DURATION_SECONDS} seconds).`,
    );
  }
  return value;
}

function parseCondition(
  value: unknown,
  index: number,
  isValidCidr: CidrValidator,
): AccessCondition {
  if (!isRecord(value)) {
    throw new PamInputError(`Condition ${index + 1} must be an object with a kind.`);
  }
  switch (value.kind) {
    case "human_approval":
      return { kind: "human_approval" };
    case "ip_allowlist": {
      const cidrs = value.cidrs;
      if (!Array.isArray(cidrs) || cidrs.length === 0) {
        throw new PamInputError(
          `Condition ${index + 1}: an ip_allowlist needs at least one CIDR in cidrs.`,
        );
      }
      for (const cidr of cidrs) {
        if (typeof cidr !== "string" || !isValidCidr(cidr)) {
          throw new PamInputError(
            `Condition ${index + 1}: \`${sanitizeUntrusted(String(cidr), 64)}\` is not a valid CIDR range, such as 10.0.0.0/8.`,
          );
        }
      }
      return { kind: "ip_allowlist", cidrs: [...(cidrs as string[])] };
    }
    default:
      throw new PamInputError(
        `Condition ${index + 1}: kind must be human_approval or ip_allowlist.`,
      );
  }
}

/**
 * Validates an access rule request as the server would and returns it, ready to send. The seconds
 * are kept exactly as written, with no snapping to a preset. The name is trimmed.
 *
 * The server stays the authority; this only turns an obvious refusal into a clear local one.
 * Messages are written here and never echo the input, apart from short sanitized fragments.
 *
 * @throws PamInputError for anything the server would refuse, or for a field this code does not know.
 */
export function parseAccessRuleRequest(
  input: unknown,
  isValidCidr: CidrValidator,
): AccessRuleAddEditRequest {
  if (!isRecord(input)) {
    throw new PamInputError("The rule must be a JSON object. Run `bw pam rule template` for one.");
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new PamInputError(
        `\`${sanitizeUntrusted(key, 64)}\` is not a field of an access rule.`,
      );
    }
  }
  for (const key of REQUIRED_KEYS) {
    if (input[key] === undefined) {
      throw new PamInputError(
        `The rule is missing \`${key}\`. Run \`bw pam rule template\` for one.`,
      );
    }
  }

  if (typeof input.name !== "string") {
    throw new PamInputError("name must be text.");
  }
  const name = input.name.trim();
  if (name.length < 1 || Array.from(name).length > ACCESS_RULE_NAME_MAX_LENGTH) {
    throw new PamInputError(
      `name must be between 1 and ${ACCESS_RULE_NAME_MAX_LENGTH} characters.`,
    );
  }

  if (input.description != null && typeof input.description !== "string") {
    throw new PamInputError("description must be text.");
  }
  for (const flag of ["enabled", "singleActiveLease", "allowsExtensions"]) {
    if (typeof input[flag] !== "boolean") {
      throw new PamInputError(`${flag} must be true or false.`);
    }
  }

  if (!Array.isArray(input.conditions)) {
    throw new PamInputError("conditions must be a list.");
  }
  if (input.conditions.length > ACCESS_RULE_MAX_CONDITIONS) {
    throw new PamInputError(`A rule can have at most ${ACCESS_RULE_MAX_CONDITIONS} conditions.`);
  }
  const conditions = input.conditions.map((c, i) => parseCondition(c, i, isValidCidr));

  const defaultLease = parseSeconds(
    input.defaultLeaseDurationSeconds,
    "defaultLeaseDurationSeconds",
  );
  const maxLease = parseSeconds(input.maxLeaseDurationSeconds, "maxLeaseDurationSeconds");
  if (defaultLease != null && maxLease != null && defaultLease > maxLease) {
    throw new PamInputError(
      "defaultLeaseDurationSeconds cannot be longer than maxLeaseDurationSeconds.",
    );
  }
  const maxExtension = parseSeconds(
    input.maxExtensionDurationSeconds,
    "maxExtensionDurationSeconds",
  );
  if (input.allowsExtensions === true && maxExtension == null) {
    throw new PamInputError(
      "maxExtensionDurationSeconds is required, and must be positive, when allowsExtensions is true.",
    );
  }

  if (!Array.isArray(input.collections)) {
    throw new PamInputError("collections must be a list of collection ids.");
  }
  const collectionStrings: string[] = input.collections.map((c: unknown) => {
    if (typeof c !== "string") {
      throw new PamInputError("Every collection must be a collection id (GUID).");
    }
    return parseGuid(c, "collection id");
  });
  const collectionIds = [...new Set(collectionStrings)].map((c) =>
    toSdkId<CollectionId>(c, "collection id"),
  );

  return {
    name,
    description: (input.description as string | null | undefined) ?? undefined,
    enabled: input.enabled as boolean,
    conditions,
    singleActiveLease: input.singleActiveLease as boolean,
    defaultLeaseDurationSeconds: defaultLease,
    maxLeaseDurationSeconds: maxLease,
    allowsExtensions: input.allowsExtensions as boolean,
    maxExtensionDurationSeconds: maxExtension,
    collections: collectionIds,
  };
}

/**
 * Parses the text of a rule request: JSON, or the base64 of JSON as `bw create item` takes it.
 * @throws PamInputError when the text is neither. The refusal never echoes the text.
 */
export function parseAccessRuleJson(text: string | null | undefined): unknown {
  const trimmed = text?.trim() ?? "";
  if (trimmed.length === 0) {
    throw new PamInputError(
      "The rule JSON was not provided. Pass it as an argument, with --file, or on standard input.",
    );
  }
  const json = trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf8");
  try {
    return JSON.parse(json);
  } catch {
    throw new PamInputError("The rule could not be parsed as JSON.");
  }
}
