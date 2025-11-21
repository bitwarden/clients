import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { APICredentialsData } from "../spec-data/onepassword-1pux/api-credentials";
import { BankAccountData } from "../spec-data/onepassword-1pux/bank-account";
import { CreditCardData } from "../spec-data/onepassword-1pux/credit-card";
import { DatabaseData } from "../spec-data/onepassword-1pux/database";
import { DriversLicenseData } from "../spec-data/onepassword-1pux/drivers-license";
import { EmailAccountData } from "../spec-data/onepassword-1pux/email-account";
import { EmailFieldData } from "../spec-data/onepassword-1pux/email-field";
import { EmailFieldOnIdentityData } from "../spec-data/onepassword-1pux/email-field-on-identity";
import { EmailFieldOnIdentityPrefilledData } from "../spec-data/onepassword-1pux/email-field-on-identity_prefilled";
import { IdentityData } from "../spec-data/onepassword-1pux/identity-data";
import { LoginData } from "../spec-data/onepassword-1pux/login-data";
import { MedicalRecordData } from "../spec-data/onepassword-1pux/medical-record";
import { MembershipData } from "../spec-data/onepassword-1pux/membership";
import { OnePuxExampleFile } from "../spec-data/onepassword-1pux/onepux_example";
import { OutdoorLicenseData } from "../spec-data/onepassword-1pux/outdoor-license";
import { PassportData } from "../spec-data/onepassword-1pux/passport";
import { PasswordData } from "../spec-data/onepassword-1pux/password";
import { RewardsProgramData } from "../spec-data/onepassword-1pux/rewards-program";
import { SanitizedExport } from "../spec-data/onepassword-1pux/sanitized-export";
import { SecureNoteData } from "../spec-data/onepassword-1pux/secure-note";
import { ServerData } from "../spec-data/onepassword-1pux/server";
import { SoftwareLicenseData } from "../spec-data/onepassword-1pux/software-license";
import { SSNData } from "../spec-data/onepassword-1pux/ssn";
import { WirelessRouterData } from "../spec-data/onepassword-1pux/wireless-router";

import { OnePassword1PuxImporter } from "./onepassword-1pux-importer";

function validateCustomField(fields: FieldView[], fieldName: string, expectedValue: any) {
  expect(fields).toBeDefined();
  const customField = fields.find((f) => f.name === fieldName);
  expect(customField).toBeDefined();

  expect(customField.value).toEqual(expectedValue);
}

function validateDuplicateCustomField(
  fields: FieldView[],
  fieldName: string,
  expectedValues: string[],
) {
  expect(fields).toBeDefined();
  const customFieldValues = fields.filter((f) => f.name === fieldName).map((v) => v.value);

  expect(customFieldValues).toEqual(expectedValues);
}

describe("1Password 1Pux Importer", () => {
  const OnePuxExampleFileJson = JSON.stringify(OnePuxExampleFile);
  const LoginDataJson = JSON.stringify(LoginData);
  const CreditCardDataJson = JSON.stringify(CreditCardData);
  const IdentityDataJson = JSON.stringify(IdentityData);
  const SecureNoteDataJson = JSON.stringify(SecureNoteData);
  const SanitizedExportJson = JSON.stringify(SanitizedExport);

  it("should not import items with state 'archived'", async () => {
    const importer = new OnePassword1PuxImporter();
    const archivedLoginData = LoginData;
    archivedLoginData["accounts"][0]["vaults"][0]["items"][0]["state"] = "archived";
    const archivedDataJson = JSON.stringify(archivedLoginData);
    const result = await importer.parse(archivedDataJson);
    expect(result != null).toBe(true);
    expect(result.ciphers.length).toBe(0);
  });

  it("should parse login data", async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(LoginDataJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("eToro");

    expect(cipher.login.username).toEqual("username123123123@gmail.com");
    expect(cipher.login.password).toEqual("password!");
    expect(cipher.login.uris.length).toEqual(1);
    expect(cipher.login.uri).toEqual("https://www.fakesite.com");
    expect(cipher.login.totp).toEqual("otpseed777");

    // remaining fields as custom fields
    expect(cipher.fields.length).toEqual(3);
    validateCustomField(cipher.fields, "terms", "false");
    validateCustomField(cipher.fields, "policies", "true");
    validateCustomField(cipher.fields, "Create an account", "username123123");
  });

  it("should parse notes", async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(OnePuxExampleFileJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.notes).toEqual("This is a note. *bold*! _italic_!");
  });

  it("should set favourite if favIndex equals 1", async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(OnePuxExampleFileJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.favorite).toBe(true);
  });

  it("should handle custom boolean fields", async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(LoginDataJson);
    expect(result != null).toBe(true);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);

    const cipher = ciphers.shift();
    expect(cipher.fields[0].name).toEqual("terms");
    expect(cipher.fields[0].value).toEqual("false");
    expect(cipher.fields[0].type).toBe(FieldType.Boolean);

    expect(cipher.fields[1].name).toEqual("policies");
    expect(cipher.fields[1].value).toEqual("true");
    expect(cipher.fields[1].type).toBe(FieldType.Boolean);
  });

  it("should add fields of type email as custom fields", async () => {
    const importer = new OnePassword1PuxImporter();
    const EmailFieldDataJson = JSON.stringify(EmailFieldData);
    const result = await importer.parse(EmailFieldDataJson);
    expect(result != null).toBe(true);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);
    const cipher = ciphers.shift();

    expect(cipher.fields[0].name).toEqual("registered email");
    expect(cipher.fields[0].value).toEqual("kriddler@nullvalue.test");
    expect(cipher.fields[0].type).toBe(FieldType.Text);

    expect(cipher.fields[1].name).toEqual("provider");
    expect(cipher.fields[1].value).toEqual("myEmailProvider");
    expect(cipher.fields[1].type).toBe(FieldType.Text);
  });

  it('should create concealed field as "hidden" type', async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(OnePuxExampleFileJson);
    expect(result != null).toBe(true);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);

    const cipher = ciphers.shift();
    const fields = cipher.fields;
    expect(fields.length).toEqual(1);

    const field = fields.shift();
    expect(field.name).toEqual("PIN");
    expect(field.value).toEqual("12345");
    expect(field.type).toEqual(FieldType.Hidden);
  });

  it("should create password history", async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(OnePuxExampleFileJson);
    const cipher = result.ciphers.shift();

    expect(cipher.passwordHistory.length).toEqual(1);
    const ph = cipher.passwordHistory.shift();
    expect(ph.password).toEqual("12345password");
    expect(ph.lastUsedDate.toISOString()).toEqual("2016-03-18T17:32:35.000Z");
  });

  it("should create credit card records", async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(CreditCardDataJson);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("Parent's Credit Card");
    expect(cipher.notes).toEqual("My parents' credit card.");

    const card = cipher.card;
    expect(card.cardholderName).toEqual("Fred Engels");
    expect(card.number).toEqual("6011111111111117");
    expect(card.code).toEqual("1312");
    expect(card.brand).toEqual("Discover");
    expect(card.expMonth).toEqual("12");
    expect(card.expYear).toEqual("2099");

    // remaining fields as custom fields
    expect(cipher.fields.length).toEqual(12);
    validateCustomField(cipher.fields, "", "card");
    validateCustomField(cipher.fields, "cash withdrawal limit", "$500");
    validateCustomField(cipher.fields, "credit limit", "$1312");
    validateCustomField(cipher.fields, "valid from", "200101");
    validateCustomField(cipher.fields, "issuing bank", "Some bank");
    validateCustomField(cipher.fields, "phone (local)", "123456");
    validateCustomField(cipher.fields, "phone (toll free)", "0800123456");
    validateCustomField(cipher.fields, "phone (intl)", "+49123456");
    validateCustomField(cipher.fields, "website", "somebank.com");
    validateCustomField(cipher.fields, "PIN", "1234");
    validateCustomField(cipher.fields, "interest rate", "1%");
    validateCustomField(cipher.fields, "issue number", "123456");
  });

  it("should create identity records", async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(IdentityDataJson);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("George Engels");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("George");
    expect(identity.middleName).toEqual("S");
    expect(identity.lastName).toEqual("Engels");
    expect(identity.company).toEqual("Acme Inc.");
    expect(identity.address1).toEqual("1312 Main St.");
    expect(identity.country).toEqual("US");
    expect(identity.state).toEqual("California");
    expect(identity.city).toEqual("Atlantis");
    expect(identity.postalCode).toEqual("90210");
    expect(identity.phone).toEqual("4565555555");
    expect(identity.email).toEqual("gengels@nullvalue.test");
    expect(identity.username).toEqual("gengels");

    // remaining fields as custom fields
    expect(cipher.fields.length).toEqual(17);
    validateCustomField(cipher.fields, "sex", "male");
    validateCustomField(cipher.fields, "birth date", "Thu, 01 Jan 1981 12:01:00 GMT");
    validateCustomField(cipher.fields, "occupation", "Steel Worker");
    validateCustomField(cipher.fields, "department", "QA");
    validateCustomField(cipher.fields, "job title", "Quality Assurance Manager");
    validateCustomField(cipher.fields, "home", "4575555555");
    validateCustomField(cipher.fields, "cell", "4585555555");
    validateCustomField(cipher.fields, "business", "4595555555");
    validateCustomField(cipher.fields, "reminder question", "Who's a super cool guy?");
    validateCustomField(cipher.fields, "reminder answer", "Me, buddy.");
    validateCustomField(cipher.fields, "website", "cv.gengels.nullvalue.test");
    validateCustomField(cipher.fields, "ICQ", "12345678");
    validateCustomField(cipher.fields, "skype", "skypeisbad1619");
    validateCustomField(cipher.fields, "AOL/AIM", "aollol@lololol.aol.com");
    validateCustomField(cipher.fields, "Yahoo", "sk8rboi13@yah00.com");
    validateCustomField(cipher.fields, "MSN", "msnothankyou@msn&m&m.com");
    validateCustomField(cipher.fields, "forum signature", "super cool guy");
  });

  it("emails fields on identity types should be added to the identity email field", async () => {
    const importer = new OnePassword1PuxImporter();
    const EmailFieldOnIdentityDataJson = JSON.stringify(EmailFieldOnIdentityData);
    const result = await importer.parse(EmailFieldOnIdentityDataJson);
    expect(result != null).toBe(true);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);
    const cipher = ciphers.shift();

    const identity = cipher.identity;
    expect(identity.email).toEqual("gengels@nullvalue.test");

    expect(cipher.fields[0].name).toEqual("provider");
    expect(cipher.fields[0].value).toEqual("myEmailProvider");
    expect(cipher.fields[0].type).toBe(FieldType.Text);
  });

  it("emails fields on identity types should be added to custom fields if identity.email has been filled", async () => {
    const importer = new OnePassword1PuxImporter();
    const EmailFieldOnIdentityPrefilledDataJson = JSON.stringify(EmailFieldOnIdentityPrefilledData);
    const result = await importer.parse(EmailFieldOnIdentityPrefilledDataJson);
    expect(result != null).toBe(true);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);
    const cipher = ciphers.shift();

    const identity = cipher.identity;
    expect(identity.email).toEqual("gengels@nullvalue.test");

    expect(cipher.fields[0].name).toEqual("2nd email");
    expect(cipher.fields[0].value).toEqual("kriddler@nullvalue.test");
    expect(cipher.fields[0].type).toBe(FieldType.Text);

    expect(cipher.fields[1].name).toEqual("provider");
    expect(cipher.fields[1].value).toEqual("myEmailProvider");
    expect(cipher.fields[1].type).toBe(FieldType.Text);
  });

  it("should parse category 005 - Password (Legacy)", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(PasswordData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("SuperSecret Password");
    expect(cipher.notes).toEqual("SuperSecret Password Notes");

    expect(cipher.login.password).toEqual("GBq[AGb]4*Si3tjwuab^");
    expect(cipher.login.uri).toEqual("https://n0t.y0ur.n0rm4l.w3bs1t3");
  });

  it("should parse category 100 - SoftwareLicense", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(SoftwareLicenseData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("Limux Product Key");
    expect(cipher.notes).toEqual("My Software License");

    expect(cipher.fields.length).toEqual(13);
    validateCustomField(cipher.fields, "version", "5.10.1000");
    validateCustomField(cipher.fields, "license key", "265453-13457355-847327");
    validateCustomField(cipher.fields, "licensed to", "Kay Riddler");
    validateCustomField(cipher.fields, "registered email", "kriddler@nullvalue.test");
    validateCustomField(cipher.fields, "company", "Riddles and Jigsaw Puzzles GmbH");
    validateCustomField(
      cipher.fields,
      "download page",
      "https://limuxcompany.nullvalue.test/5.10.1000/isos",
    );
    validateCustomField(cipher.fields, "publisher", "Limux Software and Hardware");
    validateCustomField(cipher.fields, "website", "https://limuxcompany.nullvalue.test/");
    validateCustomField(cipher.fields, "retail price", "$999");
    validateCustomField(cipher.fields, "support email", "support@nullvalue.test");
    validateCustomField(cipher.fields, "purchase date", "Thu, 01 Apr 2021 12:01:00 GMT");
    validateCustomField(cipher.fields, "order number", "594839");
    validateCustomField(cipher.fields, "order total", "$1086.59");
  });

  it("should parse category 101 - BankAccount", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(BankAccountData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();
    expect(cipher.type).toEqual(CipherType.Card);
    expect(cipher.name).toEqual("Bank Account");
    expect(cipher.notes).toEqual("My Bank Account");

    expect(cipher.card.cardholderName).toEqual("Cool Guy");

    expect(cipher.fields.length).toEqual(9);
    validateCustomField(cipher.fields, "bank name", "Super Credit Union");
    validateCustomField(cipher.fields, "type", "checking");
    validateCustomField(cipher.fields, "routing number", "111000999");
    validateCustomField(cipher.fields, "account number", "192837465918273645");
    validateCustomField(cipher.fields, "SWIFT", "123456");
    validateCustomField(cipher.fields, "IBAN", "DE12 123456");
    validateCustomField(cipher.fields, "PIN", "5555");
    validateCustomField(cipher.fields, "phone", "9399399933");
    validateCustomField(cipher.fields, "address", "1 Fifth Avenue");
  });

  it("should parse category 102 - Database", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(DatabaseData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("Database");
    expect(cipher.notes).toEqual("My Database");

    const login = cipher.login;
    expect(login.username).toEqual("cooldbuser");
    expect(login.password).toEqual("^+kTjhLaN7wVPAhGU)*J");

    expect(cipher.fields.length).toEqual(7);
    validateCustomField(cipher.fields, "type", "postgresql");
    validateCustomField(cipher.fields, "server", "my.secret.db.server");
    validateCustomField(cipher.fields, "port", "1337");
    validateCustomField(cipher.fields, "database", "user_database");
    validateCustomField(cipher.fields, "SID", "ASDIUFU-283234");
    validateCustomField(cipher.fields, "alias", "cdbu");
    validateCustomField(cipher.fields, "connection options", "ssh");
  });

  it("should parse category 103 - Drivers license", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(DriversLicenseData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("Michael Scarn");
    expect(cipher.subTitle).toEqual("Michael Scarn");
    expect(cipher.notes).toEqual("My Driver's License");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("Michael");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toEqual("Scarn");
    expect(identity.address1).toEqual("2120 Mifflin Rd.");
    expect(identity.state).toEqual("Pennsylvania");
    expect(identity.country).toEqual("United States");
    expect(identity.licenseNumber).toEqual("12345678901");

    expect(cipher.fields.length).toEqual(6);
    validateCustomField(cipher.fields, "date of birth", "Sun, 01 Jan 1978 12:01:00 GMT");
    validateCustomField(cipher.fields, "sex", "male");
    validateCustomField(cipher.fields, "height", "5'11\"");
    validateCustomField(cipher.fields, "license class", "C");
    validateCustomField(cipher.fields, "conditions / restrictions", "B");
    validateCustomField(cipher.fields, "expiry date", "203012");
  });

  it("should parse category 104 - Outdoor License", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(OutdoorLicenseData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Identity);
    expect(cipher.name).toEqual("Harvest License");
    expect(cipher.subTitle).toEqual("Cash Bandit");
    expect(cipher.notes).toEqual("My Outdoor License");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("Cash");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toEqual("Bandit");
    expect(identity.state).toEqual("Washington");
    expect(identity.country).toEqual("United States of America");

    expect(cipher.fields.length).toEqual(4);
    validateCustomField(cipher.fields, "valid from", "Thu, 01 Apr 2021 12:01:00 GMT");
    validateCustomField(cipher.fields, "expires", "Fri, 01 Apr 2044 12:01:00 GMT");
    validateCustomField(cipher.fields, "approved wildlife", "Bananas,blueberries,corn");
    validateCustomField(cipher.fields, "maximum quota", "100/each");
  });

  it("should parse category 105 - Membership", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(MembershipData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Identity);
    expect(cipher.name).toEqual("Library Card");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("George");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toEqual("Engels");
    expect(identity.company).toEqual("National Public Library");
    expect(identity.phone).toEqual("9995555555");

    expect(cipher.fields.length).toEqual(5);
    validateCustomField(cipher.fields, "website", "https://npl.nullvalue.gov.test");
    validateCustomField(cipher.fields, "member since", "199901");
    validateCustomField(cipher.fields, "expiry date", "203412");
    validateCustomField(cipher.fields, "member ID", "64783862");
    validateCustomField(cipher.fields, "PIN", "19191");
  });

  it("should parse category 106 - Passport", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(PassportData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Identity);
    expect(cipher.name).toEqual("Mr. Globewide");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("David");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toEqual("Global");
    expect(identity.passportNumber).toEqual("76436847");

    expect(cipher.fields.length).toEqual(8);
    validateCustomField(cipher.fields, "type", "US Passport");
    validateCustomField(cipher.fields, "sex", "female");
    validateCustomField(cipher.fields, "nationality", "International");
    validateCustomField(cipher.fields, "issuing authority", "Department of State");
    validateCustomField(cipher.fields, "date of birth", "Fri, 01 Apr 1983 12:01:00 GMT");
    validateCustomField(cipher.fields, "place of birth", "A cave somewhere in Maine");
    validateCustomField(cipher.fields, "issued on", "Wed, 01 Jan 2020 12:01:00 GMT");
    validateCustomField(cipher.fields, "expiry date", "Sat, 01 Jan 2050 12:01:00 GMT");
  });

  it("should parse category 107 - RewardsProgram", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(RewardsProgramData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Identity);
    expect(cipher.name).toEqual("Retail Reward Thing");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("Chef");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toEqual("Coldroom");
    expect(identity.company).toEqual("Super Cool Store Co.");

    expect(cipher.fields.length).toEqual(7);
    validateCustomField(cipher.fields, "member ID", "member-29813569");
    validateCustomField(cipher.fields, "PIN", "99913");
    validateCustomField(cipher.fields, "member ID (additional)", "additional member id");
    validateCustomField(cipher.fields, "member since", "202101");
    validateCustomField(cipher.fields, "customer service phone", "123456");
    validateCustomField(cipher.fields, "phone for reservations", "123456");
    validateCustomField(cipher.fields, "website", "supercoolstore.com");
  });

  it("should parse category 108 - SSN", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(SSNData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("SSN");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("Jack");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toEqual("Judd");
    expect(identity.ssn).toEqual("131-216-1900");
  });

  it("should parse category 109 - WirelessRouter", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(WirelessRouterData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("Wireless Router");
    expect(cipher.notes).toEqual("My Wifi Router Config");

    expect(cipher.fields.length).toEqual(8);
    validateCustomField(cipher.fields, "base station name", "pixel 2Xl");
    validateCustomField(cipher.fields, "base station password", "BqatGTVQ9TCN72tLbjrsHqkb");
    validateCustomField(cipher.fields, "server / ip address", "127.0.0.1");
    validateCustomField(cipher.fields, "airport id", "some airportId");
    validateCustomField(cipher.fields, "network name", "some network name");
    validateCustomField(cipher.fields, "wireless security", "WPA");
    validateCustomField(cipher.fields, "wireless network password", "wifipassword");
    validateCustomField(cipher.fields, "attached storage password", "diskpassword");
  });

  it("should parse category 110 - Server", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(ServerData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("Super Cool Server");
    expect(cipher.notes).toEqual("My Server");

    expect(cipher.login.username).toEqual("frankly-notsure");
    expect(cipher.login.password).toEqual("*&YHJI87yjy78u");
    expect(cipher.login.uri).toEqual("https://coolserver.nullvalue.test");

    expect(cipher.fields.length).toEqual(7);
    validateCustomField(
      cipher.fields,
      "admin console URL",
      "https://coolserver.nullvalue.test/admin",
    );
    validateCustomField(cipher.fields, "admin console username", "frankly-idontknowwhatimdoing");
    validateCustomField(cipher.fields, "console password", "^%RY&^YUiju8iUYHJI(U");
    validateCustomField(cipher.fields, "name", "Private Hosting Provider Inc.");
    validateCustomField(cipher.fields, "website", "https://phpi.nullvalue.test");
    validateCustomField(cipher.fields, "support URL", "https://phpi.nullvalue.test/support");
    validateCustomField(cipher.fields, "support phone", "8882569382");
  });

  it("should parse category 111 - EmailAccount", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(EmailAccountData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("Email Config");
    expect(cipher.notes).toEqual("My Email Config");

    expect(cipher.fields.length).toEqual(17);
    validateDuplicateCustomField(cipher.fields, "port number", ["587", "589"]);
    validateDuplicateCustomField(cipher.fields, "auth method", ["kerberos_v5", "password"]);
    validateDuplicateCustomField(cipher.fields, "username", [
      "someuser@nullvalue.test",
      "someuser@nullvalue.test",
    ]);
    validateDuplicateCustomField(cipher.fields, "password", [
      "u1jsf<UI*&YU&^T",
      "(*1674%^UIUJ*UI(IUI8u98uyy",
    ]);
    validateDuplicateCustomField(cipher.fields, "security", ["TLS", "TLS"]);

    validateCustomField(cipher.fields, "type", "either");
    validateCustomField(cipher.fields, "server", "mailserver.nullvalue.test");
    validateCustomField(cipher.fields, "SMTP server", "mailserver.nullvalue.test");
    validateCustomField(cipher.fields, "provider", "Telum");
    validateCustomField(cipher.fields, "provider's website", "https://telum.nullvalue.test");
    validateCustomField(cipher.fields, "phone (local)", "2346666666");
    validateCustomField(cipher.fields, "phone (toll free)", "18005557777");
  });

  it("should parse category 112 - API Credentials", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(APICredentialsData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("API Credential");
    expect(cipher.notes).toEqual("My API Credential");

    expect(cipher.login.username).toEqual("apiuser@nullvalue.test");
    expect(cipher.login.password).toEqual("apiapiapiapiapiapiappy");
    expect(cipher.login.uri).toEqual("http://not.your.everyday.hostname");

    expect(cipher.fields.length).toEqual(4);
    validateCustomField(cipher.fields, "type", "jwt");
    validateCustomField(cipher.fields, "filename", "filename.jwt");
    validateCustomField(cipher.fields, "valid from", "Mon, 04 Apr 2011 12:01:00 GMT");
    validateCustomField(cipher.fields, "expires", "Tue, 01 Apr 2031 12:01:00 GMT");
  });

  it("should create secure notes", async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(SecureNoteDataJson);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();

    expect(cipher.name).toEqual("Secure Note #1");
    expect(cipher.notes).toEqual(
      "This is my secure note. \n\nLorem ipsum expecto patronum. \nThe quick brown fox jumped over the lazy dog.",
    );
    expect(cipher.secureNote.type).toEqual(SecureNoteType.Generic);
  });

  it("should parse category 113 - Medical Record", async () => {
    const importer = new OnePassword1PuxImporter();
    const jsonString = JSON.stringify(MedicalRecordData);
    const result = await importer.parse(jsonString);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("Some Health Record");
    expect(cipher.notes).toEqual("Some notes about my medical history");
    expect(cipher.secureNote.type).toEqual(SecureNoteType.Generic);

    expect(cipher.fields.length).toEqual(8);
    validateCustomField(cipher.fields, "date", "Sat, 01 Jan 2022 12:01:00 GMT");
    validateCustomField(cipher.fields, "location", "some hospital/clinic");
    validateCustomField(cipher.fields, "healthcare professional", "Some Doctor");
    validateCustomField(cipher.fields, "patient", "Me");
    validateCustomField(cipher.fields, "reason for visit", "unwell");
    validateCustomField(cipher.fields, "medication", "Insuline");
    validateCustomField(cipher.fields, "dosage", "1");
    validateCustomField(cipher.fields, "medication notes", "multiple times a day");
  });

  it("should create folders", async () => {
    const importer = new OnePassword1PuxImporter();
    const result = await importer.parse(SanitizedExportJson);
    expect(result != null).toBe(true);

    const folders = result.folders;
    expect(folders.length).toBe(5);
    expect(folders[0].name).toBe("Movies");
    expect(folders[1].name).toBe("Finance");
    expect(folders[2].name).toBe("Travel");
    expect(folders[3].name).toBe("Education");
    expect(folders[4].name).toBe("Starter Kit");

    // Check that folder/cipher relationships
    expect(result.folderRelationships.filter(([_, f]) => f == 0).length).toBeGreaterThan(0);
    expect(result.folderRelationships.filter(([_, f]) => f == 1).length).toBeGreaterThan(0);
    expect(result.folderRelationships.filter(([_, f]) => f == 2).length).toBeGreaterThan(0);
    expect(result.folderRelationships.filter(([_, f]) => f == 3).length).toBeGreaterThan(0);
    expect(result.folderRelationships.filter(([_, f]) => f == 4).length).toBeGreaterThan(0);
  });

  it("should create collections if part of an organization", async () => {
    const importer = new OnePassword1PuxImporter();
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await importer.parse(SanitizedExportJson);
    expect(result != null).toBe(true);

    const collections = result.collections;
    expect(collections.length).toBe(5);
    expect(collections[0].name).toBe("Movies");
    expect(collections[1].name).toBe("Finance");
    expect(collections[2].name).toBe("Travel");
    expect(collections[3].name).toBe("Education");
    expect(collections[4].name).toBe("Starter Kit");
  });
});
