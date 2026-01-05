import { FieldType as SdkFieldType } from "@bitwarden/sdk-internal";

const _FieldType = Object.freeze({
  Text: 0,
  Hidden: 1,
  Boolean: 2,
  Linked: 3,
} as const);

type _FieldType = typeof _FieldType;

export type FieldType = _FieldType[keyof _FieldType];

export const FieldType: Record<keyof _FieldType, FieldType> = _FieldType;

/**
 * Normalizes a FieldType value to ensure compatibility with the SDK.
 * @param value - The field type from user data
 * @returns Valid FieldType, defaults to FieldType.Text if unrecognized
 */
export function normalizeFieldTypeForSdk(value: FieldType): SdkFieldType {
  switch (value) {
    case FieldType.Text:
    case FieldType.Hidden:
    case FieldType.Boolean:
    case FieldType.Linked:
      return value;
    default:
      return FieldType.Text;
  }
}
