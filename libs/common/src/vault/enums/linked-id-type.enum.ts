import { UnionOfValues } from "../types/union-of-values";

export type LinkedIdType = LoginLinkedId | CardLinkedId | IdentityLinkedId;

// LoginView
export const LoginLinkedId = {
  Username: 100,
  Password: 101,
} as const;

export type LoginLinkedId = UnionOfValues<typeof LoginLinkedId>;

// CardView
export const CardLinkedId = {
  CardholderName: 300,
  ExpMonth: 301,
  ExpYear: 302,
  Code: 303,
  Brand: 304,
  Number: 305,
} as const;

export type CardLinkedId = UnionOfValues<typeof CardLinkedId>;

// IdentityView
export const IdentityLinkedId = {
  Title: 400,
  MiddleName: 401,
  Address1: 402,
  Address2: 403,
  Address3: 404,
  City: 405,
  State: 406,
  PostalCode: 407,
  Country: 408,
  Company: 409,
  Email: 410,
  Phone: 411,
  Ssn: 412,
  Username: 413,
  PassportNumber: 414,
  LicenseNumber: 415,
  FirstName: 416,
  LastName: 417,
  FullName: 418,
} as const;

export type IdentityLinkedId = UnionOfValues<typeof IdentityLinkedId>;
