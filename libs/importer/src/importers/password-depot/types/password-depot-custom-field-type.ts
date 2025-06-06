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

export type PasswordDepotCustomFieldType =
  _PasswordDepotCustomFieldType[keyof _PasswordDepotCustomFieldType];
export const PasswordDepotCustomFieldType: Readonly<{
  [K in keyof typeof _PasswordDepotCustomFieldType]: PasswordDepotCustomFieldType;
}> = Object.freeze(_PasswordDepotCustomFieldType);
