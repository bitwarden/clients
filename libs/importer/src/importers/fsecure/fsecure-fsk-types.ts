export interface FskFile {
  data: Data;
}

export interface Data {
  [key: string]: FskEntry;
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum FskEntryTypesEnum {
  Login = 1,
  CreditCard = 2,
}

/**
 * Represents the different types of FSK entries.
 */
export const FskEntryTypes = Object.freeze({
  Login: 1,
  CreditCard: 2,
});

/**
 * Type representing valid FSK entry type values.
 */
export type FskEntryType = (typeof FskEntryTypes)[keyof typeof FskEntryTypes];

const namesByFskEntryType = new Map<FskEntryType, keyof typeof FskEntryTypes>(
  Object.entries(FskEntryTypes).map(([key, value]) => [value, key as keyof typeof FskEntryTypes]),
);

/**
 * Checks if a value is a valid FskEntryType.
 * @param value - The value to check.
 * @returns True if the value is a valid FskEntryType, false otherwise.
 */
export function isFskEntryType(value: unknown): value is FskEntryType {
  return namesByFskEntryType.has(value as FskEntryType);
}

/**
 * Converts a value to a FskEntryType if it is valid.
 * @param value - The value to convert.
 * @returns The value as a FskEntryType if valid, otherwise undefined.
 */
export function asFskEntryType(value: unknown): FskEntryType | undefined {
  return isFskEntryType(value) ? (value as FskEntryType) : undefined;
}

/**
 * Gets the name of a FskEntryType value.
 * @param value - The FskEntryType value to get the name for.
 * @returns The name of the FskEntryType value, or undefined if not found.
 */
export function nameOfFskEntryType(value: FskEntryType): keyof typeof FskEntryTypes | undefined {
  return namesByFskEntryType.get(value);
}

export interface FskEntry {
  color: string;
  creditCvv: string;
  creditExpiry: string;
  creditNumber: string;
  favorite: number; // UNIX timestamp
  notes: string;
  password: string;
  passwordList: PasswordList[];
  passwordModifiedDate: number; // UNIX timestamp
  rev: string | number;
  service: string;
  style: string;
  type: FskEntryTypesEnum;
  url: string;
  username: string;
  createdDate: number; // UNIX timestamp
  modifiedDate: number; // UNIX timestamp
}

export interface PasswordList {
  changedate: string;
  password: string;
}
