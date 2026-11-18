import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";

/** i18n keys used by the "remove Send authentication" flow. */
export type RemoveSendAuthI18nKeys = Readonly<{
  /** Menu item, button label, and confirmation dialog title. */
  label: string;
  /** Confirmation dialog body. */
  confirmation: string;
  /** Success toast shown after authentication is removed. */
  removed: string;
}>;

const passwordKeys: RemoveSendAuthI18nKeys = Object.freeze({
  label: "removePassword",
  confirmation: "removeSendPasswordConfirmation",
  removed: "removedPassword",
});

const emailVerificationKeys: RemoveSendAuthI18nKeys = Object.freeze({
  label: "removeEmailVerification",
  confirmation: "removeSendEmailVerificationConfirmation",
  removed: "removedEmailVerification",
});

/** Used when the Send's auth type is unknown (e.g. legacy data where `authType` is null). */
const genericKeys: RemoveSendAuthI18nKeys = Object.freeze({
  label: "removeAuth",
  confirmation: "removeAuthConfirmation",
  removed: "removedAuth",
});

/**
 * Returns the i18n keys describing what removing a Send's authentication will remove, so the
 * UI can say "Remove password" or "Remove email verification" instead of a generic label.
 *
 * Falls back to the generic "password or email verification" keys when the auth type is
 * unknown.
 *
 * @param authType - The Send's current auth type.
 */
export function removeSendAuthI18nKeys(
  authType: AuthType | null | undefined,
): RemoveSendAuthI18nKeys {
  switch (authType) {
    case AuthType.Password:
      return passwordKeys;
    case AuthType.Email:
      return emailVerificationKeys;
    default:
      return genericKeys;
  }
}
