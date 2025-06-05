const _PasswordDepotItemType = {
  Password: "0",
  CreditCard: "1",
  SoftwareLicense: "2",
  Identity: "3",
  Information: "4",
  Banking: "5",
  EncryptedFile: "6",
  RDP: "8",
  Putty: "9",
  TeamViewer: "10",
  Certificate: "11",
} as const;
type _PasswordDepotItemType = typeof _PasswordDepotItemType;

export type PasswordDepotItemType = _PasswordDepotItemType[keyof _PasswordDepotItemType];
export const PasswordDepotItemType: Readonly<{
  [K in keyof typeof _PasswordDepotItemType]: PasswordDepotItemType;
}> = Object.freeze(_PasswordDepotItemType);
