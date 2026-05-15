import { FieldRole } from "./types";

export type CueSignal =
  | "autocomplete"
  | "type"
  | "inputmode"
  | "idName"
  | "placeholder"
  | "label"
  | "dataset";

export type Cue = {
  readonly signal: CueSignal;
  readonly token: string;
  readonly weight: number;
};

const USERNAME_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "username", weight: 4.0 },
  { signal: "idName", token: "username", weight: 2.5 },
  { signal: "idName", token: "user", weight: 1.5 },
  { signal: "idName", token: "login", weight: 1.0 },
  { signal: "placeholder", token: "username", weight: 2.0 },
  { signal: "label", token: "username", weight: 2.5 },
  { signal: "label", token: "userid", weight: 2.0 },
  { signal: "label", token: "useridoremail", weight: 1.5 },
];

const EMAIL_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "email", weight: 4.0 },
  { signal: "type", token: "email", weight: 3.5 },
  { signal: "inputmode", token: "email", weight: 2.5 },
  { signal: "idName", token: "emailaddress", weight: 3.0 },
  { signal: "idName", token: "email", weight: 2.5 },
  { signal: "idName", token: "mail", weight: 1.5 },
  { signal: "placeholder", token: "emailaddress", weight: 2.5 },
  { signal: "placeholder", token: "email", weight: 2.0 },
  { signal: "label", token: "emailaddress", weight: 2.5 },
  { signal: "label", token: "email", weight: 2.5 },
  { signal: "label", token: "useridoremail", weight: 1.5 },
];

const PASSWORD_CUES: ReadonlyArray<Cue> = [
  { signal: "type", token: "password", weight: 4.0 },
  { signal: "autocomplete", token: "current-password", weight: 6.0 },
  { signal: "idName", token: "password", weight: 2.0 },
  { signal: "idName", token: "currentpassword", weight: 3.0 },
  { signal: "idName", token: "pwd", weight: 1.5 },
  { signal: "idName", token: "passwd", weight: 1.5 },
  { signal: "label", token: "password", weight: 1.5 },
  { signal: "placeholder", token: "password", weight: 1.5 },
];

const NEW_PASSWORD_CUES: ReadonlyArray<Cue> = [
  { signal: "type", token: "password", weight: 4.0 },
  { signal: "autocomplete", token: "new-password", weight: 6.0 },
  { signal: "idName", token: "newpassword", weight: 3.0 },
  { signal: "idName", token: "confirmpassword", weight: 3.0 },
  { signal: "idName", token: "createpassword", weight: 2.5 },
  { signal: "idName", token: "passwordconfirm", weight: 3.0 },
  { signal: "idName", token: "signuppassword", weight: 2.5 },
  { signal: "label", token: "newpassword", weight: 3.0 },
  { signal: "label", token: "confirmpassword", weight: 3.0 },
  { signal: "label", token: "createpassword", weight: 2.5 },
  { signal: "label", token: "createyourpassword", weight: 2.5 },
  { signal: "label", token: "choosepassword", weight: 2.0 },
];

const ONE_TIME_CODE_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "one-time-code", weight: 8.0 },
  { signal: "idName", token: "otp", weight: 3.0 },
  { signal: "idName", token: "verificationcode", weight: 3.5 },
  { signal: "idName", token: "verification", weight: 2.5 },
  { signal: "idName", token: "code", weight: 1.5 },
  { signal: "idName", token: "twofactor", weight: 2.5 },
  { signal: "label", token: "verification", weight: 2.5 },
  { signal: "label", token: "code", weight: 1.5 },
  { signal: "label", token: "onetimecode", weight: 3.5 },
  { signal: "placeholder", token: "code", weight: 1.5 },
];

const CARDHOLDER_NAME_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "cc-name", weight: 6.0 },
  { signal: "autocomplete", token: "ccname", weight: 6.0 },
  { signal: "idName", token: "cardholdername", weight: 4.0 },
  { signal: "idName", token: "ccname", weight: 3.0 },
  { signal: "idName", token: "cardname", weight: 3.0 },
  { signal: "idName", token: "nameoncard", weight: 3.5 },
  { signal: "idName", token: "cardholder", weight: 2.5 },
  { signal: "label", token: "cardholder name", weight: 3.5 },
  { signal: "label", token: "name on card", weight: 3.5 },
  { signal: "label", token: "cardholder", weight: 2.5 },
];

const CARD_NUMBER_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "cc-number", weight: 8.0 },
  { signal: "autocomplete", token: "ccnumber", weight: 8.0 },
  { signal: "idName", token: "cardnumber", weight: 4.0 },
  { signal: "idName", token: "ccnumber", weight: 4.0 },
  { signal: "idName", token: "creditcardnumber", weight: 4.0 },
  { signal: "idName", token: "ccnum", weight: 2.5 },
  { signal: "label", token: "card number", weight: 3.5 },
  { signal: "label", token: "credit card number", weight: 3.5 },
  { signal: "placeholder", token: "card number", weight: 2.5 },
];

const CARD_EXPIRATION_DATE_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "cc-exp", weight: 8.0 },
  { signal: "autocomplete", token: "ccexp", weight: 8.0 },
  { signal: "idName", token: "ccexp", weight: 3.5 },
  { signal: "idName", token: "cardexp", weight: 3.5 },
  { signal: "idName", token: "expirationdate", weight: 4.0 },
  { signal: "idName", token: "expiration", weight: 2.5 },
  { signal: "idName", token: "expiry", weight: 2.5 },
  { signal: "label", token: "expiration date", weight: 3.5 },
  { signal: "label", token: "expiration", weight: 2.5 },
  { signal: "label", token: "expiry date", weight: 3.5 },
  { signal: "label", token: "exp date", weight: 2.5 },
  { signal: "label", token: "valid thru", weight: 2.5 },
  { signal: "placeholder", token: "mm/yy", weight: 3.5 },
  { signal: "placeholder", token: "mm / yy", weight: 3.0 },
];

const CARD_EXPIRATION_MONTH_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "cc-exp-month", weight: 8.0 },
  { signal: "autocomplete", token: "ccexpmonth", weight: 8.0 },
  { signal: "idName", token: "expmonth", weight: 4.0 },
  { signal: "idName", token: "ccexpmonth", weight: 4.0 },
  { signal: "idName", token: "expirationmonth", weight: 4.0 },
  { signal: "label", token: "expiration month", weight: 3.5 },
  { signal: "label", token: "exp month", weight: 3.0 },
  { signal: "placeholder", token: "mm", weight: 2.0 },
];

const CARD_EXPIRATION_YEAR_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "cc-exp-year", weight: 8.0 },
  { signal: "autocomplete", token: "ccexpyear", weight: 8.0 },
  { signal: "idName", token: "expyear", weight: 4.0 },
  { signal: "idName", token: "ccexpyear", weight: 4.0 },
  { signal: "idName", token: "expirationyear", weight: 4.0 },
  { signal: "label", token: "expiration year", weight: 3.5 },
  { signal: "label", token: "exp year", weight: 3.0 },
  { signal: "placeholder", token: "yyyy", weight: 2.5 },
  { signal: "placeholder", token: "yy", weight: 2.0 },
];

const CARD_CVV_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "cc-csc", weight: 8.0 },
  { signal: "autocomplete", token: "cccsc", weight: 8.0 },
  { signal: "idName", token: "cvv", weight: 3.5 },
  { signal: "idName", token: "cvc", weight: 3.5 },
  { signal: "idName", token: "csc", weight: 3.0 },
  { signal: "idName", token: "securitycode", weight: 3.5 },
  { signal: "idName", token: "cardsecuritycode", weight: 3.5 },
  { signal: "idName", token: "cardverification", weight: 3.0 },
  { signal: "label", token: "cvv", weight: 3.0 },
  { signal: "label", token: "cvc", weight: 3.0 },
  { signal: "label", token: "csc", weight: 2.5 },
  { signal: "label", token: "security code", weight: 3.0 },
  { signal: "label", token: "card verification", weight: 3.0 },
  { signal: "placeholder", token: "cvv", weight: 2.5 },
  { signal: "placeholder", token: "cvc", weight: 2.5 },
];

const IDENTITY_TITLE_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "honorific-prefix", weight: 6.0 },
  { signal: "idName", token: "honorificprefix", weight: 4.0 },
  { signal: "idName", token: "salutation", weight: 3.5 },
  { signal: "idName", token: "prefix", weight: 2.0 },
  { signal: "label", token: "title", weight: 2.0 },
  { signal: "label", token: "salutation", weight: 3.0 },
];

const IDENTITY_FIRST_NAME_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "given-name", weight: 6.0 },
  { signal: "idName", token: "firstname", weight: 4.0 },
  { signal: "idName", token: "givenname", weight: 4.0 },
  { signal: "idName", token: "fname", weight: 3.0 },
  { signal: "label", token: "first name", weight: 3.5 },
  { signal: "label", token: "given name", weight: 3.5 },
  { signal: "placeholder", token: "first name", weight: 2.5 },
];

const IDENTITY_MIDDLE_NAME_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "additional-name", weight: 6.0 },
  { signal: "idName", token: "middlename", weight: 4.0 },
  { signal: "idName", token: "mname", weight: 3.0 },
  { signal: "idName", token: "additionalname", weight: 4.0 },
  { signal: "label", token: "middle name", weight: 3.5 },
  { signal: "label", token: "middle initial", weight: 3.0 },
];

const IDENTITY_LAST_NAME_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "family-name", weight: 6.0 },
  { signal: "idName", token: "lastname", weight: 4.0 },
  { signal: "idName", token: "familyname", weight: 4.0 },
  { signal: "idName", token: "surname", weight: 3.5 },
  { signal: "idName", token: "lname", weight: 3.0 },
  { signal: "label", token: "last name", weight: 3.5 },
  { signal: "label", token: "family name", weight: 3.5 },
  { signal: "label", token: "surname", weight: 3.0 },
  { signal: "placeholder", token: "last name", weight: 2.5 },
];

const IDENTITY_FULL_NAME_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "name", weight: 3.5 },
  { signal: "idName", token: "fullname", weight: 4.0 },
  { signal: "label", token: "full name", weight: 3.5 },
  { signal: "label", token: "your name", weight: 2.5 },
];

const IDENTITY_ADDRESS1_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "street-address", weight: 6.0 },
  { signal: "autocomplete", token: "address-line1", weight: 6.0 },
  { signal: "idName", token: "address1", weight: 4.0 },
  { signal: "idName", token: "streetaddress", weight: 4.0 },
  { signal: "idName", token: "addressline1", weight: 4.0 },
  { signal: "label", token: "address line 1", weight: 3.5 },
  { signal: "label", token: "street address", weight: 3.5 },
  { signal: "label", token: "address", weight: 2.5 },
];

const IDENTITY_ADDRESS2_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "address-line2", weight: 6.0 },
  { signal: "idName", token: "address2", weight: 4.0 },
  { signal: "idName", token: "addressline2", weight: 4.0 },
  { signal: "idName", token: "apartment", weight: 3.0 },
  { signal: "idName", token: "suite", weight: 2.5 },
  { signal: "label", token: "address line 2", weight: 3.5 },
  { signal: "label", token: "apartment", weight: 3.0 },
  { signal: "label", token: "suite", weight: 2.5 },
];

const IDENTITY_ADDRESS3_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "address-line3", weight: 6.0 },
  { signal: "idName", token: "address3", weight: 4.0 },
  { signal: "idName", token: "addressline3", weight: 4.0 },
  { signal: "label", token: "address line 3", weight: 3.5 },
];

const IDENTITY_CITY_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "address-level2", weight: 6.0 },
  { signal: "idName", token: "city", weight: 4.0 },
  { signal: "idName", token: "town", weight: 3.0 },
  { signal: "idName", token: "locality", weight: 3.0 },
  { signal: "label", token: "city", weight: 3.5 },
  { signal: "label", token: "town", weight: 3.0 },
];

const IDENTITY_STATE_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "address-level1", weight: 6.0 },
  { signal: "idName", token: "state", weight: 3.5 },
  { signal: "idName", token: "province", weight: 3.5 },
  { signal: "idName", token: "region", weight: 2.5 },
  { signal: "label", token: "state", weight: 3.0 },
  { signal: "label", token: "province", weight: 3.0 },
  { signal: "label", token: "region", weight: 2.5 },
];

const IDENTITY_POSTAL_CODE_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "postal-code", weight: 6.0 },
  { signal: "idName", token: "postalcode", weight: 4.0 },
  { signal: "idName", token: "zipcode", weight: 4.0 },
  { signal: "idName", token: "zip", weight: 3.5 },
  { signal: "label", token: "postal code", weight: 3.5 },
  { signal: "label", token: "zip code", weight: 3.5 },
  { signal: "label", token: "zip", weight: 2.5 },
  { signal: "placeholder", token: "zip", weight: 2.0 },
];

const IDENTITY_COUNTRY_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "country", weight: 6.0 },
  { signal: "autocomplete", token: "country-name", weight: 6.0 },
  { signal: "idName", token: "country", weight: 4.0 },
  { signal: "idName", token: "countryname", weight: 4.0 },
  { signal: "label", token: "country", weight: 3.5 },
];

const IDENTITY_COMPANY_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "organization", weight: 6.0 },
  { signal: "idName", token: "company", weight: 3.5 },
  { signal: "idName", token: "organization", weight: 3.5 },
  { signal: "idName", token: "businessname", weight: 4.0 },
  { signal: "idName", token: "companyname", weight: 4.0 },
  { signal: "label", token: "company", weight: 3.0 },
  { signal: "label", token: "organization", weight: 3.0 },
  { signal: "label", token: "business name", weight: 3.5 },
];

const IDENTITY_PHONE_CUES: ReadonlyArray<Cue> = [
  { signal: "autocomplete", token: "tel", weight: 6.0 },
  { signal: "type", token: "tel", weight: 4.0 },
  { signal: "idName", token: "phone", weight: 4.0 },
  { signal: "idName", token: "telephone", weight: 4.0 },
  { signal: "idName", token: "mobile", weight: 3.0 },
  { signal: "idName", token: "phonenumber", weight: 4.0 },
  { signal: "label", token: "phone", weight: 3.0 },
  { signal: "label", token: "telephone", weight: 3.5 },
  { signal: "label", token: "phone number", weight: 3.5 },
  { signal: "label", token: "mobile", weight: 2.5 },
];

// IdentityEmail is intentionally non-overlapping with the credential `email`
// role. A plain `autocomplete="email"` field scores as FieldRole.Email
// (credential email used as login identifier). IdentityEmail fires when the
// field is explicitly identity-flagged by context (idName/label patterns), so
// consumers reading `isFieldForIdentityEmail` get the role only for fields
// meant for contact/profile email rather than authentication.
const IDENTITY_EMAIL_CUES: ReadonlyArray<Cue> = [
  { signal: "idName", token: "contactemail", weight: 4.0 },
  { signal: "idName", token: "personalemail", weight: 3.5 },
  { signal: "idName", token: "billingemail", weight: 3.5 },
  { signal: "idName", token: "shippingemail", weight: 3.5 },
  { signal: "label", token: "contact email", weight: 3.5 },
  { signal: "label", token: "billing email", weight: 3.5 },
  { signal: "label", token: "shipping email", weight: 3.5 },
];

// IdentityUsername similarly non-overlapping with credential `username`. Fires
// for username fields in profile/identity contexts (handles, screen names).
const IDENTITY_USERNAME_CUES: ReadonlyArray<Cue> = [
  { signal: "idName", token: "screenname", weight: 4.0 },
  { signal: "idName", token: "handle", weight: 3.5 },
  { signal: "idName", token: "displayname", weight: 3.5 },
  { signal: "idName", token: "nickname", weight: 3.0 },
  { signal: "label", token: "screen name", weight: 3.5 },
  { signal: "label", token: "display name", weight: 3.5 },
  { signal: "label", token: "nickname", weight: 3.0 },
];

// Keyed by FieldRole values. UpdateCurrentPassword is intentionally absent —
// the engine never scores it directly; projection derives it from a
// CurrentPassword field's context (parent form is `account-update`, or the
// field carries update-password keywords).
export const CUES_BY_KIND: Readonly<Partial<Record<FieldRole, ReadonlyArray<Cue>>>> = Object.freeze(
  {
    username: USERNAME_CUES,
    email: EMAIL_CUES,
    currentPassword: PASSWORD_CUES,
    newPassword: NEW_PASSWORD_CUES,
    totp: ONE_TIME_CODE_CUES,
    cardholderName: CARDHOLDER_NAME_CUES,
    cardNumber: CARD_NUMBER_CUES,
    cardExpirationDate: CARD_EXPIRATION_DATE_CUES,
    cardExpirationMonth: CARD_EXPIRATION_MONTH_CUES,
    cardExpirationYear: CARD_EXPIRATION_YEAR_CUES,
    cardCvv: CARD_CVV_CUES,
    identityTitle: IDENTITY_TITLE_CUES,
    identityFirstName: IDENTITY_FIRST_NAME_CUES,
    identityMiddleName: IDENTITY_MIDDLE_NAME_CUES,
    identityLastName: IDENTITY_LAST_NAME_CUES,
    identityFullName: IDENTITY_FULL_NAME_CUES,
    identityAddress1: IDENTITY_ADDRESS1_CUES,
    identityAddress2: IDENTITY_ADDRESS2_CUES,
    identityAddress3: IDENTITY_ADDRESS3_CUES,
    identityCity: IDENTITY_CITY_CUES,
    identityState: IDENTITY_STATE_CUES,
    identityPostalCode: IDENTITY_POSTAL_CODE_CUES,
    identityCountry: IDENTITY_COUNTRY_CUES,
    identityCompany: IDENTITY_COMPANY_CUES,
    identityPhone: IDENTITY_PHONE_CUES,
    identityEmail: IDENTITY_EMAIL_CUES,
    identityUsername: IDENTITY_USERNAME_CUES,
  },
);

export const UNKNOWN_BASELINE_LOGIT = 1.0;
