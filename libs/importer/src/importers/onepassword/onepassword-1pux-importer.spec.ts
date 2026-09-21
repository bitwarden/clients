import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  FieldType,
  SecureNoteType,
  CipherType,
  BankAccountType,
} from "@bitwarden/common/vault/enums";
import * as sdkInternal from "@bitwarden/sdk-internal";

import { ImportRecordErrorReason } from "../../models";
import { assertCustomFieldsStructure } from "../spec-data/importer-test-utils";
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
import { SSH_KeyData } from "../spec-data/onepassword-1pux/ssh-key";
import { SSNData } from "../spec-data/onepassword-1pux/ssn";
import { WirelessRouterData } from "../spec-data/onepassword-1pux/wireless-router";

import { OnePassword1PuxImporter } from "./onepassword-1pux-importer";

jest.mock("@bitwarden/sdk-internal");

async function expectSuccessfulParse(importer: OnePassword1PuxImporter, data: string) {
  const result = await importer.parse(data);
  expect(result).not.toBeNull();
  expect(result).not.toBeUndefined();
  return result;
}

describe("1Password 1Pux Importer", () => {
  beforeEach(() => {
    // The whole SDK module is auto-mocked, so give the SshKeyImportError type guard a realistic
    // implementation that mirrors the SDK's (an Error named "SshKeyImportError").
    jest
      .spyOn(sdkInternal, "isSshKeyImportError")
      .mockImplementation((e) => e instanceof Error && e.name === "SshKeyImportError");
  });

  const OnePuxExampleFileJson = JSON.stringify(OnePuxExampleFile);
  const LoginDataJson = JSON.stringify(LoginData);
  const CreditCardDataJson = JSON.stringify(CreditCardData);
  const IdentityDataJson = JSON.stringify(IdentityData);
  const SecureNoteDataJson = JSON.stringify(SecureNoteData);
  const SanitizedExportJson = JSON.stringify(SanitizedExport);
  const configService = mock<ConfigService>();

  // Fixes #20694: items tagged "state: archived" in 1pux exports were being
  // silently dropped, contradicting the help-center docs that state every 1pux
  // entry is imported. They now land in Bitwarden with the archive flag set.
  it("should import items with state 'archived' as archived ciphers", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    // Deep clone to avoid mutating the shared LoginData fixture across tests.
    const archivedLoginData = JSON.parse(JSON.stringify(LoginData));
    archivedLoginData["accounts"][0]["vaults"][0]["items"][0]["state"] = "archived";
    const archivedDataJson = JSON.stringify(archivedLoginData);

    const result = await importer.parse(archivedDataJson);

    expect(result != null).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expect(cipher.archivedDate).toBeDefined();
    expect(cipher.archivedDate).toBeInstanceOf(Date);
    expect(cipher.isArchived).toBe(true);
  });

  it("should leave active items unarchived (regression guard)", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    // Sanity check: the default LoginData fixture has state=active and must
    // still import without an archive flag after the #20694 fix.
    const result = await importer.parse(LoginDataJson);

    expect(result != null).toBe(true);
    expect(result.ciphers.length).toBeGreaterThan(0);
    expect(result.ciphers[0].archivedDate).toBeUndefined();
    expect(result.ciphers[0].isArchived).toBe(false);
  });

  it("should parse login data", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, LoginDataJson);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("eToro");

    expect(cipher.login.username).toEqual("username123123123@gmail.com");
    expect(cipher.login.password).toEqual("password!");
    expect(cipher.login.uris.length).toEqual(1);
    expect(cipher.login.uri).toEqual("https://www.fakesite.com");
    expect(cipher.login.totp).toEqual("otpseed777");

    // remaining fields as custom fields
    assertCustomFieldsStructure(cipher.fields, [
      ["terms", "false"],
      ["policies", "true"],
      ["Create an account", "username123123"],
    ]);
  });

  it("should parse notes", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, OnePuxExampleFileJson);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.notes).toEqual("This is a note. *bold*! _italic_!");
  });

  it("should set favourite if favIndex equals 1", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, OnePuxExampleFileJson);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.favorite).toBe(true);
  });

  it("should handle custom boolean fields", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, LoginDataJson);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);

    const cipher = ciphers[0];
    expect(cipher.fields[0].name).toEqual("terms");
    expect(cipher.fields[0].value).toEqual("false");
    expect(cipher.fields[0].type).toBe(FieldType.Boolean);

    expect(cipher.fields[1].name).toEqual("policies");
    expect(cipher.fields[1].value).toEqual("true");
    expect(cipher.fields[1].type).toBe(FieldType.Boolean);
  });

  it("should add fields of type email as custom fields", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const EmailFieldDataJson = JSON.stringify(EmailFieldData);
    const result = await expectSuccessfulParse(importer, EmailFieldDataJson);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);
    const cipher = ciphers[0];

    expect(cipher.fields[0].name).toEqual("registered email");
    expect(cipher.fields[0].value).toEqual("kriddler@nullvalue.test");
    expect(cipher.fields[0].type).toBe(FieldType.Text);

    expect(cipher.fields[1].name).toEqual("provider");
    expect(cipher.fields[1].value).toEqual("myEmailProvider");
    expect(cipher.fields[1].type).toBe(FieldType.Text);
  });

  it('should create concealed field as "hidden" type', async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, OnePuxExampleFileJson);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);

    const cipher = ciphers[0];
    const fields = cipher.fields;
    expect(fields.length).toEqual(1);

    const field = fields[0];
    expect(field.name).toEqual("PIN");
    expect(field.value).toEqual("12345");
    expect(field.type).toEqual(FieldType.Hidden);
  });

  it("should create password history", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, OnePuxExampleFileJson);
    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.passwordHistory.length).toEqual(1);
    const ph = cipher.passwordHistory[0];
    expect(ph.password).toEqual("12345password");
    expect(ph.lastUsedDate.toISOString()).toEqual("2016-03-18T17:32:35.000Z");
  });

  it("should create credit card records", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, CreditCardDataJson);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
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
    assertCustomFieldsStructure(cipher.fields, [
      ["valid from", "200101"],
      ["", "card"],
      // Section "Contact Information"
      ["issuing bank", "Some bank"],
      ["phone (local)", "123456"],
      ["phone (toll free)", "0800123456"],
      ["phone (intl)", "+49123456"],
      ["website", "somebank.com"],
      // Section "Additional Details"
      ["PIN", "1234"],
      ["credit limit", "$1312"],
      ["cash withdrawal limit", "$500"],
      ["interest rate", "1%"],
      ["issue number", "123456"],
    ]);
  });

  it("should create identity records", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, IdentityDataJson);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
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
    assertCustomFieldsStructure(cipher.fields, [
      ["sex", "male"],
      ["birth date", "Thu, 01 Jan 1981 12:01:00 GMT"],
      ["occupation", "Steel Worker"],
      ["department", "QA"],
      ["job title", "Quality Assurance Manager"],
      ["home", "4575555555"],
      ["cell", "4585555555"],
      ["business", "4595555555"],
      ["reminder question", "Who's a super cool guy?"],
      ["reminder answer", "Me, buddy."],
      ["website", "cv.gengels.nullvalue.test"],
      ["ICQ", "12345678"],
      ["skype", "skypeisbad1619"],
      ["AOL/AIM", "aollol@lololol.aol.com"],
      ["Yahoo", "sk8rboi13@yah00.com"],
      ["MSN", "msnothankyou@msn&m&m.com"],
      ["forum signature", "super cool guy"],
    ]);
  });

  it("emails fields on identity types should be added to the identity email field", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const EmailFieldOnIdentityDataJson = JSON.stringify(EmailFieldOnIdentityData);
    const result = await expectSuccessfulParse(importer, EmailFieldOnIdentityDataJson);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);
    const cipher = ciphers[0];

    const identity = cipher.identity;
    expect(identity.email).toEqual("gengels@nullvalue.test");

    expect(cipher.fields[0].name).toEqual("provider");
    expect(cipher.fields[0].value).toEqual("myEmailProvider");
    expect(cipher.fields[0].type).toBe(FieldType.Text);
  });

  it("emails fields on identity types should be added to custom fields if identity.email has been filled", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const EmailFieldOnIdentityPrefilledDataJson = JSON.stringify(EmailFieldOnIdentityPrefilledData);
    const result = await expectSuccessfulParse(importer, EmailFieldOnIdentityPrefilledDataJson);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);
    const cipher = ciphers[0];

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
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(PasswordData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("SuperSecret Password");
    expect(cipher.notes).toEqual("SuperSecret Password Notes");

    expect(cipher.login.password).toEqual("GBq[AGb]4*Si3tjwuab^");
    expect(cipher.login.uri).toEqual("https://n0t.y0ur.n0rm4l.w3bs1t3");
  });

  it("should parse category 100 - SoftwareLicense", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(SoftwareLicenseData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("Limux Product Key");
    expect(cipher.notes).toEqual("My Software License");

    assertCustomFieldsStructure(cipher.fields, [
      ["version", "5.10.1000"],
      ["license key", "265453-13457355-847327"],
      ["licensed to", "Kay Riddler"],
      ["registered email", "kriddler@nullvalue.test"],
      ["company", "Riddles and Jigsaw Puzzles GmbH"],
      ["download page", "https://limuxcompany.nullvalue.test/5.10.1000/isos"],
      ["publisher", "Limux Software and Hardware"],
      ["website", "https://limuxcompany.nullvalue.test/"],
      ["retail price", "$999"],
      ["support email", "support@nullvalue.test"],
      ["purchase date", "Thu, 01 Apr 2021 12:01:00 GMT"],
      ["order number", "594839"],
      ["order total", "$1086.59"],
    ]);
  });

  describe("should parse category 101 - BankAccount", () => {
    it("with new item types feature flag OFF", async () => {
      const importer = new OnePassword1PuxImporter(configService);
      const jsonString = JSON.stringify(BankAccountData);
      const result = await expectSuccessfulParse(importer, jsonString);

      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];
      expect(cipher.type).toEqual(CipherType.Card);
      expect(cipher.name).toEqual("Bank Account");
      expect(cipher.notes).toEqual("My Bank Account");

      expect(cipher.card.cardholderName).toEqual("Cool Guy");

      assertCustomFieldsStructure(cipher.fields, [
        ["bank name", "Super Credit Union"],
        ["type", "checking"],
        ["routing number", "111000999"],
        ["account number", "192837465918273645"],
        ["SWIFT", "123456"],
        ["IBAN", "DE12 123456"],
        ["PIN", "5555"],
        ["phone", "9399399933"],
        ["address", "1 Fifth Avenue"],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const importer = new OnePassword1PuxImporter(configService);
      const jsonString = JSON.stringify(BankAccountData);
      const result = await expectSuccessfulParse(importer, jsonString);

      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];
      expect(cipher.type).toEqual(CipherType.BankAccount);
      expect(cipher.name).toEqual("Bank Account");
      expect(cipher.notes).toEqual("My Bank Account");

      expect(cipher.bankAccount.nameOnAccount).toEqual("Cool Guy");
      expect(cipher.bankAccount.bankName).toEqual("Super Credit Union");
      expect(cipher.bankAccount.accountType).toEqual(BankAccountType.Checking);
      expect(cipher.bankAccount.routingNumber).toEqual("111000999");
      expect(cipher.bankAccount.accountNumber).toEqual("192837465918273645");
      expect(cipher.bankAccount.swiftCode).toEqual("123456");
      expect(cipher.bankAccount.iban).toEqual("DE12 123456");
      expect(cipher.bankAccount.pin).toEqual("5555");
      expect(cipher.bankAccount.bankContactPhone).toEqual("9399399933");

      assertCustomFieldsStructure(cipher.fields, [["address", "1 Fifth Avenue"]]);
    });
  });

  it("should parse category 102 - Database", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(DatabaseData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("Database");
    expect(cipher.notes).toEqual("My Database");

    const login = cipher.login;
    expect(login.username).toEqual("cooldbuser");
    expect(login.password).toEqual("^+kTjhLaN7wVPAhGU)*J");

    assertCustomFieldsStructure(cipher.fields, [
      ["type", "postgresql"],
      ["server", "my.secret.db.server"],
      ["port", "1337"],
      ["database", "user_database"],
      ["SID", "ASDIUFU-283234"],
      ["alias", "cdbu"],
      ["connection options", "ssh"],
    ]);
  });

  describe("should parse category 103 - Drivers license", () => {
    it("with new item types feature flag OFF", async () => {
      const importer = new OnePassword1PuxImporter(configService);
      const jsonString = JSON.stringify(DriversLicenseData);
      const result = await expectSuccessfulParse(importer, jsonString);

      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];
      expect(cipher.name).toEqual("Michael Scarn");
      expect(cipher.type).toEqual(CipherType.Identity);
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

      assertCustomFieldsStructure(cipher.fields, [
        ["date of birth", "Sun, 01 Jan 1978 12:01:00 GMT"],
        ["sex", "male"],
        ["height", "5'11\""],
        ["license class", "C"],
        ["conditions / restrictions", "B"],
        ["expiry date", "203012"],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const importer = new OnePassword1PuxImporter(configService);
      const jsonString = JSON.stringify(DriversLicenseData);
      const result = await expectSuccessfulParse(importer, jsonString);

      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];
      expect(cipher.name).toEqual("Michael Scarn");
      expect(cipher.type).toEqual(CipherType.DriversLicense);
      expect(cipher.notes).toEqual("My Driver's License");

      const driversLicense = cipher.driversLicense;
      expect(driversLicense.firstName).toEqual("Michael");
      expect(driversLicense.middleName).toBeUndefined();
      expect(driversLicense.lastName).toEqual("Scarn");
      expect(driversLicense.issuingState).toEqual("Pennsylvania");
      expect(driversLicense.issuingCountry).toEqual("United States");
      expect(driversLicense.licenseNumber).toEqual("12345678901");
      expect(driversLicense.dateOfBirth).toEqual("1978-01-01");
      expect(driversLicense.licenseClass).toEqual("C");
      expect(driversLicense.expirationDate).toEqual("2030-12-31");

      assertCustomFieldsStructure(cipher.fields, [
        ["address", "2120 Mifflin Rd."],
        ["sex", "male"],
        ["height", "5'11\""],
        ["conditions / restrictions", "B"],
      ]);
    });
  });

  it("should parse category 104 - Outdoor License", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(OutdoorLicenseData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

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

    assertCustomFieldsStructure(cipher.fields, [
      ["valid from", "Thu, 01 Apr 2021 12:01:00 GMT"],
      ["expires", "Fri, 01 Apr 2044 12:01:00 GMT"],
      ["approved wildlife", "Bananas,blueberries,corn"],
      ["maximum quota", "100/each"],
    ]);
  });

  it("should parse category 105 - Membership", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(MembershipData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Identity);
    expect(cipher.name).toEqual("Library Card");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("George");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toEqual("Engels");
    expect(identity.company).toEqual("National Public Library");
    expect(identity.phone).toEqual("9995555555");

    assertCustomFieldsStructure(cipher.fields, [
      ["website", "https://npl.nullvalue.gov.test"],
      ["member since", "199901"],
      ["expiry date", "203412"],
      ["member ID", "64783862"],
      ["PIN", "19191"],
    ]);
  });

  describe("should parse category 106 - Passport", () => {
    it("with new item types feature flag OFF", async () => {
      const importer = new OnePassword1PuxImporter(configService);
      const jsonString = JSON.stringify(PassportData);
      const result = await expectSuccessfulParse(importer, jsonString);

      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];

      expect(cipher.type).toEqual(CipherType.Identity);
      expect(cipher.name).toEqual("Mr. Globewide");

      const identity = cipher.identity;
      expect(identity.firstName).toEqual("David");
      expect(identity.middleName).toBeUndefined();
      expect(identity.lastName).toEqual("Global");
      expect(identity.passportNumber).toEqual("76436847");

      assertCustomFieldsStructure(cipher.fields, [
        ["type", "US Passport"],
        ["sex", "female"],
        ["nationality", "International"],
        ["issuing authority", "Department of State"],
        ["date of birth", "Fri, 01 Apr 1983 12:01:00 GMT"],
        ["place of birth", "A cave somewhere in Maine"],
        ["issued on", "Wed, 01 Jan 2020 12:01:00 GMT"],
        ["expiry date", "Sat, 01 Jan 2050 12:01:00 GMT"],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const importer = new OnePassword1PuxImporter(configService);
      const jsonString = JSON.stringify(PassportData);
      const result = await expectSuccessfulParse(importer, jsonString);

      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];

      expect(cipher.type).toEqual(CipherType.Passport);
      expect(cipher.name).toEqual("Mr. Globewide");

      const passport = cipher.passport;
      expect(passport.givenName).toEqual("David");
      expect(passport.surname).toEqual("Global");
      expect(passport.issuingCountry).toEqual("United States of America");
      expect(passport.passportNumber).toEqual("76436847");
      expect(passport.passportType).toEqual("US Passport");
      expect(passport.nationality).toEqual("International");
      expect(passport.issuingAuthority).toEqual("Department of State");
      expect(passport.dateOfBirth).toEqual("1983-04-01");
      expect(passport.birthPlace).toEqual("A cave somewhere in Maine");
      expect(passport.issueDate).toEqual("2020-01-01");
      expect(passport.expirationDate).toEqual("2050-01-01");

      assertCustomFieldsStructure(cipher.fields, [["sex", "female"]]);
    });
  });

  it("should parse category 107 - RewardsProgram", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(RewardsProgramData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Identity);
    expect(cipher.name).toEqual("Retail Reward Thing");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("Chef");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toEqual("Coldroom");
    expect(identity.company).toEqual("Super Cool Store Co.");

    assertCustomFieldsStructure(cipher.fields, [
      ["member ID", "member-29813569"],
      ["PIN", "99913"],
      ["member ID (additional)", "additional member id"],
      ["member since", "202101"],
      ["customer service phone", "123456"],
      ["phone for reservations", "123456"],
      ["website", "supercoolstore.com"],
    ]);
  });

  it("should parse category 108 - SSN", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(SSNData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toEqual("SSN");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("Jack");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toEqual("Judd");
    expect(identity.ssn).toEqual("131-216-1900");
  });

  it("should parse category 109 - WirelessRouter", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(WirelessRouterData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("Wireless Router");
    expect(cipher.notes).toEqual("My Wifi Router Config");

    assertCustomFieldsStructure(cipher.fields, [
      ["base station name", "pixel 2Xl"],
      ["base station password", "BqatGTVQ9TCN72tLbjrsHqkb"],
      ["server / ip address", "127.0.0.1"],
      ["airport id", "some airportId"],
      ["network name", "some network name"],
      ["wireless security", "WPA"],
      ["wireless network password", "wifipassword"],
      ["attached storage password", "diskpassword"],
    ]);
  });

  it("should parse category 110 - Server", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(ServerData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("Super Cool Server");
    expect(cipher.notes).toEqual("My Server");

    expect(cipher.login.username).toEqual("frankly-notsure");
    expect(cipher.login.password).toEqual("*&YHJI87yjy78u");
    expect(cipher.login.uri).toEqual("https://coolserver.nullvalue.test");

    assertCustomFieldsStructure(cipher.fields, [
      ["admin console URL", "https://coolserver.nullvalue.test/admin"],
      ["admin console username", "frankly-idontknowwhatimdoing"],
      ["console password", "^%RY&^YUiju8iUYHJI(U"],
      ["name", "Private Hosting Provider Inc."],
      ["website", "https://phpi.nullvalue.test"],
      ["support URL", "https://phpi.nullvalue.test/support"],
      ["support phone", "8882569382"],
    ]);
  });

  it("should parse category 111 - EmailAccount", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(EmailAccountData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("Email Config");
    expect(cipher.notes).toEqual("My Email Config");

    assertCustomFieldsStructure(cipher.fields, [
      ["type", "either"],
      ["username", "someuser@nullvalue.test"],
      ["server", "mailserver.nullvalue.test"],
      ["port number", "587"],
      ["password", "u1jsf<UI*&YU&^T"],
      ["security", "TLS"],
      ["auth method", "kerberos_v5"],
      // Section "SMTP"
      ["SMTP server", "mailserver.nullvalue.test"],
      ["port number", "589"],
      ["username", "someuser@nullvalue.test"],
      ["password", "(*1674%^UIUJ*UI(IUI8u98uyy"],
      ["security", "TLS"],
      ["auth method", "password"],
      // Section "Contact Information"
      ["provider", "Telum"],
      ["provider's website", "https://telum.nullvalue.test"],
      ["phone (local)", "2346666666"],
      ["phone (toll free)", "18005557777"],
    ]);
  });

  it("should parse category 112 - API Credentials", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(APICredentialsData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("API Credential");
    expect(cipher.notes).toEqual("My API Credential");

    expect(cipher.login.username).toEqual("apiuser@nullvalue.test");
    expect(cipher.login.password).toEqual("apiapiapiapiapiapiappy");
    expect(cipher.login.uri).toEqual("http://not.your.everyday.hostname");

    assertCustomFieldsStructure(cipher.fields, [
      ["type", "jwt"],
      ["filename", "filename.jwt"],
      ["valid from", "Mon, 04 Apr 2011 12:01:00 GMT"],
      ["expires", "Tue, 01 Apr 2031 12:01:00 GMT"],
    ]);
  });

  it("should create secure notes", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, SecureNoteDataJson);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.name).toEqual("Secure Note #1");
    expect(cipher.notes).toEqual(
      "This is my secure note. \n\nLorem ipsum expecto patronum. \nThe quick brown fox jumped over the lazy dog.",
    );
    expect(cipher.secureNote.type).toEqual(SecureNoteType.Generic);
  });

  it("should parse category 113 - Medical Record", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(MedicalRecordData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("Some Health Record");
    expect(cipher.notes).toEqual("Some notes about my medical history");
    expect(cipher.secureNote.type).toEqual(SecureNoteType.Generic);

    assertCustomFieldsStructure(cipher.fields, [
      ["date", "Sat, 01 Jan 2022 12:01:00 GMT"],
      ["location", "some hospital/clinic"],
      ["healthcare professional", "Some Doctor"],
      ["patient", "Me"],
      ["reason for visit", "unwell"],
      ["medication", "Insuline"],
      ["dosage", "1"],
      ["medication notes", "multiple times a day"],
    ]);
  });

  it("should parse category 114 - SSH Key", async () => {
    // Mock the SDK import_ssh_key function to return converted OpenSSH format
    const mockConvertedKey = {
      privateKey:
        "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACCWsp3FFVVCMGZ23hscRkDPfGzKZ8z1V/ZB9nzbdDFRswAAAJh8F3bYfBd2\n2AAAAAtzc2gtZWQyNTUxOQAAACCWsp3FFVVCMGZ23hscRkDPfGzKZ8z1V/ZB9nzbdDFRsw\nAAAEA59QYE22f+VFHhiyH1Vfqiwz7xLEt1zCuk8M8Ng5LpKpayncUVVUKwZ3beGxxGQM98\nbMpnzPVX9kH2fNt0MVGzAAAAE3Rlc3RAZXhhbXBsZS5jb20BAgMEBQ==\n-----END OPENSSH PRIVATE KEY-----\n",
      publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJayncUVVUKwZ3beGxxGQM98bMpnzPVX9kH2fNt0MVGz",
      fingerprint: "SHA256:/9qSxXuic8kaVBhwv3c8PuetiEpaOgIp7xHNCbcSuN8",
    } as sdkInternal.SshKeyView;

    jest.spyOn(sdkInternal, "import_ssh_key").mockReturnValue(mockConvertedKey);

    const importer = new OnePassword1PuxImporter(configService);
    const jsonString = JSON.stringify(SSH_KeyData);
    const result = await expectSuccessfulParse(importer, jsonString);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.SshKey);
    expect(cipher.name).toEqual("Some SSH Key");
    expect(cipher.notes).toEqual("SSH Key Note");

    // Verify that import_ssh_key was called with the PKCS#8 key from 1Password
    expect(sdkInternal.import_ssh_key).toHaveBeenCalledWith(
      "-----BEGIN PRIVATE KEY-----\nMFECAQEwBQYDK2VwBCIEIDn1BgTbZ/5UUeGLIfVV+qLBOvEsS3XMK6Twzw2Dkukq\ngSEAlrKdxRVVQrBndt4bHEZAz3xsymfM9Vf2QfZ823QxUbM=\n-----END PRIVATE KEY-----\n",
    );

    // Verify the key was converted to OpenSSH format
    expect(cipher.sshKey.privateKey).toEqual(mockConvertedKey.privateKey);
    expect(cipher.sshKey.publicKey).toEqual(mockConvertedKey.publicKey);
    expect(cipher.sshKey.keyFingerprint).toEqual(mockConvertedKey.fingerprint);
  });

  it("skips an SSH key the SDK cannot parse and reports it, without aborting the import", async () => {
    // The SDK throws a flat SshKeyImportError (e.g. a non-RFC-compliant DER encoding).
    const parseError: Error & { variant?: string } = new Error("Failed to parse key");
    parseError.name = "SshKeyImportError";
    parseError.variant = "Parsing";
    jest.spyOn(sdkInternal, "import_ssh_key").mockImplementation(() => {
      throw parseError;
    });

    const importer = new OnePassword1PuxImporter(configService);
    const result = await importer.parse(JSON.stringify(SSH_KeyData));

    // The import still succeeds instead of throwing.
    expect(result.success).toBe(true);
    // The unparseable SSH key is skipped rather than added as a broken cipher.
    expect(result.ciphers.some((c) => c.type === CipherType.SshKey)).toBe(false);
    // ...and reported as problematic
    expect(result.errors.length).toBe(1);
    // Identified by the item's non-sensitive UID, not its (encrypted) name.
    expect(result.errors[0].id).toEqual("kf7wevmfiqmbgyao42plvgrasy");
    expect(result.errors[0].reason).toEqual(ImportRecordErrorReason.SshKeyParseFailed);
  });

  it("skips ANY item that fails to parse and still imports the rest", async () => {
    // A corrupt item (missing `details`) throws during processing; a normal login must still import.
    const data = {
      accounts: [
        {
          vaults: [
            {
              items: [
                {
                  uuid: "broken-login-uuid",
                  categoryUuid: "001",
                  favIndex: 0,
                  state: "active",
                  overview: { title: "Broken Login" },
                },
                {
                  categoryUuid: "001",
                  favIndex: 0,
                  state: "active",
                  overview: { title: "Good Login" },
                  details: {
                    loginFields: [{ designation: "username", value: "bob" }],
                    passwordHistory: [] as unknown[],
                    sections: [] as unknown[],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const importer = new OnePassword1PuxImporter(configService);
    const result = await importer.parse(JSON.stringify(data));

    expect(result.success).toBe(true);
    // The good item imported; the broken one was skipped and reported with a generic reason.
    expect(result.ciphers.length).toBe(1);
    expect(result.ciphers[0].name).toEqual("Good Login");
    expect(result.errors.length).toBe(1);
    // Reported by UID, not the (sensitive) item title.
    expect(result.errors[0].id).toEqual("broken-login-uuid");
    expect(result.errors[0].reason).toEqual(ImportRecordErrorReason.Error);
  });

  it("does not misattribute a skipped SSH key's folder to another item", async () => {
    const parseError: Error & { variant?: string } = new Error("Failed to parse key");
    parseError.name = "SshKeyImportError";
    parseError.variant = "Parsing";
    jest.spyOn(sdkInternal, "import_ssh_key").mockImplementation(() => {
      throw parseError;
    });

    // A tagged SSH key (which records a folder relationship) that fails to parse, followed by a
    // normal login. The login must NOT inherit the skipped key's "Work" folder.
    const exportData = JSON.parse(JSON.stringify(SSH_KeyData));
    exportData.accounts[0].vaults[0].items[0].overview.tags = ["Work"];
    exportData.accounts[0].vaults[0].items.push({
      uuid: "loginitem",
      favIndex: 0,
      createdAt: 1724868152,
      updatedAt: 1724868152,
      state: "active",
      categoryUuid: "001",
      details: {
        loginFields: [
          { designation: "username", value: "alice", name: "username", fieldType: "T" },
        ],
        notesPlain: "",
        sections: [],
        passwordHistory: [],
      },
      overview: { title: "My Login", url: "" },
    });

    const importer = new OnePassword1PuxImporter(configService);
    const result = await importer.parse(JSON.stringify(exportData));

    // The SSH key is skipped; only the login imports.
    expect(result.ciphers.length).toBe(1);
    expect(result.ciphers[0].name).toEqual("My Login");
    // The skipped key's folder relationship must not remain — otherwise it would point at the login.
    expect(result.folderRelationships).toEqual([]);
  });

  it("should create folders", async () => {
    const importer = new OnePassword1PuxImporter(configService);
    const result = await expectSuccessfulParse(importer, SanitizedExportJson);

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
    const importer = new OnePassword1PuxImporter(configService);
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await expectSuccessfulParse(importer, SanitizedExportJson);

    const collections = result.collections;
    expect(collections.length).toBe(5);
    expect(collections[0].name).toBe("Movies");
    expect(collections[1].name).toBe("Finance");
    expect(collections[2].name).toBe("Travel");
    expect(collections[3].name).toBe("Education");
    expect(collections[4].name).toBe("Starter Kit");
  });
});
