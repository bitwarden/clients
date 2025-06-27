const _PasswordDepotItemType = {
  Password: "0",
  CreditCard: "1",
  SoftwareLicense: "2",
  Identity: "3",
  Information: "4",
  Banking: "5",
  EncryptedFile: "6",
  Document: "7",
  RDP: "8",
  Putty: "9",
  TeamViewer: "10",
  Certificate: "11",
} as const;
type _PasswordDepotItemType = typeof _PasswordDepotItemType;

// This type represents the different item types in Password Depot
export type PasswordDepotItemType = _PasswordDepotItemType[keyof _PasswordDepotItemType];

// This object represents the different item types in Password Depot
// It is a union of the string literals defined in _PasswordDepotItemType
// Each key in _PasswordDepotItemType corresponds to a specific item type
export const PasswordDepotItemType: Readonly<{
  [K in keyof typeof _PasswordDepotItemType]: PasswordDepotItemType;
}> = Object.freeze(_PasswordDepotItemType);
