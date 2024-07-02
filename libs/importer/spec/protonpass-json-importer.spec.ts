import { MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FieldType, CipherType } from "@bitwarden/common/vault/enums";

import { ProtonPassJsonImporter } from "../src/importers";

import { testData } from "./test-data/protonpass-json/protonpass.json";

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

    expect(cipher.fields.at(0).name).toEqual("itemUsername");
    expect(cipher.fields.at(0).value).toEqual("someOtherUsername");

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
    expect(result.folderRelationships[3]).toEqual([3, 1]);
  });

  it("should create collections if part of an organization", async () => {
    const testDataJson = JSON.stringify(testData);
    importer.organizationId = Utils.newGuid();
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const collections = result.collections;
    expect(collections.length).toBe(2);
    expect(collections[0].name).toBe("Personal");
    expect(collections[1].name).toBe("Test");

    // "My Secure Note" is assigned to folder "Personal"
    expect(result.collectionRelationships[1]).toEqual([1, 0]);
    // "Other vault login" is assigned to folder "Test"
    expect(result.collectionRelationships[3]).toEqual([3, 1]);
  });

  it("should not add deleted items", async () => {
    const testDataJson = JSON.stringify(testData);
    const result = await importer.parse(testDataJson);

    const ciphers = result.ciphers;
    for (const cipher of ciphers) {
      expect(cipher.name).not.toBe("My Deleted Note");
    }

    expect(ciphers.length).toBe(4);
  });
});
