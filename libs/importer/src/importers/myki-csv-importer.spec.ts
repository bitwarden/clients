import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { MykiCsvImporter } from "./myki-csv-importer";
import { userAccountData } from "./spec-data/myki-csv/user-account.csv";
import { userCreditCardData } from "./spec-data/myki-csv/user-credit-card.csv";
import { userIdCardData } from "./spec-data/myki-csv/user-id-card.csv";
import { userIdentityData } from "./spec-data/myki-csv/user-identity.csv";
import { userNoteData } from "./spec-data/myki-csv/user-note.csv";
import { userTwoFaData } from "./spec-data/myki-csv/user-twofa.csv";

function expectDriversLicense(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Joe User's nickname");
  expect(cipher.notes).toBe("Additional information");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("123456");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Driver's License");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("02/02/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("02/02/2024");
}

function expectPassport(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Passport ID card");
  expect(cipher.notes).toBe("Additional information field");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.passportNumber).toBe("1234567");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Passport");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectSocialSecurity(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Social Security ID card");
  expect(cipher.notes).toBe("Additional information field text");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.ssn).toBe("123455678");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Social Security");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectIdCard(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("ID card type ID card");
  expect(cipher.notes).toBe("Additional Information field text");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("1234566");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("ID Card");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectTaxNumber(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Tax number ID card");
  expect(cipher.notes).toBe("Additional information text field");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("12345678");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Tax Number");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectBankAccount(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Bank account ID card");
  expect(cipher.notes).toBe("Additional text information here");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("12344556677");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Bank Account");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectInsuranceCard(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Insurance card ID card");
  expect(cipher.notes).toBe("Additional information text goes here");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("123456677");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Insurance Card");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2022");
}

function expectHealthCard(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Health card Id card");
  expect(cipher.notes).toBe("More info");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("1234670");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Health Card");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectMembershipCard(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Membership ID card");
  expect(cipher.notes).toBe("Add'l info");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("12345709");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Membership");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectDatabase(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Database ID card");
  expect(cipher.notes).toBe("Addin't info");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("12345089u");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Database");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectOutdoorLicense(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Outdoor license ID card");
  expect(cipher.notes).toBe("Additional info");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("123890090");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Outdoor License");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectRewardProgram(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Reward program Id card");
  expect(cipher.notes).toBe("1234890");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("12345890b");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Reward Program");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectSoftwareLicense(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Software license ID card");
  expect(cipher.notes).toBe(
    "It seems like the fields don't change, which makes it pretty useless that they have so many ID card types.",
  );

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("1234567c");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Software License");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

function expectTourVisa(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);
  expect(cipher.name).toBe("Tour visa ID card");
  expect(cipher.notes).toBe("Additional Information text");

  expect(cipher.identity.fullName).toBe("Joe M User");
  expect(cipher.identity.firstName).toBe("Joe");
  expect(cipher.identity.middleName).toBe("M");
  expect(cipher.identity.lastName).toBe("User");
  expect(cipher.identity.licenseNumber).toBe("123456lkhj");
  expect(cipher.identity.country).toBe("United States");

  expect(cipher.fields.length).toBe(5);

  expect(cipher.fields[0].name).toEqual("status");
  expect(cipher.fields[0].value).toEqual("active");

  expect(cipher.fields[1].name).toEqual("tags");
  expect(cipher.fields[1].value).toEqual("someTag");

  expect(cipher.fields[2].name).toEqual("idType");
  expect(cipher.fields[2].value).toEqual("Tour Visa");

  expect(cipher.fields[3].name).toEqual("idIssuanceDate");
  expect(cipher.fields[3].value).toEqual("03/07/2022");

  expect(cipher.fields[4].name).toEqual("idExpirationDate");
  expect(cipher.fields[4].value).toEqual("03/07/2028");
}

describe("Myki CSV Importer", () => {
  let importer: MykiCsvImporter;
  beforeEach(() => {
    importer = new MykiCsvImporter();
  });

  it("should parse userAccount records", async () => {
    const result = await importer.parse(userAccountData);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();

    expect(cipher.name).toEqual("PasswordNickname");
    expect(cipher.login.username).toEqual("user.name@email.com");
    expect(cipher.login.password).toEqual("abc123");
    expect(cipher.login.totp).toEqual("someTOTPSeed");
    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("http://www.google.com");
    expect(cipher.notes).toEqual("This is the additional information text.");

    expect(cipher.fields.length).toBe(2);

    expect(cipher.fields[0].name).toBe("status");
    expect(cipher.fields[0].value).toBe("active");

    expect(cipher.fields[1].name).toBe("tags");
    expect(cipher.fields[1].value).toBe("someTag");
  });

  it("should parse userTwoFa records", async () => {
    const result = await importer.parse(userTwoFaData);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();

    expect(cipher.name).toEqual("2FA nickname");
    expect(cipher.login.username).toBeNull();
    expect(cipher.login.password).toBeNull();
    expect(cipher.login.totp).toBe("someTOTPSeed");
    expect(cipher.notes).toEqual("Additional information field content.");

    expect(cipher.fields.length).toBe(2);

    expect(cipher.fields[0].name).toBe("status");
    expect(cipher.fields[0].value).toBe("active");

    expect(cipher.fields[1].name).toBe("tags");
    expect(cipher.fields[1].value).toBe("someTag");
  });

  it("should parse creditCard records", async () => {
    const result = await importer.parse(userCreditCardData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.Card);
    expect(cipher.name).toBe("Visa test card");
    expect(cipher.card.brand).toBe("Visa");
    expect(cipher.card.cardholderName).toBe("Joe User");
    expect(cipher.card.number).toBe("4111111111111111");
    expect(cipher.card.code).toBe("222");
    expect(cipher.card.expMonth).toBe("04");
    expect(cipher.card.expYear).toBe("24");

    expect(cipher.notes).toBe("This is the additional information field");

    expect(cipher.fields.length).toBe(2);

    expect(cipher.fields[0].name).toBe("status");
    expect(cipher.fields[0].value).toBe("active");

    expect(cipher.fields[1].name).toBe("tags");
    expect(cipher.fields[1].value).toBe("someTag");
  });

  it("should parse identity records", async () => {
    const result = await importer.parse(userIdentityData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.Identity);
    expect(cipher.name).toBe("Joe User's nickname");
    expect(cipher.identity.fullName).toBe("Mr Joe M User");
    expect(cipher.identity.title).toBe("Mr");
    expect(cipher.identity.firstName).toBe("Joe");
    expect(cipher.identity.middleName).toBe("M");
    expect(cipher.identity.lastName).toBe("User");
    expect(cipher.identity.email).toBe("joe.user@email.com");

    expect(cipher.identity.address1).toBe("1 Example House");
    expect(cipher.identity.address2).toBe("Suite 300");

    expect(cipher.identity.city).toBe("Portland");
    expect(cipher.identity.postalCode).toBe("04101");
    expect(cipher.identity.country).toBe("United States");

    expect(cipher.fields.length).toBe(4);

    expect(cipher.fields[0].name).toEqual("status");
    expect(cipher.fields[0].value).toEqual("active");

    expect(cipher.fields[1].name).toBe("tags");
    expect(cipher.fields[1].value).toBe("someTag");

    expect(cipher.fields[2].name).toEqual("gender");
    expect(cipher.fields[2].value).toEqual("Male");

    expect(cipher.fields[3].name).toEqual("number");
    expect(cipher.fields[3].value).toEqual("2223334444");
  });

  it("should parse secureNote records", async () => {
    const result = await importer.parse(userNoteData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.SecureNote);
    expect(cipher.name).toBe("The title of a secure note");
    expect(cipher.notes).toBe("The content of a secure note. Lorem ipsum, etc.");

    expect(cipher.fields.length).toBe(1);

    expect(cipher.fields[0].name).toBe("status");
    expect(cipher.fields[0].value).toBe("active");
  });

  it("should parse idCard records", async () => {
    const result = await importer.parse(userIdCardData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);

    expect(result.ciphers.length).toBe(14);

    // Driver's license
    const cipher = result.ciphers.shift();
    expectDriversLicense(cipher);

    // Passport
    const cipher2 = result.ciphers.shift();
    expectPassport(cipher2);

    // Social Security
    const cipher3 = result.ciphers.shift();
    expectSocialSecurity(cipher3);

    // Id Card
    const cipher4 = result.ciphers.shift();
    expectIdCard(cipher4);

    // Tax Number
    const cipher5 = result.ciphers.shift();
    expectTaxNumber(cipher5);

    // Bank Account
    const cipher6 = result.ciphers.shift();
    expectBankAccount(cipher6);

    // Insurance card
    const cipher7 = result.ciphers.shift();
    expectInsuranceCard(cipher7);

    // Health card
    const cipher8 = result.ciphers.shift();
    expectHealthCard(cipher8);

    // Membership card
    const cipher9 = result.ciphers.shift();
    expectMembershipCard(cipher9);

    // Database card
    const cipher10 = result.ciphers.shift();
    expectDatabase(cipher10);

    // Outdoor license
    const cipher11 = result.ciphers.shift();
    expectOutdoorLicense(cipher11);

    // Reward program
    const cipher12 = result.ciphers.shift();
    expectRewardProgram(cipher12);

    // Software license
    const cipher13 = result.ciphers.shift();
    expectSoftwareLicense(cipher13);

    // Tour visa
    const cipher14 = result.ciphers.shift();
    expectTourVisa(cipher14);
  });
});
