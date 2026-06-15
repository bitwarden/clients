import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";

import { assertFieldsStructure } from "../spec-data/importer-test-utils";
import { BankAccountTestData } from "../spec-data/onepassword-1pif/bankaccount";
import { DriversLicenseTestData } from "../spec-data/onepassword-1pif/driverslicense";
import { PassportTestData } from "../spec-data/onepassword-1pif/passport";
import {
  IdentityTestData,
  TestData,
  WindowsOpVaultTestData,
} from "../spec-data/onepassword-1pif/testdata";

import { OnePassword1PifImporter } from "./onepassword-1pif-importer";

describe("1Password 1Pif Importer", () => {
  const configService = mock<ConfigService>();

  beforeEach(() => {
    // By default disable all feature flags
    configService.getFeatureFlag.mockResolvedValue(false);
  });

  it("should parse data", async () => {
    const importer = new OnePassword1PifImporter(configService);
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.login.username).toEqual("user@test.net");
    expect(cipher.login.password).toEqual("myservicepassword");
    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris[0];
    expect(uriView.uri).toEqual("https://www.google.com");
  });

  it('should create concealed field as "hidden" type', async () => {
    const importer = new OnePassword1PifImporter(configService);
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    const fields = cipher.fields;
    expect(fields.length).toEqual(1);
    const field = fields[0];

    expect(field.name).toEqual("console password");
    expect(field.value).toEqual("console-password-123");
    expect(field.type).toEqual(FieldType.Hidden);
  });

  it("should create identity records", async () => {
    const importer = new OnePassword1PifImporter(configService);
    const result = await importer.parse(IdentityTestData);
    expect(result != null).toBe(true);
    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toEqual("Test Identity");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("Frank");
    expect(identity.middleName).toEqual("MD");
    expect(identity.lastName).toEqual("Fritzenberger");
    expect(identity.company).toEqual("Web Inc.");
    expect(identity.address1).toEqual("Mainstreet 1");
    expect(identity.country).toEqual("DE");
    expect(identity.city).toEqual("Berlin");
    expect(identity.postalCode).toEqual("223344");
    expect(identity.phone).toEqual("+49 001 222 333 44");
    expect(identity.email).toEqual("test@web.de");

    // remaining fields as custom fields
    expect(cipher.fields.length).toEqual(6);
    const fields = cipher.fields;
    expect(fields[0].name).toEqual("sex");
    expect(fields[0].value).toEqual("male");
    expect(fields[1].name).toEqual("birth date");
    expect(fields[1].value).toEqual("Mon, 11 Mar 2019 12:01:00 GMT");
    expect(fields[2].name).toEqual("occupation");
    expect(fields[2].value).toEqual("Engineer");
    expect(fields[3].name).toEqual("department");
    expect(fields[3].value).toEqual("IT");
    expect(fields[4].name).toEqual("job title");
    expect(fields[4].value).toEqual("Developer");
    expect(fields[5].name).toEqual("home");
    expect(fields[5].value).toEqual("+49 333 222 111");
  });

  it("should create password history", async () => {
    const importer = new OnePassword1PifImporter(configService);
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);
    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.passwordHistory.length).toEqual(1);
    const ph = cipher.passwordHistory[0];
    expect(ph.password).toEqual("old-password");
    expect(ph.lastUsedDate.toISOString()).toEqual("2015-11-17T20:17:01.000Z");
  });

  it("should create password history from windows opvault 1pif format", async () => {
    const importer = new OnePassword1PifImporter(configService);
    const result = await importer.parse(WindowsOpVaultTestData);
    expect(result != null).toBe(true);
    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.passwordHistory.length).toEqual(5);
    let ph = cipher.passwordHistory[0];
    expect(ph.password).toEqual("oldpass6");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:41.000Z");
    ph = cipher.passwordHistory[1];
    expect(ph.password).toEqual("oldpass5");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:40.000Z");
    ph = cipher.passwordHistory[2];
    expect(ph.password).toEqual("oldpass4");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:39.000Z");
    ph = cipher.passwordHistory[3];
    expect(ph.password).toEqual("oldpass3");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:38.000Z");
    ph = cipher.passwordHistory[4];
    expect(ph.password).toEqual("oldpass2");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:37.000Z");
  });

  describe("should import bankAccount records", () => {
    it("with new item types feature flag OFF", async () => {
      const importer = new OnePassword1PifImporter(configService);
      const result = await importer.parse(BankAccountTestData);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];

      expect(cipher.name).toEqual("Test Bank Account");
      expect(cipher.type).toEqual(CipherType.SecureNote);
      expect(cipher.login).toBeNull();
      expect(cipher.fields.length).toEqual(10);
      assertFieldsStructure(cipher.fields, [
        ["bank name", "Bank of the Shire"],
        ["owner", "Bilbo Baggins"],
        ["account type", "Checking"],
        ["routing number", "12345"],
        ["account number", "1234567890"],
        ["SWIFT", "123"],
        ["IBAN", "1234"],
        ["Telephone PIN", "1111"],
        ["phone", "1112223333"],
        ["address", "1 Main Street, Bree, Bree-hill, Eriador"],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const importer = new OnePassword1PifImporter(configService);
      const result = await importer.parse(BankAccountTestData);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toEqual(1);
      const bankAccountCipher = result.ciphers[0];
      expect(bankAccountCipher.name).toEqual("Test Bank Account");
      expect(bankAccountCipher.bankAccount.bankName).toEqual("Bank of the Shire");
      expect(bankAccountCipher.bankAccount.nameOnAccount).toEqual("Bilbo Baggins");
      expect(bankAccountCipher.bankAccount.accountType).toEqual("Checking");
      expect(bankAccountCipher.bankAccount.routingNumber).toEqual("12345");
      expect(bankAccountCipher.bankAccount.accountNumber).toEqual("1234567890");
      expect(bankAccountCipher.bankAccount.swiftCode).toEqual("123");
      expect(bankAccountCipher.bankAccount.iban).toEqual("1234");
      expect(bankAccountCipher.bankAccount.pin).toEqual("1111");
      expect(bankAccountCipher.bankAccount.bankContactPhone).toEqual("1112223333");
      expect(bankAccountCipher.fields.length).toEqual(1);
      expect(bankAccountCipher.fields[0].name).toEqual("address");
      expect(bankAccountCipher.fields[0].value).toEqual("1 Main Street, Bree, Bree-hill, Eriador");
    });
  });

  describe("should import passport records", () => {
    it("with new item types feature flag OFF", async () => {
      const importer = new OnePassword1PifImporter(configService);
      const result = await importer.parse(PassportTestData);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];

      expect(cipher.name).toEqual("Test Passport");
      expect(cipher.type).toEqual(CipherType.SecureNote);
      assertFieldsStructure(cipher.fields, [
        ["type", "Shire Passport"],
        ["issuing country", "The Shire"],
        ["number", "1234567890"],
        ["full name", "Bilbo Baggins"],
        ["gender", "Male"],
        ["nationality", "Shire-folk"],
        ["issuing authority", "The Shire"],
        ["date of birth", "Fri, 22 Sep 2890 00:00:00 GMT"],
        ["place of birth", "Bag End, The Shire"],
        ["issued on", "Mon, 19 Jun 2941 00:00:00 GMT"],
        ["expiry date", "Sat, 19 Jun 2951 00:00:00 GMT"],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const importer = new OnePassword1PifImporter(configService);
      const result = await importer.parse(PassportTestData);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];

      expect(cipher.name).toEqual("Test Passport");
      expect(cipher.type).toEqual(CipherType.Passport);
      expect(cipher.passport.passportType).toEqual("Shire Passport");
      expect(cipher.passport.issuingCountry).toEqual("The Shire");
      expect(cipher.passport.passportNumber).toEqual("1234567890");
      expect(cipher.passport.givenName).toEqual("Bilbo");
      expect(cipher.passport.surname).toEqual("Baggins");
      expect(cipher.passport.nationality).toEqual("Shire-folk");
      expect(cipher.passport.issuingAuthority).toEqual("The Shire");
      expect(cipher.passport.dateOfBirth).toEqual("Fri, 22 Sep 2890 00:00:00 GMT");
      expect(cipher.passport.birthPlace).toEqual("Bag End, The Shire");
      expect(cipher.passport.issueDate).toEqual("Mon, 19 Jun 2941 00:00:00 GMT");
      expect(cipher.passport.expirationDate).toEqual("Sat, 19 Jun 2951 00:00:00 GMT");
      assertFieldsStructure(cipher.fields, [["gender", "Male"]]);
    });
  });

  describe("should import drivers license records", () => {
    it("with new item types feature flag OFF", async () => {
      const importer = new OnePassword1PifImporter(configService);
      const result = await importer.parse(DriversLicenseTestData);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];

      expect(cipher.name).toEqual("Test Driver's License");
      expect(cipher.type).toEqual(CipherType.SecureNote);
      assertFieldsStructure(cipher.fields, [
        ["full name", "Bilbo Baggins"],
        ["address", "Bag End, Bagshot Row, Under-Hill, Hobbiton, Westfarthing, The Shire"],
        ["date of birth", "Fri, 22 Sep 2890 00:00:00 GMT"],
        ["gender", "Male"],
        ["height", "4'0\""],
        ["number", "1234567890"],
        ["license class", "D"],
        ["state", "Westfarthing"],
        ["country", "The Shire"],
        ["expiry date", "295106"],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const importer = new OnePassword1PifImporter(configService);
      const result = await importer.parse(DriversLicenseTestData);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];

      expect(cipher.name).toEqual("Test Driver's License");
      expect(cipher.type).toEqual(CipherType.DriversLicense);
      expect(cipher.driversLicense.firstName).toEqual("Bilbo");
      expect(cipher.driversLicense.middleName).toBeUndefined();
      expect(cipher.driversLicense.lastName).toEqual("Baggins");
      expect(cipher.driversLicense.dateOfBirth).toEqual("Fri, 22 Sep 2890 00:00:00 GMT");
      expect(cipher.driversLicense.licenseNumber).toEqual("1234567890");
      expect(cipher.driversLicense.licenseClass).toEqual("D");
      expect(cipher.driversLicense.issuingState).toEqual("Westfarthing");
      expect(cipher.driversLicense.issuingCountry).toEqual("The Shire");
      expect(cipher.driversLicense.expirationDate).toEqual("Wed, 30 Jun 2951 00:00:00 GMT");
      assertFieldsStructure(cipher.fields, [
        ["address", "Bag End, Bagshot Row, Under-Hill, Hobbiton, Westfarthing, The Shire"],
        ["gender", "Male"],
        ["height", "4'0\""],
      ]);
    });
  });
});
