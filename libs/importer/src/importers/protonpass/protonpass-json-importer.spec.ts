import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FieldType, CipherType, BankAccountType } from "@bitwarden/common/vault/enums";

import { assertCustomFieldsStructure } from "../spec-data/importer-test-utils";
import { testData as dedicatedItemsTestData } from "../spec-data/protonpass-json/protonpass-dedicated-types.json";
import { testData } from "../spec-data/protonpass-json/protonpass.json";

import { ProtonPassJsonImporter } from "./protonpass-json-importer";
import { ProtonPassJsonFile } from "./types/protonpass-json-type";

async function expectParse(
  importer: ProtonPassJsonImporter,
  testData: ProtonPassJsonFile,
  expectedNumberOfCiphers: number,
) {
  const testDataJson = JSON.stringify(testData);
  const result = await importer.parse(testDataJson);
  expect(result != null).toBe(true);
  expect(result.ciphers.length).toEqual(expectedNumberOfCiphers);
  return result;
}

describe("Protonpass Json Importer", () => {
  let importer: ProtonPassJsonImporter;
  const i18nService = mock<I18nService>();
  const configService = mock<ConfigService>();

  beforeEach(() => {
    // By default disable all feature flags
    configService.getFeatureFlag.mockResolvedValue(false);
    importer = new ProtonPassJsonImporter(i18nService, configService);
  });

  it("should parse login data", async () => {
    const result = await expectParse(importer, testData, 8);

    // The first item in the results is a login
    const cipher = result.ciphers[0];
    expect(cipher.name).toEqual("Test Login - Personal Vault");
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.login.username).toEqual("Username");
    expect(cipher.login.password).toEqual("Password");
    expect(cipher.login.uris.length).toEqual(2);
    const uriView = cipher.login.uris[0];
    expect(uriView.uri).toEqual("https://example.com/");
    expect(cipher.notes).toEqual("My login secure note.");

    assertCustomFieldsStructure(cipher.fields, [
      ["email", "Email", FieldType.Text],
      ["non-hidden field", "non-hidden field content", FieldType.Text],
      ["hidden field", "hidden field content", FieldType.Hidden],
      ["second 2fa secret", "TOTPCODE", FieldType.Hidden],
    ]);
  });

  it("should parse note data", async () => {
    const result = await expectParse(importer, testData, 8);

    // The second item in the results is a note
    const noteCipher = result.ciphers[1];
    expect(noteCipher.type).toEqual(CipherType.SecureNote);
    expect(noteCipher.name).toEqual("My Secure Note");
    expect(noteCipher.notes).toEqual("Secure note contents.");

    assertCustomFieldsStructure(noteCipher.fields, [
      ["note text field", "note text value", FieldType.Text],
      ["note hidden field", "note hidden value", FieldType.Hidden],
    ]);
  });

  it("should parse credit card data", async () => {
    const result = await expectParse(importer, testData, 8);

    // The third item in the results is a credit card
    const creditCardCipher = result.ciphers[2];
    expect(creditCardCipher.type).toBe(CipherType.Card);
    expect(creditCardCipher.card.number).toBe("1234222233334444");
    expect(creditCardCipher.card.cardholderName).toBe("Test name");
    expect(creditCardCipher.card.expMonth).toBe("1");
    expect(creditCardCipher.card.expYear).toBe("2025");
    expect(creditCardCipher.card.code).toBe("333");
    assertCustomFieldsStructure(creditCardCipher.fields, [
      ["PIN", "1234", FieldType.Hidden],
      ["card text field", "card text value", FieldType.Text],
      ["card hidden field", "card hidden value", FieldType.Hidden],
    ]);
  });

  it("should create folders if not part of an organization", async () => {
    const result = await expectParse(importer, testData, 8);

    const folders = result.folders;
    expect(folders.length).toBe(2);
    expect(folders[0].name).toBe("Personal");
    expect(folders[1].name).toBe("Test");

    // "My Secure Note" is assigned to folder "Personal"
    expect(result.folderRelationships[1]).toEqual([1, 0]);
    // "Other vault login" is assigned to folder "Test"
    expect(result.folderRelationships[7]).toEqual([7, 1]);
  });

  it("should create collections if part of an organization", async () => {
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await expectParse(importer, testData, 8);

    const collections = result.collections;
    expect(collections.length).toBe(2);
    expect(collections[0].name).toBe("Personal");
    expect(collections[1].name).toBe("Test");

    // "My Secure Note" is assigned to folder "Personal"
    expect(result.collectionRelationships[1]).toEqual([1, 0]);
    // "Other vault login" is assigned to folder "Test"
    expect(result.collectionRelationships[7]).toEqual([7, 1]);
  });

  it("should not add deleted items", async () => {
    const result = await expectParse(importer, testData, 8);

    const ciphers = result.ciphers;
    for (const cipher of ciphers) {
      expect(cipher.name).not.toBe("My Deleted Note");
    }

    expect(ciphers.length).toBe(8);
  });

  it("should set favorites", async () => {
    const result = await expectParse(importer, testData, 8);

    const ciphers = result.ciphers;
    expect(ciphers[0].favorite).toBe(true);
    expect(ciphers[1].favorite).toBe(false);
    expect(ciphers[2].favorite).toBe(true);
  });

  it("should parse alias data as a login", async () => {
    const testDataJson = JSON.stringify(testData);
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers[4];
    expect(cipher.name).toEqual("Alias");
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.login.username).toEqual("alias.removing005@passinbox.com");
  });

  it("should parse custom item data as a secure note", async () => {
    const testDataJson = JSON.stringify(testData);
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers[5];
    expect(cipher.name).toEqual("Custom Item");
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.notes).toEqual("custom item note");

    assertCustomFieldsStructure(cipher.fields, [
      ["Account number", "123456789", FieldType.Text],
      ["PIN", "0000", FieldType.Hidden],
      // Fields nested in content sections are preserved as custom fields
      ["SectionField", "section value", FieldType.Text],
    ]);
  });

  it("should parse ssh key data", async () => {
    const testDataJson = JSON.stringify(testData);
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers[6];
    expect(cipher.name).toEqual("SSH Key Item");
    expect(cipher.type).toEqual(CipherType.SshKey);
    expect(cipher.sshKey.privateKey).toEqual(
      "-----BEGIN PRIVATE KEY-----\nPRIVATEKEYCONTENT\n-----END PRIVATE KEY-----\n",
    );
    expect(cipher.sshKey.publicKey).toEqual("ssh-ed25519 AAAAPUBLICKEY");

    assertCustomFieldsStructure(cipher.fields, [["Host", "example.com"]]);
  });

  describe("should parse identity data", () => {
    it("with new item types feature flag OFF", async () => {
      const result = await expectParse(importer, testData, 8);

      // The fourth item in the results (when the feature flag is off) is an identity
      const cipher = result.ciphers[3];
      expect(cipher.type).toEqual(CipherType.Identity);
      expect(cipher.identity.firstName).toBe("Test");
      expect(cipher.identity.middleName).toBe("1");
      expect(cipher.identity.lastName).toBe("1");
      expect(cipher.identity.email).toBe("test@gmail.com");
      expect(cipher.identity.phone).toBe("7507951789");
      expect(cipher.identity.company).toBe("Bitwarden");
      expect(cipher.identity.ssn).toBe("98378264782");
      expect(cipher.identity.passportNumber).toBe("7173716378612");
      expect(cipher.identity.licenseNumber).toBe("21234");
      expect(cipher.identity.address1).toBe("Bitwarden");
      expect(cipher.identity.address2).toBe("23 Street");
      expect(cipher.identity.address3).toBe("12th Floor Test County");
      expect(cipher.identity.city).toBe("New York");
      expect(cipher.identity.state).toBe("Test");
      expect(cipher.identity.postalCode).toBe("4038456");
      expect(cipher.identity.country).toBe("US");

      assertCustomFieldsStructure(cipher.fields, [
        ["gender", "Male", FieldType.Text],
        ["TestPersonal", "Personal", FieldType.Text],
        ["TestAddress", "Address", FieldType.Text],
        ["xHandle", "@twitter", FieldType.Text],
        ["secondPhoneNumber", "243538978", FieldType.Text],
        ["instagram", "@insta", FieldType.Text],
        ["TestContact", "Contact", FieldType.Hidden],
        ["jobTitle", "Engineer", FieldType.Text],
        ["workPhoneNumber", "78236476238746", FieldType.Text],
        ["TestWork", "Work", FieldType.Hidden],
        ["TestSection", "Section", FieldType.Text],
        ["TestSectionHidden", "SectionHidden", FieldType.Hidden],
        ["TestExtra", "Extra", FieldType.Text],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      // Since the test data has an identity that includes both a driver's
      // license number and a passport number there are two extra ciphers
      const result = await expectParse(importer, testData, 10);

      const identityCipherFolderRels = result.folderRelationships.filter((rel) => rel[0] === 5);
      expect(identityCipherFolderRels.length).toEqual(1);

      // The fourth item in the results is a drivers license
      const driversLicenseCipher = result.ciphers[3];
      expect(driversLicenseCipher.driversLicense.licenseNumber).toEqual("21234");
      // Should be in the same folder as the identity cipher it was made from
      expect(
        result.folderRelationships.some(
          (rel) => rel[0] === 3 && rel[1] === identityCipherFolderRels[0][1],
        ),
      );

      // The fifth item in the results is a passport
      const passportCipher = result.ciphers[4];
      expect(passportCipher.passport.passportNumber).toEqual("7173716378612");
      // Should be in the same folder as the identity cipher it was made from
      expect(
        result.folderRelationships.some(
          (rel) => rel[0] === 4 && rel[1] === identityCipherFolderRels[0][1],
        ),
      );

      // The sixth item in the results is an identity
      const identityCipher = result.ciphers[5];
      expect(identityCipher.type).toEqual(CipherType.Identity);
      expect(identityCipher.identity.firstName).toBe("Test");
      expect(identityCipher.identity.middleName).toBe("1");
      expect(identityCipher.identity.lastName).toBe("1");
      expect(identityCipher.identity.email).toBe("test@gmail.com");
      expect(identityCipher.identity.phone).toBe("7507951789");
      expect(identityCipher.identity.company).toBe("Bitwarden");
      expect(identityCipher.identity.ssn).toBe("98378264782");
      expect(identityCipher.identity.passportNumber).toBeUndefined();
      expect(identityCipher.identity.licenseNumber).toBeUndefined();
      expect(identityCipher.identity.address1).toBe("Bitwarden");
      expect(identityCipher.identity.address2).toBe("23 Street");
      expect(identityCipher.identity.address3).toBe("12th Floor Test County");
      expect(identityCipher.identity.city).toBe("New York");
      expect(identityCipher.identity.state).toBe("Test");
      expect(identityCipher.identity.postalCode).toBe("4038456");
      expect(identityCipher.identity.country).toBe("US");

      assertCustomFieldsStructure(identityCipher.fields, [
        ["gender", "Male", FieldType.Text],
        ["TestPersonal", "Personal", FieldType.Text],
        ["TestAddress", "Address", FieldType.Text],
        ["xHandle", "@twitter", FieldType.Text],
        ["secondPhoneNumber", "243538978", FieldType.Text],
        ["instagram", "@insta", FieldType.Text],
        ["TestContact", "Contact", FieldType.Hidden],
        ["jobTitle", "Engineer", FieldType.Text],
        ["workPhoneNumber", "78236476238746", FieldType.Text],
        ["TestWork", "Work", FieldType.Hidden],
        ["TestSection", "Section", FieldType.Text],
        ["TestSectionHidden", "SectionHidden", FieldType.Hidden],
        ["TestExtra", "Extra", FieldType.Text],
      ]);
    });
  });

  describe("should parse bank account data", () => {
    it("with new item types feature flag OFF", async () => {
      const result = await expectParse(importer, dedicatedItemsTestData, 3);

      // With the feature flag off bank accounts are imported as secure notes
      // with custom fields capturing the rest of the information
      const bankAccountCipher = result.ciphers[0];
      expect(bankAccountCipher.type).toEqual(CipherType.SecureNote);
      assertCustomFieldsStructure(bankAccountCipher.fields, [
        ["Bank Name", "Bank of the Shire", FieldType.Text],
        ["Account Number", "1234567890", FieldType.Text],
        ["Routing Number", "123456", FieldType.Text],
        ["Account Type", "Checking", FieldType.Text],
        ["IBAN", "123456", FieldType.Hidden],
        ["SWIFT/BIC", "1234", FieldType.Text],
        ["Holder Name", "Bilbo Baggins", FieldType.Text],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const result = await expectParse(importer, dedicatedItemsTestData, 3);

      // With the feature flag on bank accounts are imported as their dedicated type
      const bankAccountCipher = result.ciphers[0];
      expect(bankAccountCipher.type).toEqual(CipherType.BankAccount);
      expect(bankAccountCipher.bankAccount.bankName).toEqual("Bank of the Shire");
      expect(bankAccountCipher.bankAccount.accountNumber).toEqual("1234567890");
      expect(bankAccountCipher.bankAccount.routingNumber).toEqual("123456");
      expect(bankAccountCipher.bankAccount.accountType).toEqual(BankAccountType.Checking);
      expect(bankAccountCipher.bankAccount.iban).toEqual("123456");
      expect(bankAccountCipher.bankAccount.swiftCode).toEqual("1234");
      expect(bankAccountCipher.bankAccount.nameOnAccount).toEqual("Bilbo Baggins");
    });
  });

  describe("should parse drivers license data", () => {
    it("with new item types feature flag OFF", async () => {
      const result = await expectParse(importer, dedicatedItemsTestData, 3);

      // With the feature flag off drivers licenses are imported as secure notes
      // with custom fields capturing the rest of the information
      const driversLicenseCipher = result.ciphers[1];
      expect(driversLicenseCipher.type).toEqual(CipherType.SecureNote);
      assertCustomFieldsStructure(driversLicenseCipher.fields, [
        ["Full Name", "Bilbo Baggins", FieldType.Text],
        ["License Number", "123456789", FieldType.Text],
        ["Issuing State/Country", "The Shire", FieldType.Text],
        ["Expiry Date", "2951-06-19", FieldType.Text],
        ["Date of Birth", "2890-09-22", FieldType.Text],
        ["Class", "D", FieldType.Text],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const result = await expectParse(importer, dedicatedItemsTestData, 3);

      // With the feature flag on drivers licenses are imported as their dedicated type
      const driversLicenseCipher = result.ciphers[1];
      expect(driversLicenseCipher.type).toEqual(CipherType.DriversLicense);
      expect(driversLicenseCipher.driversLicense.firstName).toEqual("Bilbo");
      expect(driversLicenseCipher.driversLicense.middleName).toBeUndefined();
      expect(driversLicenseCipher.driversLicense.lastName).toEqual("Baggins");
      expect(driversLicenseCipher.driversLicense.licenseNumber).toEqual("123456789");
      expect(driversLicenseCipher.driversLicense.issuingState).toEqual("The Shire");
      expect(driversLicenseCipher.driversLicense.expirationDate).toEqual("2951-06-19");
      expect(driversLicenseCipher.driversLicense.dateOfBirth).toEqual("2890-09-22");
      expect(driversLicenseCipher.driversLicense.licenseClass).toEqual("D");
    });
  });

  describe("should parse passport data", () => {
    it("with new item types feature flag OFF", async () => {
      const result = await expectParse(importer, dedicatedItemsTestData, 3);

      // With the feature flag off passports are imported as secure notes
      // with custom fields capturing the rest of the information
      const passportCipher = result.ciphers[2];
      expect(passportCipher.type).toEqual(CipherType.SecureNote);
      assertCustomFieldsStructure(passportCipher.fields, [
        ["Full Name", "Bilbo Baggins", FieldType.Text],
        ["Passport Number", "1234567890", FieldType.Hidden],
        ["Country", "The Shire", FieldType.Text],
        ["Expiry Date", "2951-06-19", FieldType.Text],
        ["Date of Birth", "2890-09-22", FieldType.Text],
        ["Issuing Authority", "Hobbiton Consulate", FieldType.Text],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const result = await expectParse(importer, dedicatedItemsTestData, 3);

      // With the feature flag on passports are imported as their dedicated type
      const passportCipher = result.ciphers[2];
      expect(passportCipher.type).toEqual(CipherType.Passport);
      expect(passportCipher.passport.givenName).toEqual("Bilbo");
      expect(passportCipher.passport.surname).toEqual("Baggins");
      expect(passportCipher.passport.passportNumber).toEqual("1234567890");
      expect(passportCipher.passport.issuingCountry).toEqual("The Shire");
      expect(passportCipher.passport.expirationDate).toEqual("2951-06-19");
      expect(passportCipher.passport.dateOfBirth).toEqual("2890-09-22");
      expect(passportCipher.passport.issuingAuthority).toEqual("Hobbiton Consulate");
    });
  });
});
