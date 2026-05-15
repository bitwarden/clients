const _FieldRole = Object.freeze({
  Username: "username",
  CurrentPassword: "currentPassword",
  UpdateCurrentPassword: "updateCurrentPassword",
  NewPassword: "newPassword",
  Email: "email",
  Totp: "totp",
  CardholderName: "cardholderName",
  CardNumber: "cardNumber",
  CardExpirationDate: "cardExpirationDate",
  CardExpirationMonth: "cardExpirationMonth",
  CardExpirationYear: "cardExpirationYear",
  CardCvv: "cardCvv",
  IdentityTitle: "identityTitle",
  IdentityFirstName: "identityFirstName",
  IdentityMiddleName: "identityMiddleName",
  IdentityLastName: "identityLastName",
  IdentityFullName: "identityFullName",
  IdentityAddress1: "identityAddress1",
  IdentityAddress2: "identityAddress2",
  IdentityAddress3: "identityAddress3",
  IdentityCity: "identityCity",
  IdentityState: "identityState",
  IdentityPostalCode: "identityPostalCode",
  IdentityCountry: "identityCountry",
  IdentityCompany: "identityCompany",
  IdentityPhone: "identityPhone",
  IdentityEmail: "identityEmail",
  IdentityUsername: "identityUsername",
} as const);

type _FieldRole = typeof _FieldRole;

export type FieldRole = _FieldRole[keyof _FieldRole];

// FIXME: Update typing of `FieldRole` to be `Record<keyof _FieldRole, FieldRole>` which is ADR-0025 compliant when the TypeScript version is at least 5.8.
export const FieldRole: typeof _FieldRole = _FieldRole;
