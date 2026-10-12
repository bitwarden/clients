import { apiErrorBodyMessage } from "../abstractions/api-error";

import type { RotationError, TargetSystemCreateError, TargetSystemId } from "./rotation";

/**
 * Not the SDK's own `isRotationError`, which is a runtime wasm import; this directory stays
 * type-only (see "`export type` matters" in the PAM `CLAUDE.md`).
 */
function isRotationError(e: unknown): e is RotationError {
  return (
    e instanceof Error &&
    (e as Partial<RotationError>).name === "RotationError" &&
    typeof (e as Partial<RotationError>).variant === "string"
  );
}

/**
 * The toastable message of a `RotationError`: the server's own message for an `Api` failure, else
 * the SDK's own wording verbatim (`RotationError::Validation` is `#[error(transparent)]`, so its
 * `.message` is the inner `RotationValidationError`'s `Display`). `undefined` for any other error,
 * or an `Api` failure whose body didn't parse.
 */
export function rotationErrorMessage(e: unknown): string | undefined {
  if (!isRotationError(e)) {
    return undefined;
  }
  return e.variant === "Api" ? apiErrorBodyMessage(e.message) : e.message;
}

/**
 * `TargetSystemsClient.create`'s two-phase registration can fail after the server already created
 * the row (left in `pending_seal`), in which case the thrown `TargetSystemCreateError` carries its
 * id. Unlike `RotationError`, this crosses the FFI boundary as a plain object
 * (`bitwarden-error`'s `full` mode serializes the struct directly) rather than an `Error`
 * subclass, so there is no `.name`/`.variant` to key on — this checks shape instead.
 */
function isTargetSystemCreateError(e: unknown): e is TargetSystemCreateError {
  return (
    typeof e === "object" &&
    e != null &&
    !(e instanceof Error) &&
    typeof (e as Partial<TargetSystemCreateError>).message === "string"
  );
}

/**
 * The id of a target system `TargetSystemsClient.create` registered but could not finish sealing,
 * so the caller can route the operator to finish setup through `update` (the edit page's normal
 * save) instead of stranding them on a create form the server already half-actioned.
 * `undefined` for any other error, or when nothing was created at all.
 */
export function targetSystemCreatePendingId(e: unknown): TargetSystemId | undefined {
  return isTargetSystemCreateError(e) ? e.id : undefined;
}

/** The toastable message of a `TargetSystemCreateError`, whether or not it carries a pending id. */
export function targetSystemCreateErrorMessage(e: unknown): string | undefined {
  return isTargetSystemCreateError(e) ? e.message : undefined;
}

/**
 * `RotationValidationError`'s refusals, in the exact words its `Display` renders (see
 * `bitwarden-pam`'s `rotation/validate.rs`). Matched with `includes` against
 * {@link rotationErrorMessage}, since an undecoded message keeps the SDK's transport prefix.
 */
export const ROTATION_VALIDATION_ERRORS = Object.freeze({
  InvalidName: "Name must be between 1 and 200 characters",
  InvalidAccountIdentity: "Account identity must be between 1 and 500 characters",
  InvalidPasswordLengthBounds: "Password length bounds are outside the generator's supported range",
  NoCharacterClasses: "A password policy must allow at least one character class",
  BelowPasswordStrengthFloor: "Password policy falls below the minimum password strength floor",
  InvalidCron: "Schedule must be a 6- or 7-field Quartz cron expression",
  SessionTerminationUnsupported:
    "The target system does not confirm it supports session termination",
  TargetSystemSealInvalid: "The target system's sealed data is invalid",
  TargetSystemMethodMismatch: "Target system method cannot be changed",
  TargetSystemKindMismatch: "Target system kind cannot be changed",
  RotationConfigImmutableFieldMismatch: "Rotation config cipher or target system cannot be changed",
} as const);

/**
 * i18n keys for the refusals new to sealed PAM: the password strength floor, the
 * session-termination capability check, seal-integrity checks, and the two immutable-field
 * mismatches. The remaining catalog entries above are refusals this client already prevents by
 * construction (name length, cron shape, …); the only way to hit one is a race or a second tab,
 * so {@link classifyRotationError} echoes the SDK's own sentence for those instead of coining a
 * key nobody normally sees.
 */
const ROTATION_VALIDATION_ERROR_KEYS: ReadonlyArray<{
  readonly message: string;
  readonly key: string;
}> = [
  {
    message: ROTATION_VALIDATION_ERRORS.BelowPasswordStrengthFloor,
    key: "pamTargetSystemPolicyBelowStrengthFloor",
  },
  {
    message: ROTATION_VALIDATION_ERRORS.SessionTerminationUnsupported,
    key: "pamRotationConfigTerminationUnsupported",
  },
  {
    message: ROTATION_VALIDATION_ERRORS.TargetSystemSealInvalid,
    key: "pamRotationConfigTargetSealInvalid",
  },
  {
    message: ROTATION_VALIDATION_ERRORS.TargetSystemMethodMismatch,
    key: "pamTargetSystemImmutableFieldMismatch",
  },
  {
    message: ROTATION_VALIDATION_ERRORS.TargetSystemKindMismatch,
    key: "pamTargetSystemImmutableFieldMismatch",
  },
  {
    message: ROTATION_VALIDATION_ERRORS.RotationConfigImmutableFieldMismatch,
    key: "pamRotationConfigImmutableFieldMismatch",
  },
];

/** How a rotation-client failure should be surfaced to the operator. */
export type RotationErrorOutcome =
  /** A known refusal with copy of its own. */
  | { readonly kind: "i18n"; readonly key: string }
  /** A `RotationError` this client doesn't special-case; its own message is informative enough. */
  | { readonly kind: "message"; readonly message: string }
  /** Not a `RotationError` (or an unparsable `Api` body) — the caller falls back to its own logic. */
  | { readonly kind: "generic" };

/** Classifies a `createTargetSystem`/`updateTargetSystem`/`createConfig`/`updateConfig` failure. */
export function classifyRotationError(e: unknown): RotationErrorOutcome {
  const message = rotationErrorMessage(e) ?? targetSystemCreateErrorMessage(e);
  if (message == null) {
    return { kind: "generic" };
  }
  const known = ROTATION_VALIDATION_ERROR_KEYS.find((entry) => message.includes(entry.message));
  return known != null ? { kind: "i18n", key: known.key } : { kind: "message", message };
}
