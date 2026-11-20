// Field-key, action-key, and category enums for webmapper, kept in sync with
// the map-the-web forms map schema (forms.v1.schema.json). Frozen const objects
// rather than TypeScript enums per ADR-0025.

export const FIELD_KEYS = Object.freeze({
  Authentication: ["username", "password", "newPassword", "oneTimeCode"],
  Name: ["fullName", "honorificPrefix", "firstName", "middleName", "lastName", "honorificSuffix"],
  Contact: [
    "email",
    "phone",
    "phoneCountryCode",
    "phoneAreaCode",
    "phoneLocal",
    "phoneExtension",
    "organization",
  ],
  Address: [
    "streetAddress",
    "addressLine1",
    "addressLine2",
    "addressLine3",
    "addressLevel1",
    "addressLevel2",
    "addressLevel3",
    "addressLevel4",
    "postalCode",
    "country",
  ],
  Birthdate: ["birthdate", "birthdateDay", "birthdateMonth", "birthdateYear"],
  "Payment Card": [
    "cardholderName",
    "cardNumber",
    "cardExpirationDate",
    "cardExpirationMonth",
    "cardExpirationYear",
    "cardCvv",
    "cardType",
  ],
  Consent: ["consentTerms", "consentPrivacy", "consentUser"],
  Search: ["searchTerm"],
} as const);

export type FieldGroup = keyof typeof FIELD_KEYS;
export type FieldKey = (typeof FIELD_KEYS)[FieldGroup][number];

export const ACTION_KEYS = Object.freeze([
  "submit",
  "save",
  "next",
  "previous",
  "cancel",
  "reset",
] as const);

export type ActionKey = (typeof ACTION_KEYS)[number];

export const CATEGORIES = Object.freeze([
  "account-creation",
  "account-login",
  "account-recovery",
  "account-update",
  "address",
  "identity",
  "payment-card",
  "search",
  "signup",
] as const);

export type FormCategory = (typeof CATEGORIES)[number];
