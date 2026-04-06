export interface FskFile {
  data: Data;
}

export interface Data {
  [key: string]: FskEntry;
}

/**
 * Represents the different types of FSK entries.
 */
export const FskEntryType = Object.freeze({
  Login: 1,
  CreditCard: 2,
});

/**
 * Type representing valid FSK entry type values.
 */
export type FskEntryType = (typeof FskEntryType)[keyof typeof FskEntryType];

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
  type: FskEntryType;
  url: string;
  username: string;
  createdDate: number; // UNIX timestamp
  modifiedDate: number; // UNIX timestamp
}

export interface PasswordList {
  changedate: string;
  password: string;
}
