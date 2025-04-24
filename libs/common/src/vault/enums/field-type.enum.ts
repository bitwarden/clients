/**
 * @deprecated instead use `FieldTypes` constants and `FieldTypeValue` type over unsafe typescript enums
 **/
export enum FieldType {
  Text = 0,
  Hidden = 1,
  Boolean = 2,
  Linked = 3,
}

export const FieldTypes = {
  Text: 0,
  Hidden: 1,
  Boolean: 2,
  Linked: 3,
} as const;

export type FieldTypeValue = (typeof FieldTypes)[keyof typeof FieldTypes];
