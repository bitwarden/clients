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
