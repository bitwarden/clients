/**
 * Contract for OpenShell environments, secret sets and sandbox metadata (agent-access-architecture.md,
 * §M8.20 rule 17). BINDING for main and renderer.
 *
 * This is app-side metadata, kept in a JSON store in `userData` keyed by gateway. It holds ids,
 * names, env-var names, display text and resource sizes only: never a secret value, never a `bw://`
 * reference string. Plain data and pure validators so main and renderer share them.
 */
import {
  buildBitwardenReference,
  isOpenShellCpuQuantity,
  isOpenShellDeniedEnvVarName,
  isOpenShellEnvVarName,
  isOpenShellImageReference,
  isOpenShellMemoryQuantity,
  isOpenShellResourceName,
  isOpenShellVaultId,
  OpenShellVaultField,
  OpenShellVaultResourceType,
} from "./openshell-management";

export const OPENSHELL_MAX_ENVIRONMENTS = 100;
export const OPENSHELL_MAX_SECRET_SETS = 100;
export const OPENSHELL_MAX_SANDBOX_META = 500;
export const OPENSHELL_MAX_SECRETS_PER_SET = 30;
export const OPENSHELL_MAX_NAME_CHARS = 60;
export const OPENSHELL_MAX_DESCRIPTION_CHARS = 200;
export const OPENSHELL_MAX_PURPOSE_CHARS = 120;
const MAX_LABEL_CHARS = 120;

/** Bidi controls, zero-width characters and the BOM: they can reorder or hide display text. */
const INVISIBLE_FORMATTING = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Display text: control, bidi-control and zero-width characters removed, trimmed, capped. */
export function cleanOpenShellDisplayText(text: string, maxChars: number): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
      .replace(INVISIBLE_FORMATTING, "")
      .trim()
      .slice(0, maxChars)
  );
}

// ---------------------------------------------------------------------------------------------
// Secret references and sets
// ---------------------------------------------------------------------------------------------

/**
 * One secret a sandbox gets: which vault object, which part of it, under which permission
 * (provider profile) and as which env var. Ids and names only.
 */
export interface OpenShellSecretRef {
  resourceType: OpenShellVaultResourceType;
  /** Lowercase vault item or secret UUID. */
  id: string;
  field: OpenShellVaultField;
  /** The item's display name when the ref was captured. Display only; may be stale. */
  label: string;
  profileId: string;
  envVar: string;
}

/** `null` for anything that is not a complete, valid ref. Unknown fields are dropped. */
export function parseOpenShellSecretRef(value: unknown): OpenShellSecretRef | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.label !== "string" ||
    !isOpenShellResourceName(raw.profileId) ||
    !isOpenShellEnvVarName(raw.envVar) ||
    isOpenShellDeniedEnvVarName(raw.envVar)
  ) {
    return null;
  }
  const ref = {
    resourceType: raw.resourceType,
    id: raw.id,
    field: raw.field,
  } as Pick<OpenShellSecretRef, "resourceType" | "id" | "field">;
  const credential = { ...ref, envVar: raw.envVar };
  if (buildBitwardenReference(credential) == null) {
    return null;
  }
  return {
    ...ref,
    label: cleanOpenShellDisplayText(raw.label, MAX_LABEL_CHARS),
    profileId: raw.profileId,
    envVar: raw.envVar,
  };
}

/** A list of valid refs, none sharing an env var; `null` when anything is wrong or it is too long. */
export function parseOpenShellSecretRefs(value: unknown): OpenShellSecretRef[] | null {
  if (!Array.isArray(value) || value.length > OPENSHELL_MAX_SECRETS_PER_SET) {
    return null;
  }
  const refs: OpenShellSecretRef[] = [];
  const envVars = new Set<string>();
  for (const item of value) {
    const ref = parseOpenShellSecretRef(item);
    if (ref == null || envVars.has(ref.envVar)) {
      return null;
    }
    envVars.add(ref.envVar);
    refs.push(ref);
  }
  return refs;
}

/** A named bundle of secret references. */
export interface OpenShellSecretSet {
  /** Lowercase UUID, assigned by main. */
  id: string;
  name: string;
  secrets: OpenShellSecretRef[];
}

/** Create (no `id`) or replace (`id`) a set. */
export interface OpenShellSaveSecretSetRequest {
  id?: string;
  name: string;
  secrets: OpenShellSecretRef[];
}

export interface OpenShellDeleteByIdRequest {
  id: string;
}

// ---------------------------------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------------------------------

/**
 * A named preset for creating a sandbox. `from` and `template` are mutually exclusive; the secrets
 * are either a saved set (`secretSetId`) or inline refs (`secrets`), never both.
 */
export interface OpenShellEnvironment {
  /** Lowercase UUID, assigned by main. */
  id: string;
  name: string;
  description: string;
  from?: string;
  template?: string;
  cpu?: string;
  memory?: string;
  secretSetId?: string;
  secrets?: OpenShellSecretRef[];
}

/** Create (no `id`) or replace (`id`) an environment. Same shape without the assigned id. */
export type OpenShellSaveEnvironmentRequest = Omit<OpenShellEnvironment, "id"> & { id?: string };

/**
 * Validates and normalises an environment (everything except `id`). `null` when invalid. Whether
 * `secretSetId` exists is checked by the caller, which owns the sets.
 */
export function parseOpenShellEnvironmentBody(
  value: unknown,
): Omit<OpenShellEnvironment, "id"> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== "string") {
    return null;
  }
  const name = cleanOpenShellDisplayText(raw.name, OPENSHELL_MAX_NAME_CHARS);
  if (name === "") {
    return null;
  }
  const description =
    raw.description == null
      ? ""
      : typeof raw.description === "string"
        ? cleanOpenShellDisplayText(raw.description, OPENSHELL_MAX_DESCRIPTION_CHARS)
        : null;
  if (description == null) {
    return null;
  }
  const env: Omit<OpenShellEnvironment, "id"> = { name, description };

  const present = (v: unknown) => v != null && v !== "";
  if (present(raw.from) && present(raw.template)) {
    return null;
  }
  if (present(raw.from)) {
    if (!isOpenShellImageReference(raw.from)) {
      return null;
    }
    env.from = raw.from;
  }
  if (present(raw.template)) {
    if (!isOpenShellResourceName(raw.template)) {
      return null;
    }
    env.template = raw.template;
  }
  if (present(raw.cpu)) {
    if (!isOpenShellCpuQuantity(raw.cpu)) {
      return null;
    }
    env.cpu = raw.cpu;
  }
  if (present(raw.memory)) {
    if (!isOpenShellMemoryQuantity(raw.memory)) {
      return null;
    }
    env.memory = raw.memory;
  }
  if (present(raw.secretSetId) && raw.secrets != null) {
    return null;
  }
  if (present(raw.secretSetId)) {
    if (!isOpenShellVaultId(raw.secretSetId)) {
      return null;
    }
    env.secretSetId = raw.secretSetId;
  }
  if (raw.secrets != null) {
    const refs = parseOpenShellSecretRefs(raw.secrets);
    if (refs == null) {
      return null;
    }
    if (refs.length > 0) {
      env.secrets = refs;
    }
  }
  return env;
}

// ---------------------------------------------------------------------------------------------
// Sandbox metadata
// ---------------------------------------------------------------------------------------------

/** The fixed accent palette. Each maps to a Tailwind class in the renderer. */
export const OPENSHELL_META_COLORS = ["blue", "green", "amber", "red", "gray"] as const;
export type OpenShellMetaColor = (typeof OPENSHELL_META_COLORS)[number];

export function isOpenShellMetaColor(value: unknown): value is OpenShellMetaColor {
  return typeof value === "string" && (OPENSHELL_META_COLORS as readonly string[]).includes(value);
}

/** What the user wrote about one sandbox. Keyed by gateway and sandbox name in the store. */
export interface OpenShellSandboxMeta {
  name: string;
  /** One line, at most 120 characters, cleaned. `""` when unset. */
  purpose: string;
  color: OpenShellMetaColor | null;
}

/** Setting an empty purpose and no color removes the entry. */
export interface OpenShellSetSandboxMetaRequest {
  name: string;
  purpose: string;
  color: OpenShellMetaColor | null;
}

/** One line: line breaks and tabs become spaces, runs of spaces collapse, then the usual cleaning. */
export function cleanOpenShellPurpose(text: string): string {
  const oneLine = cleanOpenShellDisplayText(
    text.replace(/[\r\n\t\u2028\u2029]+/g, " "),
    Number.MAX_SAFE_INTEGER,
  ).replace(/ {2,}/g, " ");
  return oneLine.slice(0, OPENSHELL_MAX_PURPOSE_CHARS).trim();
}
