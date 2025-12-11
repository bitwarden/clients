export interface ExportData {
  accounts?: AccountsEntity[] | null;
}
export interface AccountsEntity {
  attrs: AccountAttributes;
  vaults?: VaultsEntity[] | null;
}
export interface AccountAttributes {
  accountName: string;
  name: string;
  avatar: string;
  email: string;
  uuid: string;
  domain: string;
}
export interface VaultsEntity {
  attrs: VaultAttributes;
  items?: Item[] | null;
}
export interface VaultAttributes {
  uuid: string;
  desc: string;
  avatar: string;
  name: string;
  type: string;
}

/**
 * Represents the different types of items that can be stored in 1Password.
 */
export const Category = Object.freeze({
  Login: "001",
  CreditCard: "002",
  SecureNote: "003",
  Identity: "004",
  Password: "005",
  Document: "006",
  SoftwareLicense: "100",
  BankAccount: "101",
  Database: "102",
  DriversLicense: "103",
  OutdoorLicense: "104",
  Membership: "105",
  Passport: "106",
  RewardsProgram: "107",
  SocialSecurityNumber: "108",
  WirelessRouter: "109",
  Server: "110",
  EmailAccount: "111",
  API_Credential: "112",
  MedicalRecord: "113",
} as const);

/**
 * Represents valid 1Password category values.
 */
export type Category = (typeof Category)[keyof typeof Category];

export interface Item {
  uuid: string;
  favIndex: number;
  createdAt: number;
  updatedAt: number;
  state: "active" | "archived";
  categoryUuid: string;
  details: Details;
  overview: Overview;
}
export interface Details {
  loginFields?: (LoginFieldsEntity | null)[] | null;
  notesPlain?: string | null;
  sections?: (SectionsEntity | null)[] | null;
  passwordHistory?: (PasswordHistoryEntity | null)[] | null;
  documentAttributes?: DocumentAttributes | null;
  password?: string | null;
}

/**
 * Represents 1Password login field types that can be stored in login items.
 */
export const LoginFieldType = Object.freeze({
  TextOrHtml: "T",
  EmailAddress: "E",
  URL: "U",
  Number: "N",
  Password: "P",
  TextArea: "A",
  PhoneNumber: "TEL",
  CheckBox: "C",
} as const);

/**
 * Type representing valid 1Password login field type values.
 */
export type LoginFieldType = (typeof LoginFieldType)[keyof typeof LoginFieldType];

export interface LoginFieldsEntity {
  value: string;
  id: string;
  name: string;
  fieldType: LoginFieldType | string;
  designation?: string | null;
}
export interface SectionsEntity {
  title: string;
  name?: string | null;
  fields?: FieldsEntity[] | null;
  hideAddAnotherField?: boolean | null;
}
export interface FieldsEntity {
  title: string;
  id: string;
  value: Value;
  guarded: boolean;
  multiline: boolean;
  dontGenerate: boolean;
  placeholder?: string;
  inputTraits: InputTraits;
  clipboardFilter?: string | null;
}
export interface Value {
  totp?: string | null;
  date?: number | null;
  string?: string | null;
  concealed?: string | null;
  email?: Email | null;
  phone?: string | null;
  menu?: string | null;
  gender?: string | null;
  monthYear?: number | null;
  url?: string | null;
  address?: Address | null;
  creditCardType?: string | null;
  creditCardNumber?: string | null;
  reference?: string | null;
}

export interface Email {
  email_address: string;
  provider: string | null;
}

export interface Address {
  street: string;
  city: string;
  country: string;
  zip: string;
  state: string;
}
export interface InputTraits {
  keyboard: string;
  correction: string;
  capitalization: string;
}
export interface PasswordHistoryEntity {
  value: string;
  time: number;
}
export interface DocumentAttributes {
  fileName: string;
  documentId: string;
  decryptedSize: number;
}
export interface Overview {
  subtitle: string;
  title: string;
  url: string;
  urls?: UrlsEntity[] | null;
  ps?: number | null;
  pbe?: number | null;
  pgrng?: boolean | null;
  tags?: string[] | null;
  icons?: string | null;
  watchtowerExclusions?: string | null;
}
export interface UrlsEntity {
  label: string;
  url: string;
}
