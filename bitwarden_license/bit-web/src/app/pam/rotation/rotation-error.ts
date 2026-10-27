import { apiErrorBodyMessage } from "@bitwarden/bit-common/pam/abstractions/api-error";

import type { RotationError, TargetSystemCreateError, TargetSystemId } from "./rotation";

/** Local reimplementation: the SDK's own `isRotationError` is a runtime wasm import, but this directory stays type-only. */
function isRotationError(e: unknown): e is RotationError {
  return (
    e instanceof Error &&
    (e as Partial<RotationError>).name === "RotationError" &&
    typeof (e as Partial<RotationError>).variant === "string"
  );
}

/**
 * The toastable message of a `RotationError`: server text for an `Api` failure, else the SDK's
 * own wording verbatim. `undefined` for any other error, or an unparsed `Api` body.
 */
export function rotationErrorMessage(e: unknown): string | undefined {
  if (!isRotationError(e)) {
    return undefined;
  }
  return e.variant === "Api" ? apiErrorBodyMessage(e.message) : e.message;
}

/**
 * Unlike `RotationError`, this crosses the FFI boundary as a plain object (`bitwarden-error`'s
 * `full` mode), not an `Error` subclass — there's no `.name`/`.variant` to key on, so this checks
 * shape instead.
 */
function isTargetSystemCreateError(e: unknown): e is TargetSystemCreateError {
  return (
    typeof e === "object" &&
    e != null &&
    !(e instanceof Error) &&
    typeof (e as Partial<TargetSystemCreateError>).message === "string"
  );
}

/** The pending target's id from a partial create failure (see {@link isTargetSystemCreateError}), else `undefined`. */
export function targetSystemCreatePendingId(e: unknown): TargetSystemId | undefined {
  return isTargetSystemCreateError(e) ? e.id : undefined;
}

/** The toastable message of a `TargetSystemCreateError`, whether or not it carries a pending id. */
export function targetSystemCreateErrorMessage(e: unknown): string | undefined {
  return isTargetSystemCreateError(e) ? e.message : undefined;
}

/**
 * `RotationValidationError`'s refusals, verbatim from its `Display` (`bitwarden-pam`'s
 * `rotation/validate.rs`) — must stay in sync. Matched with `includes`, since an undecoded
 * message keeps the SDK's transport prefix.
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
 * i18n keys for refusals new to sealed PAM (strength floor, termination support, seal integrity,
 * immutable-field mismatches). The rest are prevented client-side by construction, so
 * {@link classifyRotationError} falls back to the SDK's own sentence for those.
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
