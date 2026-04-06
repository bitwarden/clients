/** This object represents the different custom field types in Password Depot */
export const PasswordDepotCustomFieldType = Object.freeze({
  Password: "1",
  Memo: "2",
  Date: "3",
  Number: "4",
  Boolean: "5",
  Decimal: "6",
  Email: "7",
  URL: "8",
} as const);

/** This type represents the different custom field types in Password Depot */
export type PasswordDepotCustomFieldType =
  (typeof PasswordDepotCustomFieldType)[keyof typeof PasswordDepotCustomFieldType];
