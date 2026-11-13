import type { CipherView } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";
import { sanitizeUntrusted } from "../shared/sanitize-untrusted";

/** The fields `lease reveal` can print, named as the `bw get` verbs are. */
export const LEASE_REVEAL_FIELDS = Object.freeze([
  "password",
  "username",
  "totp",
  "notes",
  "uri",
] as const);
export type LeaseRevealField = (typeof LEASE_REVEAL_FIELDS)[number];

/** The SDK's `CipherType.Login`. Spelled out because a runtime import of the SDK would load wasm. */
const CIPHER_TYPE_LOGIN = 1;

/**
 * Validates `--field`. It is required and has no default, so no verb ever dumps a whole item.
 * @throws PamInputError when the field is absent or not one of {@link LEASE_REVEAL_FIELDS}.
 */
export function parseRevealField(value: string | null | undefined): LeaseRevealField {
  const candidate = value?.trim().toLowerCase();
  const field = LEASE_REVEAL_FIELDS.find((f) => f === candidate);
  if (field == null) {
    throw new PamInputError(
      value == null
        ? `--field is required. Use one of ${LEASE_REVEAL_FIELDS.join(", ")}.`
        : `\`${sanitizeUntrusted(value, 32)}\` is not a field. Use one of ${LEASE_REVEAL_FIELDS.join(", ")}.`,
    );
  }
  return field;
}

const isBlank = (text: string | undefined | null): boolean => text == null || text.trim() === "";

/**
 * Picks the one requested field out of a decrypted view, with the refusals `bw get` uses. For
 * `totp` this is the stored seed or URI, which the caller turns into a code. The returned text is
 * a vault secret: it must only be written to stdout, never logged, stored or put in an error.
 * @throws PamInputError when the item is not a login (for login fields) or the field is empty.
 */
export function pickRevealField(view: CipherView, field: LeaseRevealField): string {
  if (field === "notes") {
    return requireText(view.notes, "No notes available for this item.");
  }
  if (view.type !== CIPHER_TYPE_LOGIN || view.login == null) {
    throw new PamInputError("Not a login.");
  }
  switch (field) {
    case "username":
      return requireText(view.login.username, "No username available for this login.");
    case "password":
      return requireText(view.login.password, "No password available for this login.");
    case "totp":
      return requireText(view.login.totp, "No TOTP available for this login.");
    case "uri":
      return requireText(view.login.uris?.[0]?.uri, "No uri available for this login.");
  }
}

function requireText(text: string | undefined | null, refusal: string): string {
  if (isBlank(text)) {
    throw new PamInputError(refusal);
  }
  return text as string;
}
