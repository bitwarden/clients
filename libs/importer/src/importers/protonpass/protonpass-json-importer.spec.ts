import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FieldType, CipherType } from "@bitwarden/common/vault/enums";

import { assertCustomFieldExists } from "../spec-data/importer-test-utils";
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
    const result = await expectParse(importer, testData, 5);

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

    // Custom field test cases of the form [fieldName, fieldValue, fieldType]
    const customFields: [string, string, FieldType | undefined][] = [
      ["email", "Email", FieldType.Text],
      ["second 2fa secret", "TOTPCODE", FieldType.Hidden],
    ];
    customFields.forEach(([name, value, type]) => {
      assertCustomFieldExists(cipher.fields, name, value, type);
    });
  });

  it("should parse note data", async () => {
    const result = await expectParse(importer, testData, 5);

    // The second item in the results is a note
    const noteCipher = result.ciphers[1];
    expect(noteCipher.type).toEqual(CipherType.SecureNote);
    expect(noteCipher.name).toEqual("My Secure Note");
    expect(noteCipher.notes).toEqual("Secure note contents.");
  });

  it("should parse credit card data", async () => {
    const result = await expectParse(importer, testData, 5);

    // The third item in the results is a credit card
    const creditCardCipher = result.ciphers[2];
    expect(creditCardCipher.type).toBe(CipherType.Card);
    expect(creditCardCipher.card.number).toBe("1234222233334444");
    expect(creditCardCipher.card.cardholderName).toBe("Test name");
    expect(creditCardCipher.card.expMonth).toBe("1");
    expect(creditCardCipher.card.expYear).toBe("2025");
    expect(creditCardCipher.card.code).toBe("333");
    assertCustomFieldExists(creditCardCipher.fields, "PIN", "1234", FieldType.Hidden);
  });

  it("should create folders if not part of an organization", async () => {
    const result = await expectParse(importer, testData, 5);

    const folders = result.folders;
    expect(folders.length).toBe(2);
    expect(folders[0].name).toBe("Personal");
    expect(folders[1].name).toBe("Test");

    // "My Secure Note" is assigned to folder "Personal"
    expect(result.folderRelationships[1]).toEqual([1, 0]);
    // "Other vault login" is assigned to folder "Test"
    expect(result.folderRelationships[4]).toEqual([4, 1]);
  });

  it("should create collections if part of an organization", async () => {
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await expectParse(importer, testData, 5);

    const collections = result.collections;
    expect(collections.length).toBe(2);
    expect(collections[0].name).toBe("Personal");
    expect(collections[1].name).toBe("Test");

    // "My Secure Note" is assigned to folder "Personal"
    expect(result.collectionRelationships[1]).toEqual([1, 0]);
    // "Other vault login" is assigned to folder "Test"
    expect(result.collectionRelationships[4]).toEqual([4, 1]);
  });

  it("should not add deleted items", async () => {
    const result = await expectParse(importer, testData, 5);

    const ciphers = result.ciphers;
    for (const cipher of ciphers) {
      expect(cipher.name).not.toBe("My Deleted Note");
    }
  });

  it("should set favorites", async () => {
    const result = await expectParse(importer, testData, 5);

    const ciphers = result.ciphers;
    expect(ciphers[0].favorite).toBe(true);
    expect(ciphers[1].favorite).toBe(false);
    expect(ciphers[2].favorite).toBe(true);
  });

  it("should skip unsupported items", async () => {
    const result = await expectParse(importer, testData, 5);

    const ciphers = result.ciphers;
    expect(ciphers.length).toBe(5);
    expect(ciphers[4].type).toEqual(CipherType.Login);
  });

  describe("should parse identity data", () => {
    it("with new item types feature flag OFF", async () => {
      const result = await expectParse(importer, testData, 5);

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
      expect(cipher.identity.address3).toBe("12th Foor Test County");
      expect(cipher.identity.city).toBe("New York");
      expect(cipher.identity.state).toBe("Test");
      expect(cipher.identity.postalCode).toBe("4038456");
      expect(cipher.identity.country).toBe("US");

      expect(cipher.fields.length).toEqual(13);
      // Custom field test cases of the form [fieldName, fieldValue, fieldType]
      const customFields: [string, string, FieldType | undefined][] = [
        ["gender", "Male", FieldType.Text],
        ["TestPersonal", "Personal", FieldType.Text],
        ["TestAddress", "Address", FieldType.Text],
        ["xHandle", "@twiter", FieldType.Text],
        ["secondPhoneNumber", "243538978", FieldType.Text],
        ["instagram", "@insta", FieldType.Text],
        ["TestContact", "Contact", FieldType.Hidden],
        ["jobTitle", "Engineer", FieldType.Text],
        ["workPhoneNumber", "78236476238746", FieldType.Text],
        ["TestWork", "Work", FieldType.Hidden],
        ["TestSection", "Section", FieldType.Text],
        ["TestSectionHidden", "SectionHidden", FieldType.Hidden],
        ["TestExtra", "Extra", FieldType.Text],
      ];
      customFields.forEach(([name, value, type]) => {
        assertCustomFieldExists(cipher.fields, name, value, type);
      });
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const result = await expectParse(importer, testData, 7);

      // Since the test data has an identity that includes both a driver's
      // license number and a passport number there are two extra ciphers
      expect(result.ciphers.length).toEqual(7);
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
      expect(identityCipher.identity.address3).toBe("12th Foor Test County");
      expect(identityCipher.identity.city).toBe("New York");
      expect(identityCipher.identity.state).toBe("Test");
      expect(identityCipher.identity.postalCode).toBe("4038456");
      expect(identityCipher.identity.country).toBe("US");

      expect(identityCipher.fields.length).toEqual(13);
      // Custom field test cases of the form [fieldName, fieldValue, fieldType]
      const customFields: [string, string, FieldType | undefined][] = [
        ["gender", "Male", FieldType.Text],
        ["TestPersonal", "Personal", FieldType.Text],
        ["TestAddress", "Address", FieldType.Text],
        ["xHandle", "@twiter", FieldType.Text],
        ["secondPhoneNumber", "243538978", FieldType.Text],
        ["instagram", "@insta", FieldType.Text],
        ["TestContact", "Contact", FieldType.Hidden],
        ["jobTitle", "Engineer", FieldType.Text],
        ["workPhoneNumber", "78236476238746", FieldType.Text],
        ["TestWork", "Work", FieldType.Hidden],
        ["TestSection", "Section", FieldType.Text],
        ["TestSectionHidden", "SectionHidden", FieldType.Hidden],
        ["TestExtra", "Extra", FieldType.Text],
      ];
      customFields.forEach(([name, value, type]) => {
        assertCustomFieldExists(identityCipher.fields, name, value, type);
      });
    });
  });
});
