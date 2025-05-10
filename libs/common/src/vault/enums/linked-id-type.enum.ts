export type LinkedIdType = LoginLinkedId | CardLinkedId | IdentityLinkedId;

// LoginView
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum LoginLinkedId {
  Username = 100,
  Password = 101,
}

// CardView
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum CardLinkedId {
  CardholderName = 300,
  ExpMonth = 301,
  ExpYear = 302,
  Code = 303,
  Brand = 304,
  Number = 305,
}

// IdentityView
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum IdentityLinkedId {
  Title = 400,
  MiddleName = 401,
  Address1 = 402,
  Address2 = 403,
  Address3 = 404,
  City = 405,
  State = 406,
  PostalCode = 407,
  Country = 408,
  Company = 409,
  Email = 410,
  Phone = 411,
  Ssn = 412,
  Username = 413,
  PassportNumber = 414,
  LicenseNumber = 415,
  FirstName = 416,
  LastName = 417,
  FullName = 418,
}
