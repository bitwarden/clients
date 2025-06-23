const _PasswordDepotCustomFieldType = {
  Password: "1",
  Memo: "2",
  Date: "3",
  Number: "4",
  Boolean: "5",
  Decimal: "6",
  Email: "7",
  URL: "8",
} as const;
type _PasswordDepotCustomFieldType = typeof _PasswordDepotCustomFieldType;

// This type represents the different custom field types in Password Depot
export type PasswordDepotCustomFieldType =
  _PasswordDepotCustomFieldType[keyof _PasswordDepotCustomFieldType];

// This object represents the different custom field types in Password Depot
// It is a union of the string literals defined in _PasswordDepotCustomFieldType
// Each key in _PasswordDepotCustomFieldType corresponds to a specific custom field type
export const PasswordDepotCustomFieldType: Readonly<{
  [K in keyof typeof _PasswordDepotCustomFieldType]: PasswordDepotCustomFieldType;
}> = Object.freeze(_PasswordDepotCustomFieldType);
