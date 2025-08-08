import { MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FieldType, CipherType } from "@bitwarden/common/vault/enums";

import { testData } from "../spec-data/protonpass-json/protonpass.json";

import { ProtonPassJsonImporter } from "./protonpass-json-importer";

describe("Protonpass Json Importer", () => {
  let importer: ProtonPassJsonImporter;
  let i18nService: MockProxy<I18nService>;
  beforeEach(() => {
    importer = new ProtonPassJsonImporter(i18nService);
  });

  it("should parse login data", async () => {
    const testDataJson = JSON.stringify(testData);

    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("Test Login - Personal Vault");
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.login.username).toEqual("Username");
    expect(cipher.login.password).toEqual("Password");
    expect(cipher.login.uris.length).toEqual(2);
    const uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("https://example.com/");
    expect(cipher.notes).toEqual("My login secure note.");

    expect(cipher.fields.at(0).name).toEqual("email");
    expect(cipher.fields.at(0).value).toEqual("Email");

    expect(cipher.fields.at(3).name).toEqual("second 2fa secret");
    expect(cipher.fields.at(3).value).toEqual("TOTPCODE");
    expect(cipher.fields.at(3).type).toEqual(FieldType.Hidden);
  });

  it("should parse note data", async () => {
    const testDataJson = JSON.stringify(testData);

    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    result.ciphers.shift();
    const noteCipher = result.ciphers.shift();
    expect(noteCipher.type).toEqual(CipherType.SecureNote);
    expect(noteCipher.name).toEqual("My Secure Note");
    expect(noteCipher.notes).toEqual("Secure note contents.");
  });

  it("should parse credit card data", async () => {
    const testDataJson = JSON.stringify(testData);

    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    result.ciphers.shift();
    result.ciphers.shift();

    const creditCardCipher = result.ciphers.shift();
    expect(creditCardCipher.type).toBe(CipherType.Card);
    expect(creditCardCipher.card.number).toBe("1234222233334444");
    expect(creditCardCipher.card.cardholderName).toBe("Test name");
    expect(creditCardCipher.card.expMonth).toBe("1");
    expect(creditCardCipher.card.expYear).toBe("2025");
    expect(creditCardCipher.card.code).toBe("333");
    expect(creditCardCipher.fields.at(0).name).toEqual("PIN");
    expect(creditCardCipher.fields.at(0).value).toEqual("1234");
    expect(creditCardCipher.fields.at(0).type).toEqual(FieldType.Hidden);
  });

  it("should create folders if not part of an organization", async () => {
    const testDataJson = JSON.stringify(testData);
    const result = await importer.parse(testDataJson);

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
    const testDataJson = JSON.stringify(testData);
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

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
    const testDataJson = JSON.stringify(testData);
    const result = await importer.parse(testDataJson);

    const ciphers = result.ciphers;
    for (const cipher of ciphers) {
      expect(cipher.name).not.toBe("My Deleted Note");
    }

    expect(ciphers.length).toBe(5);
  });

  it("should set favorites", async () => {
    const testDataJson = JSON.stringify(testData);
    const result = await importer.parse(testDataJson);

    const ciphers = result.ciphers;
    expect(ciphers[0].favorite).toBe(true);
    expect(ciphers[1].favorite).toBe(false);
    expect(ciphers[2].favorite).toBe(true);
  });

  it("should skip unsupported items", async () => {
    const testDataJson = JSON.stringify(testData);
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const ciphers = result.ciphers;
    expect(ciphers.length).toBe(5);
    expect(ciphers[4].type).toEqual(CipherType.Login);
  });

  it("should parse identity data", async () => {
    const testDataJson = JSON.stringify(testData);
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    result.ciphers.shift();
    result.ciphers.shift();
    result.ciphers.shift();

    const cipher = result.ciphers.shift();
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

    expect(cipher.fields.at(0).name).toEqual("gender");
    expect(cipher.fields.at(0).value).toEqual("Male");
    expect(cipher.fields.at(0).type).toEqual(FieldType.Text);

    expect(cipher.fields.at(1).name).toEqual("TestPersonal");
    expect(cipher.fields.at(1).value).toEqual("Personal");
    expect(cipher.fields.at(1).type).toEqual(FieldType.Text);

    expect(cipher.fields.at(2).name).toEqual("TestAddress");
    expect(cipher.fields.at(2).value).toEqual("Address");
    expect(cipher.fields.at(2).type).toEqual(FieldType.Text);

    expect(cipher.fields.at(3).name).toEqual("xHandle");
    expect(cipher.fields.at(3).value).toEqual("@twiter");
    expect(cipher.fields.at(3).type).toEqual(FieldType.Text);

    expect(cipher.fields.at(4).name).toEqual("secondPhoneNumber");
    expect(cipher.fields.at(4).value).toEqual("243538978");
    expect(cipher.fields.at(4).type).toEqual(FieldType.Text);

    expect(cipher.fields.at(5).name).toEqual("instagram");
    expect(cipher.fields.at(5).value).toEqual("@insta");
    expect(cipher.fields.at(5).type).toEqual(FieldType.Text);

    expect(cipher.fields.at(6).name).toEqual("TestContact");
    expect(cipher.fields.at(6).value).toEqual("Contact");
    expect(cipher.fields.at(6).type).toEqual(FieldType.Hidden);

    expect(cipher.fields.at(7).name).toEqual("jobTitle");
    expect(cipher.fields.at(7).value).toEqual("Engineer");
    expect(cipher.fields.at(7).type).toEqual(FieldType.Text);

    expect(cipher.fields.at(8).name).toEqual("workPhoneNumber");
    expect(cipher.fields.at(8).value).toEqual("78236476238746");
    expect(cipher.fields.at(8).type).toEqual(FieldType.Text);

    expect(cipher.fields.at(9).name).toEqual("TestWork");
    expect(cipher.fields.at(9).value).toEqual("Work");
    expect(cipher.fields.at(9).type).toEqual(FieldType.Hidden);

    expect(cipher.fields.at(10).name).toEqual("TestSection");
    expect(cipher.fields.at(10).value).toEqual("Section");
    expect(cipher.fields.at(10).type).toEqual(FieldType.Text);

    expect(cipher.fields.at(11).name).toEqual("TestSectionHidden");
    expect(cipher.fields.at(11).value).toEqual("SectionHidden");
    expect(cipher.fields.at(11).type).toEqual(FieldType.Hidden);

    expect(cipher.fields.at(12).name).toEqual("TestExtra");
    expect(cipher.fields.at(12).value).toEqual("Extra");
    expect(cipher.fields.at(12).type).toEqual(FieldType.Text);
  });
});
