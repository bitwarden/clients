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
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ProtonPassItemState {
  ACTIVE = 1,
  TRASHED = 2,
}

export type ProtonPassItemData = {
  metadata: ProtonPassItemMetadata;
  extraFields: ProtonPassItemExtraField[];
  platformSpecific?: any;
  type: "login" | "alias" | "creditCard" | "note" | "identity";
  content:
    | ProtonPassLoginItemContent
    | ProtonPassCreditCardItemContent
    | ProtonPassIdentityItemContent;
};

export type ProtonPassItemMetadata = {
  name: string;
  note: string;
  itemUuid: string;
};

export type ProtonPassItemExtraField = {
  fieldName: string;
  type: string;
  data: ProtonPassItemExtraFieldData;
};

export type ProtonPassItemExtraFieldData = {
  content?: string;
  totpUri?: string;
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

export type ProtonPassIdentityItemExtraSection = {
  sectionName?: string;
  sectionFields?: ProtonPassItemExtraField[];
};

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
  extraSections?: ProtonPassIdentityItemExtraSection[];
};
