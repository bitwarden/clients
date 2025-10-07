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

const namesByProtonPassItemState = new Map<ProtonPassItemState, keyof typeof ProtonPassItemState>(
  Object.entries(ProtonPassItemState).map(([key, value]) => [
    value,
    key as keyof typeof ProtonPassItemState,
  ]),
);

/**
 * Checks if a value is a valid ProtonPassItemState.
 * @param value - The value to check.
 * @returns True if the value is a valid ProtonPassItemState, false otherwise.
 */
export function isProtonPassItemState(value: unknown): value is ProtonPassItemState {
  return namesByProtonPassItemState.has(value as ProtonPassItemState);
}

/**
 * Converts a value to a ProtonPassItemState if it is valid.
 * @param value - The value to convert.
 * @returns The value as a ProtonPassItemState if valid, otherwise undefined.
 */
export function asProtonPassItemState(value: unknown): ProtonPassItemState | undefined {
  return isProtonPassItemState(value) ? (value as ProtonPassItemState) : undefined;
}

/**
 * Gets the name of a ProtonPassItemState value.
 * @param value - The ProtonPassItemState value to get the name for.
 * @returns The name of the ProtonPassItemState value, or undefined if not found.
 */
export function nameOfProtonPassItemState(
  value: ProtonPassItemState,
): keyof typeof ProtonPassItemState | undefined {
  return namesByProtonPassItemState.get(value);
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
