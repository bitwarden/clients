import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { isGuid } from "@bitwarden/guid";
import type { Uuid } from "@bitwarden/sdk-internal";

import { PamInputError } from "./pam-input-error";
import { sanitizeUntrusted } from "./sanitize-untrusted";

/**
 * Validates `value` as a GUID and lowercases it, the form the API and the vault state use.
 * @param label Names the value in the refusal, such as `organization id`.
 * @throws PamInputError when `value` is not a GUID.
 */
export function parseGuid(value: string | null | undefined, label: string): string {
  const candidate = value?.trim().toLowerCase();
  if (candidate == null || !isGuid(candidate)) {
    throw new PamInputError(`\`${sanitizeUntrusted(value, 64)}\` is not a valid ${label} (GUID).`);
  }
  return candidate;
}

/**
 * Validates `value` as a GUID and brands it as an SDK id such as `AccessRequestId`.
 * @throws PamInputError when `value` is not a GUID.
 */
export function toSdkId<T extends Uuid>(value: string | null | undefined, label: string): T {
  return asUuid<T>(parseGuid(value, label));
}

export function sdkIdToString<T extends Uuid>(id: T): string {
  return uuidAsString(id);
}
