import { CipherType, isCipherType } from "../enums/cipher-type";

/**
 * Reads the restricted cipher types from the `data` of a `PolicyType.RestrictedItemTypes` policy.
 *
 * Before flag pm-32009-new-item-types is/was turned on, this was always unset and defaulted to `[Card]`
 * enforcement if the policy was active, as this was the only option. After activation, policies
 * will begin storing a `restrictedTypes` field containing the types to restrict by number.
 */
export function getRestrictedItemTypes(data: unknown): CipherType[] {
  if (
    typeof data === "object" &&
    data !== null &&
    "restrictedTypes" in data &&
    Array.isArray(data.restrictedTypes)
  ) {
    const types = data.restrictedTypes.filter(isCipherType);
    return Array.from(new Set(types));
  }

  return [CipherType.Card];
}
