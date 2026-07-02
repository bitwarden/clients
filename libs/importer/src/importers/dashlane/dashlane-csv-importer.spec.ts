import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import { DashlaneCsvImporter } from "..";
import { credentialsData_otpUrl } from "../spec-data/dashlane-csv/credentials-otpurl.csv";
import { credentialsData } from "../spec-data/dashlane-csv/credentials.csv";
import { identityData } from "../spec-data/dashlane-csv/id.csv";
import { multiplePersonalInfoData } from "../spec-data/dashlane-csv/multiple-personal-info.csv";
import { paymentsData } from "../spec-data/dashlane-csv/payments.csv";
import { personalInfoData } from "../spec-data/dashlane-csv/personal-info.csv";
import { secureNoteData } from "../spec-data/dashlane-csv/securenotes.csv";
import { assertFieldsStructure } from "../spec-data/importer-test-utils";

describe("Dashlane CSV Importer", () => {
  let importer: DashlaneCsvImporter;
  const configService = mock<ConfigService>();

  // Assert that an import was successful and return it
  const getImportResult = async (data: string) => {
    const result = await importer.parse(data);
    expect(result).not.toBeNull();
    expect(result).not.toBeUndefined();
    expect(result.success).toEqual(true);
    return result;
  };

  beforeEach(() => {
    configService.getFeatureFlag.mockResolvedValue(false);
    importer = new DashlaneCsvImporter(configService);
  });

  it("should parse login records", async () => {
    const result = await getImportResult(credentialsData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toEqual("example.com");
    expect(cipher.login.username).toEqual("jdoe");
    expect(cipher.login.password).toEqual("somePassword");
    expect(cipher.login.totp).toEqual("someTOTPSeed");
    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris[0];
    expect(uriView.uri).toEqual("https://www.example.com");
    expect(cipher.notes).toEqual("some note for example.com");
  });

  it("should parse login with totp when given otpUrl instead of otpSecret", async () => {
    const result = await getImportResult(credentialsData_otpUrl);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.login.totp).toEqual("anotherTOTPSeed");
  });

  it("should parse an item and create a folder", async () => {
    const result = await getImportResult(credentialsData);

    expect(result.folders.length).toEqual(1);
    expect(result.folders[0].name).toEqual("Entertainment");
    expect(result.folderRelationships.length).toEqual(1);
    expect(result.folderRelationships[0]).toEqual([0, 0]);
  });

  describe("should parse payment records", () => {
    it("with new item types feature flag OFF", async () => {
      const result = await getImportResult(paymentsData);

      expect(result.ciphers.length).toEqual(2);

      // Account
      const cipher = result.ciphers[0];
      expect(cipher.type).toEqual(CipherType.Card);
      expect(cipher.name).toEqual("John's savings account");
      expect(cipher.card.brand).toBeUndefined();
      expect(cipher.card.cardholderName).toEqual("John Doe");
      expect(cipher.card.number).toEqual("accountNumber");
      expect(cipher.card.code).toBeUndefined();
      expect(cipher.card.expMonth).toBeUndefined();
      expect(cipher.card.expYear).toBeUndefined();

      assertFieldsStructure(cipher.fields, [
        ["type", "bank"],
        ["routing_number", "routingNumber"],
        ["country", "US"],
        ["issuing_bank", "US-ALLY"],
      ]);

      // CreditCard
      const cipher2 = result.ciphers[1];
      expect(cipher2.type).toEqual(CipherType.Card);
      expect(cipher2.name).toEqual("John Doe");
      expect(cipher2.card.brand).toEqual("Visa");
      expect(cipher2.card.cardholderName).toEqual("John Doe");
      expect(cipher2.card.number).toEqual("41111111111111111");
      expect(cipher2.card.code).toEqual("123");
      expect(cipher2.card.expMonth).toEqual("1");
      expect(cipher2.card.expYear).toEqual("2023");

      assertFieldsStructure(cipher2.fields, [
        ["type", "credit_card"],
        ["country", "US"],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const result = await getImportResult(paymentsData);

      expect(result.ciphers.length).toEqual(2);

      // Account
      const cipher = result.ciphers[0];
      expect(cipher.type).toEqual(CipherType.BankAccount);
      expect(cipher.name).toEqual("John's savings account");
      expect(cipher.bankAccount.nameOnAccount).toEqual("John Doe");
      expect(cipher.bankAccount.accountNumber).toEqual("accountNumber");

      assertFieldsStructure(cipher.fields, [
        ["routing_number", "routingNumber"],
        ["country", "US"],
        ["issuing_bank", "US-ALLY"],
      ]);

      // CreditCard
      const cipher2 = result.ciphers[1];
      expect(cipher2.type).toEqual(CipherType.Card);
      expect(cipher2.name).toEqual("John Doe");
      expect(cipher2.card.brand).toEqual("Visa");
      expect(cipher2.card.cardholderName).toEqual("John Doe");
      expect(cipher2.card.number).toEqual("41111111111111111");
      expect(cipher2.card.code).toEqual("123");
      expect(cipher2.card.expMonth).toEqual("1");
      expect(cipher2.card.expYear).toEqual("2023");

      assertFieldsStructure(cipher2.fields, [
        ["type", "credit_card"],
        ["country", "US"],
      ]);
    });
  });

  describe("should parse ids records", () => {
    it("with new item types feature flag OFF", async () => {
      const result = await getImportResult(identityData);

      expect(result.ciphers.length).toEqual(5);

      // Type card
      const cipher = result.ciphers[0];
      expect(cipher.type).toEqual(CipherType.Identity);
      expect(cipher.name).toEqual("John Doe card");
      expect(cipher.identity.fullName).toEqual("John Doe");
      expect(cipher.identity.firstName).toEqual("John");
      expect(cipher.identity.middleName).toBeUndefined();
      expect(cipher.identity.lastName).toEqual("Doe");
      expect(cipher.identity.licenseNumber).toEqual("123123123");

      assertFieldsStructure(cipher.fields, [
        ["type", "card"],
        ["issue_date", "2022-1-30"],
        ["expiration_date", "2032-1-30"],
      ]);

      // Type passport
      const cipher2 = result.ciphers[1];
      expect(cipher2.type).toEqual(CipherType.Identity);
      expect(cipher2.name).toEqual("John Doe passport");
      expect(cipher2.identity.fullName).toEqual("John Doe");
      expect(cipher2.identity.firstName).toEqual("John");
      expect(cipher2.identity.middleName).toBeUndefined();
      expect(cipher2.identity.lastName).toEqual("Doe");
      expect(cipher2.identity.passportNumber).toEqual("123123123");

      assertFieldsStructure(cipher2.fields, [
        ["type", "passport"],
        ["issue_date", "2022-1-30"],
        ["expiration_date", "2032-1-30"],
        ["place_of_issue", "somewhere in Germany"],
      ]);

      // Type license
      const cipher3 = result.ciphers[2];
      expect(cipher3.type).toEqual(CipherType.Identity);
      expect(cipher3.name).toEqual("John Doe license");
      expect(cipher3.identity.fullName).toEqual("John Doe");
      expect(cipher3.identity.firstName).toEqual("John");
      expect(cipher3.identity.middleName).toBeUndefined();
      expect(cipher3.identity.lastName).toEqual("Doe");
      expect(cipher3.identity.licenseNumber).toEqual("1234556");
      expect(cipher3.identity.state).toEqual("DC");

      assertFieldsStructure(cipher3.fields, [
        ["type", "license"],
        ["issue_date", "2022-8-10"],
        ["expiration_date", "2022-10-10"],
      ]);

      // Type social_security
      const cipher4 = result.ciphers[3];
      expect(cipher4.type).toEqual(CipherType.Identity);
      expect(cipher4.name).toEqual("John Doe social_security");
      expect(cipher4.identity.fullName).toEqual("John Doe");
      expect(cipher4.identity.firstName).toEqual("John");
      expect(cipher4.identity.middleName).toBeUndefined();
      expect(cipher4.identity.lastName).toEqual("Doe");
      expect(cipher4.identity.ssn).toEqual("123123123");

      assertFieldsStructure(cipher4.fields, [["type", "social_security"]]);

      // Type tax_number
      const cipher5 = result.ciphers[4];
      expect(cipher5.type).toEqual(CipherType.Identity);
      expect(cipher5.name).toEqual("tax_number");
      expect(cipher5.identity.licenseNumber).toEqual("123123123");

      assertFieldsStructure(cipher5.fields, [["type", "tax_number"]]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const result = await getImportResult(identityData);

      expect(result.ciphers.length).toEqual(5);

      // Type card
      const cipher = result.ciphers[0];
      expect(cipher.type).toEqual(CipherType.Identity);
      expect(cipher.name).toEqual("John Doe card");
      expect(cipher.identity.fullName).toEqual("John Doe");
      expect(cipher.identity.firstName).toEqual("John");
      expect(cipher.identity.middleName).toBeUndefined();
      expect(cipher.identity.lastName).toEqual("Doe");
      expect(cipher.identity.licenseNumber).toEqual("123123123");

      assertFieldsStructure(cipher.fields, [
        ["type", "card"],
        ["issue_date", "2022-1-30"],
        ["expiration_date", "2032-1-30"],
      ]);

      // Type passport
      const cipher2 = result.ciphers[1];
      expect(cipher2.type).toEqual(CipherType.Passport);
      expect(cipher2.name).toEqual("John Doe passport");
      expect(cipher2.passport.givenName).toEqual("John");
      expect(cipher2.passport.surname).toEqual("Doe");
      expect(cipher2.passport.passportNumber).toEqual("123123123");
      expect(cipher2.passport.issueDate).toEqual("2022-1-30");
      expect(cipher2.passport.expirationDate).toEqual("2032-1-30");
      expect(cipher2.passport.issuingCountry).toEqual("somewhere in Germany");

      assertFieldsStructure(cipher2.fields, []);

      // Type license
      const cipher3 = result.ciphers[2];
      expect(cipher3.type).toEqual(CipherType.DriversLicense);
      expect(cipher3.name).toEqual("John Doe license");
      expect(cipher3.driversLicense.firstName).toEqual("John");
      expect(cipher3.driversLicense.middleName).toBeUndefined();
      expect(cipher3.driversLicense.lastName).toEqual("Doe");
      expect(cipher3.driversLicense.licenseNumber).toEqual("1234556");
      expect(cipher3.driversLicense.issueDate).toEqual("2022-8-10");
      expect(cipher3.driversLicense.expirationDate).toEqual("2022-10-10");
      expect(cipher3.driversLicense.issuingCountry).toEqual("");
      expect(cipher3.driversLicense.issuingState).toEqual("DC");

      assertFieldsStructure(cipher3.fields, []);

      // Type social_security
      const cipher4 = result.ciphers[3];
      expect(cipher4.type).toEqual(CipherType.Identity);
      expect(cipher4.name).toEqual("John Doe social_security");
      expect(cipher4.identity.fullName).toEqual("John Doe");
      expect(cipher4.identity.firstName).toEqual("John");
      expect(cipher4.identity.middleName).toBeUndefined();
      expect(cipher4.identity.lastName).toEqual("Doe");
      expect(cipher4.identity.ssn).toEqual("123123123");

      assertFieldsStructure(cipher4.fields, [["type", "social_security"]]);

      // Type tax_number
      const cipher5 = result.ciphers[4];
      expect(cipher5.type).toEqual(CipherType.Identity);
      expect(cipher5.name).toEqual("tax_number");
      expect(cipher5.identity.licenseNumber).toEqual("123123123");

      assertFieldsStructure(cipher5.fields, [["type", "tax_number"]]);
    });
  });

  it("should parse secureNote records", async () => {
    const result = await getImportResult(secureNoteData);

    expect(result.ciphers.length).toEqual(1);

    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("01");
    expect(cipher.notes).toEqual("test");
  });

  it("should parse personal information records (multiple identities)", async () => {
    const result = await getImportResult(multiplePersonalInfoData);

    expect(result.ciphers.length).toEqual(6);

    // name
    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("MR John Doe");

    assertFieldsStructure(cipher.fields, [
      ["type", "name"],
      ["title", "MR"],
      ["first_name", "John"],
      ["last_name", "Doe"],
      ["login", "jdoe"],
      ["date_of_birth", "2022-01-30"],
      ["place_of_birth", "world"],
    ]);

    // email
    const cipher2 = result.ciphers[1];
    expect(cipher2.type).toEqual(CipherType.SecureNote);
    expect(cipher2.name).toEqual("Johns email");

    assertFieldsStructure(cipher2.fields, [
      ["type", "email"],
      ["email", "jdoe@example.com"],
      ["email_type", "personal"],
      ["item_name", "Johns email"],
    ]);

    // number
    const cipher3 = result.ciphers[2];
    expect(cipher3.type).toEqual(CipherType.SecureNote);
    expect(cipher3.name).toEqual("John's number");

    assertFieldsStructure(cipher3.fields, [
      ["type", "number"],
      ["item_name", "John's number"],
      ["phone_number", "+49123123123"],
    ]);

    // address
    const cipher4 = result.ciphers[3];
    expect(cipher4.type).toEqual(CipherType.SecureNote);
    expect(cipher4.name).toEqual("John's home address");

    assertFieldsStructure(cipher4.fields, [
      ["type", "address"],
      ["item_name", "John's home address"],
      ["address", "1 some street"],
      ["country", "de"],
      ["state", "DE-0-NW"],
      ["city", "some city"],
      ["zip", "123123"],
      ["address_recipient", "John"],
      ["address_building", "1"],
      ["address_apartment", "1"],
      ["address_floor", "1"],
      ["address_door_code", "123"],
    ]);

    // website
    const cipher5 = result.ciphers[4];
    expect(cipher5.type).toEqual(CipherType.SecureNote);
    expect(cipher5.name).toEqual("Website");

    assertFieldsStructure(cipher5.fields, [
      ["type", "website"],
      ["item_name", "Website"],
      ["url", "website.com"],
    ]);

    // 2nd name/identity
    const cipher6 = result.ciphers[5];
    expect(cipher6.type).toEqual(CipherType.SecureNote);
    expect(cipher6.name).toEqual("Mrs Jane Doe");

    assertFieldsStructure(cipher6.fields, [
      ["type", "name"],
      ["title", "Mrs"],
      ["first_name", "Jane"],
      ["last_name", "Doe"],
      ["login", "jdoe"],
      ["date_of_birth", "2022-01-30"],
      ["place_of_birth", "earth"],
    ]);
  });

  it("should combine personal information records to one identity if only one identity present", async () => {
    const result = await getImportResult(personalInfoData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.Identity);
    expect(cipher.name).toEqual("MR John Doe");
    expect(cipher.identity.fullName).toEqual("MR John Doe");
    expect(cipher.identity.title).toEqual("MR");
    expect(cipher.identity.firstName).toEqual("John");
    expect(cipher.identity.middleName).toBeUndefined();
    expect(cipher.identity.lastName).toEqual("Doe");
    expect(cipher.identity.username).toEqual("jdoe");
    expect(cipher.identity.email).toEqual("jdoe@example.com");
    expect(cipher.identity.phone).toEqual("+49123123123");

    assertFieldsStructure(cipher.fields, [
      ["date_of_birth", "2022-01-30"],
      ["place_of_birth", "world"],
      ["email_type", "personal"],
      ["address_recipient", "John"],
      ["address_building", "1"],
      ["address_apartment", "1"],
      ["address_floor", "1"],
      ["address_door_code", "123"],
      ["url", "website.com"],
    ]);
  });
});
