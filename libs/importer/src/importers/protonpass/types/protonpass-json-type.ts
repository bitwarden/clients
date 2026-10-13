export type ProtonPassJsonFile = {
  version: string;
  userId: string;
  encrypted: boolean;
  vaults: Record<string, ProtonPassVault>;
};

export type ProtonPassVault = {
  name: string;
  description: string;
  display: {
    color: number;
    icon: number;
  };
  items: ProtonPassItem[];
};

export type ProtonPassItem = {
  itemId: string;
  shareId: string;
  data: ProtonPassItemData;
  state: ProtonPassItemState;
  aliasEmail: string | null;
  contentFormatVersion: number;
  createTime: number;
  modifyTime: number;
  pinned: boolean;
  shareCount?: number;
  files?: unknown[];
};

/**
 * Proton Pass item states as a const object.
 * Represents the different states an item can be in (active or trashed).
 */
export const ProtonPassItemState = Object.freeze({
  ACTIVE: 1,
  TRASHED: 2,
} as const);

/**
 * Type representing valid Proton Pass item state values.
 */
export type ProtonPassItemState = (typeof ProtonPassItemState)[keyof typeof ProtonPassItemState];

export type ProtonPassItemData = {
  metadata: ProtonPassItemMetadata;
  extraFields: ProtonPassItemExtraField[];
  platformSpecific?: any;
  type: "login" | "alias" | "creditCard" | "note" | "identity" | "custom" | "sshKey" | "wifi";
  content:
    | ProtonPassLoginItemContent
    | ProtonPassCreditCardItemContent
    | ProtonPassIdentityItemContent
    | ProtonPassCustomItemContent
    | ProtonPassSshKeyItemContent
    | ProtonPassWifiItemContent;
};

export type ProtonPassItemMetadata = {
  name: string;
  note: string;
  itemUuid: string;
};

export type ProtonPassItemExtraField =
  | ProtonPassItemExtraFieldContent
  | ProtonPassItemExtraFieldTimestamp
  | ProtonPassItemExtraFieldTotp;

type ProtonPassItemExtraFieldContent = {
  fieldName: string;
  type: "text" | "hidden";
  data: {
    content: string;
  };
};

type ProtonPassItemExtraFieldTimestamp = {
  fieldName: string;
  type: "timestamp";
  data: {
    timestamp: string;
  };
};

type ProtonPassItemExtraFieldTotp = {
  fieldName: string;
  type: "totp";
  data: {
    totpUri: string;
  };
};

export type ProtonPassLoginItemContent = {
  itemEmail?: string;
  password?: string;
  urls?: string[];
  totpUri?: string;
  passkeys: [];
  itemUsername?: string;
};

export type ProtonPassCreditCardItemContent = {
  cardholderName?: string;
  cardType?: number;
  number?: string;
  verificationNumber?: string;
  expirationDate?: string;
  pin?: string;
};

export type ProtonPassItemDataSection = {
  sectionName?: string;
  sectionFields?: ProtonPassItemExtraField[];
};

export type ProtonPassCustomItemContent = {
  sections?: ProtonPassItemDataSection[];
};

export type ProtonPassSshKeyItemContent = {
  privateKey?: string;
  publicKey?: string;
  fingerprint?: string;
  sections?: ProtonPassItemDataSection[];
};

export type ProtonPassWifiItemContent = {
  ssid?: string;
  password?: string;
  security?: ProtonPassWifiSecurityType;
  sections?: ProtonPassItemDataSection[];
};

export const ProtonPassWifiSecurityType = Object.freeze({
  UNSPECIFIED: 0,
  WPA: 1,
  WPA2: 2,
  WPA3: 3,
  WEP: 4,
} as const);
export type ProtonPassWifiSecurityType =
  (typeof ProtonPassWifiSecurityType)[keyof typeof ProtonPassWifiSecurityType];

export type ProtonPassIdentityItemContent = {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  birthdate?: string;
  gender?: string;
  extraPersonalDetails?: ProtonPassItemExtraField[];
  organization?: string;
  streetAddress?: string;
  zipOrPostalCode?: string;
  city?: string;
  stateOrProvince?: string;
  countryOrRegion?: string;
  floor?: string;
  county?: string;
  extraAddressDetails?: ProtonPassItemExtraField[];
  socialSecurityNumber?: string;
  passportNumber?: string;
  licenseNumber?: string;
  website?: string;
  xHandle?: string;
  secondPhoneNumber?: string;
  linkedin?: string;
  reddit?: string;
  facebook?: string;
  yahoo?: string;
  instagram?: string;
  extraContactDetails?: ProtonPassItemExtraField[];
  company?: string;
  jobTitle?: string;
  personalWebsite?: string;
  workPhoneNumber?: string;
  workEmail?: string;
  extraWorkDetails?: ProtonPassItemExtraField[];
  extraSections?: ProtonPassItemDataSection[];
};
