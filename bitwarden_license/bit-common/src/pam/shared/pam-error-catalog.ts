/**
 * One entry of {@link PAM_ERROR_CATALOG}. `sentence` is matched against the server's text with
 * `includes`, since an undecoded message keeps the SDK's transport prefix. `code` is a stable
 * kebab-case slug that scripts can rely on, because the server sends no machine-readable codes.
 */
export interface PamErrorCatalogEntry {
  readonly code: string;
  readonly sentence: string;
}

/**
 * The single catalog of literal sentences the PAM server and SDK use to refuse an operation.
 *
 * Copied, not imported, from the web client's `request-access-error.ts`, `activate-access-error.ts`,
 * `decide-access-error.ts`, `pam-license-error.ts`, `access-rule-error.ts` and `rotation-error.ts`,
 * and it must be kept in sync with them. Only text found here is ever printed for a server
 * refusal: any other server message may carry filesystem paths, so it is reduced to its status.
 */
export const PAM_ERROR_CATALOG = Object.freeze({
  /**
   * The first sentence of `PamLicenseGuard.UnlicensedMessage`, thrown by submit, activate and
   * extend. Only the first, so the admin-contact half can be reworded server-side.
   */
  Unlicensed: {
    code: "unlicensed",
    sentence: "A Privileged Controls license is required to access this item.",
  },

  RequestReasonRequired: {
    code: "reason-required",
    sentence: "A reason is required for items that need human approval.",
  },
  RequestAlreadyActive: {
    code: "already-active",
    sentence: "You already have active access to this item.",
  },
  RequestAlreadyApproved: {
    code: "already-approved",
    sentence: "You already have an approved request for this item.",
  },
  RequestAlreadyPending: {
    code: "already-pending",
    sentence: "You already have a pending request for this item.",
  },
  RequestAutomaticGotWindow: {
    code: "automatic-got-window",
    sentence: "This item is approved automatically; provide a duration, not a window.",
  },
  RequestHumanGotDuration: {
    code: "human-got-duration",
    sentence: "This item requires human approval; provide a start and end date, not a duration.",
  },
  RequestStartBeforeEnd: {
    code: "start-not-before-end",
    sentence: "The start date must be before the end date.",
  },
  RequestWindowInPast: {
    code: "window-in-past",
    sentence: "The end date must be in the future.",
  },
  RequestStartEndRequired: {
    code: "start-end-required",
    sentence: "A start and end date are required.",
  },
  RequestPositiveDurationRequired: {
    code: "positive-duration-required",
    sentence: "A positive duration is required.",
  },
  RequestNotLeasingGated: {
    code: "not-leasing-gated",
    sentence: "This item does not require a lease.",
  },
  /**
   * The SDK raises this before the wire (`AccessRequestWindowError::EndInPast`), in its own words,
   * so the local twin of {@link RequestWindowInPast} needs an entry of its own.
   */
  SdkRequestWindowEnded: {
    code: "window-in-past",
    sentence: "The requested window has already ended.",
  },

  ActivateWindowNotStarted: {
    code: "window-not-started",
    sentence: "The approved access window has not started yet.",
  },
  ActivateWindowEnded: {
    code: "window-ended",
    sentence: "The approved access window has already ended.",
  },
  ActivateNotApproved: {
    code: "not-approved",
    sentence: "This request has not been approved yet.",
  },
  ActivateNoLongerActivatable: {
    code: "no-longer-activatable",
    sentence: "This request can no longer be activated.",
  },
  ActivateAlreadyUsed: {
    code: "already-used",
    sentence: "This request's access has already been used and is no longer active.",
  },
  ActivateSingleActiveLease: {
    code: "single-active-lease",
    sentence: "Another active lease exists for this item. Try again once it ends.",
  },
  ActivateNetworkNotPermitted: {
    code: "network-not-permitted",
    sentence: "Access to this item is not permitted from your current network.",
  },
  ActivateTimeNotPermitted: {
    code: "time-not-permitted",
    sentence: "Access to this item is not permitted at this time.",
  },
  ActivateNotPermitted: {
    code: "not-permitted",
    sentence: "Access to this item is not permitted right now.",
  },

  /** Withdrawn, retracted or decided by another approver; the server words all three alike. */
  DecideAlreadyResolved: {
    code: "already-resolved",
    sentence: "This request has already been resolved.",
  },
  DecideWindowEnded: {
    code: "window-ended",
    sentence: "This request's window has already ended.",
  },

  RuleNameRequired: { code: "name-required", sentence: "Name is required." },
  /** The SDK's own pre-HTTP message for the same refusal. */
  RuleNameRequiredLocally: {
    code: "name-required",
    sentence: "Name must be between 1 and 256 characters",
  },
  RuleNameTaken: { code: "name-taken", sentence: "A rule with that name already exists." },
  RuleExtensionLengthRequired: {
    code: "extension-length-required",
    sentence: "A maximum extension length is required when extensions are allowed.",
  },
  RuleCollectionsMissing: {
    code: "collections-missing",
    sentence: "One or more collections could not be found.",
  },
  RuleCollectionsForeign: {
    code: "collections-foreign",
    sentence: "One or more collections do not belong to this organization.",
  },
  RuleCollectionsGoverned: {
    code: "collections-governed",
    sentence: "One or more collections are already governed by another access rule.",
  },

  /** `RotationValidationError`'s refusals, verbatim from its `Display` in `bitwarden-pam`. */
  RotationInvalidName: {
    code: "invalid-name",
    sentence: "Name must be between 1 and 200 characters",
  },
  RotationInvalidAccountIdentity: {
    code: "invalid-account-identity",
    sentence: "Account identity must be between 1 and 500 characters",
  },
  RotationInvalidPasswordLengthBounds: {
    code: "invalid-password-length-bounds",
    sentence: "Password length bounds are outside the generator's supported range",
  },
  RotationNoCharacterClasses: {
    code: "no-character-classes",
    sentence: "A password policy must allow at least one character class",
  },
  RotationBelowPasswordStrengthFloor: {
    code: "below-password-strength-floor",
    sentence: "Password policy falls below the minimum password strength floor",
  },
  RotationInvalidCron: {
    code: "invalid-cron",
    sentence: "Schedule must be a 6- or 7-field Quartz cron expression",
  },
  RotationSessionTerminationUnsupported: {
    code: "session-termination-unsupported",
    sentence: "The target system does not confirm it supports session termination",
  },
  RotationTargetSystemSealInvalid: {
    code: "target-system-seal-invalid",
    sentence: "The target system's sealed data is invalid",
  },
  RotationTargetSystemMethodMismatch: {
    code: "target-system-method-immutable",
    sentence: "Target system method cannot be changed",
  },
  RotationTargetSystemKindMismatch: {
    code: "target-system-kind-immutable",
    sentence: "Target system kind cannot be changed",
  },
  RotationConfigImmutableFieldMismatch: {
    code: "rotation-config-immutable",
    sentence: "Rotation config cipher or target system cannot be changed",
  },
} as const satisfies Record<string, PamErrorCatalogEntry>);

/** The first catalog entry whose sentence appears in `message`, if any. */
export function findCatalogEntry(message: string): PamErrorCatalogEntry | undefined {
  return Object.values(PAM_ERROR_CATALOG).find((entry) => message.includes(entry.sentence));
}

/**
 * The refusal the server interpolates its `EffectiveMax` into, and the SDK's local twin, which has
 * no full stop. Captures the noun too, since a duration refusal must not be worded as a window one.
 */
const EXCEEDS_MAX_PATTERN =
  /The requested (duration|window) exceeds the maximum of (\d+) seconds\.?/;

export interface ExceedsMax {
  readonly scope: "duration" | "window";
  readonly maxSeconds: number;
}

/** The scope and maximum from an "exceeds the maximum" refusal, or `undefined`. */
export function findExceedsMax(message: string): ExceedsMax | undefined {
  const match = EXCEEDS_MAX_PATTERN.exec(message);
  if (match == null) {
    return undefined;
  }
  const maxSeconds = Number(match[2]);
  return Number.isSafeInteger(maxSeconds)
    ? { scope: match[1] === "duration" ? "duration" : "window", maxSeconds }
    : undefined;
}
