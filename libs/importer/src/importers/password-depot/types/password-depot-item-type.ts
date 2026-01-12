/** This object represents the different item types in Password Depot */
export const PasswordDepotItemType = Object.freeze({
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
} as const);

/** This type represents the different item types in Password Depot */
export type PasswordDepotItemType =
  (typeof PasswordDepotItemType)[keyof typeof PasswordDepotItemType];
