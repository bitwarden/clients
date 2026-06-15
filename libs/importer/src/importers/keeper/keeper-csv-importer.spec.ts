import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";

import { assertFieldsStructure } from "../spec-data/importer-test-utils";
import {
  testData as TestData,
  testDataMultiCollection,
  dedicatedItemTypesData as DedicatedItemTypesData,
} from "../spec-data/keeper-csv/testdata.csv";

import { KeeperCsvImporter } from "./keeper-csv-importer";

describe("Keeper CSV Importer", () => {
  let importer: KeeperCsvImporter;
  const configService = mock<ConfigService>();

  beforeEach(() => {
    importer = new KeeperCsvImporter(configService);

    // By default, disable all feature flags
    configService.getFeatureFlag.mockResolvedValue(false);
  });

  it("should parse login data", async () => {
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);

    expect(result.ciphers.length).toEqual(3);
    const cipher = result.ciphers[0];
    expect(cipher.name).toEqual("Bar");
    expect(cipher.login.username).toEqual("john.doe@example.com");
    expect(cipher.login.password).toEqual("1234567890abcdef");
    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris[0];
    expect(uriView.uri).toEqual("https://example.com/");
    expect(cipher.notes).toEqual("These are some notes.");

    const cipher2 = result.ciphers[1];
    expect(cipher2.name).toEqual("Bar 1");
    expect(cipher2.login.username).toEqual("john.doe1@example.com");
    expect(cipher2.login.password).toEqual("234567890abcdef1");
    expect(cipher2.login.uris.length).toEqual(1);
    const uriView2 = cipher2.login.uris[0];
    expect(uriView2.uri).toEqual("https://an.example.com/");
    expect(cipher2.notes).toBeNull();

    const cipher3 = result.ciphers[2];
    expect(cipher3.name).toEqual("Bar 2");
    expect(cipher3.login.username).toEqual("john.doe2@example.com");
    expect(cipher3.login.password).toEqual("34567890abcdef12");
    expect(cipher3.notes).toBeNull();
    expect(cipher3.login.uris.length).toEqual(1);
    const uriView3 = cipher3.login.uris[0];
    expect(uriView3.uri).toEqual("https://another.example.com/");
  });

  it("should import TOTP when present", async () => {
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);

    expect(result.ciphers.length).toEqual(3);
    const cipher = result.ciphers[0];
    expect(cipher.login.totp).toBeUndefined();

    const cipher2 = result.ciphers[1];
    expect(cipher2.login.totp).toBeUndefined();

    const cipher3 = result.ciphers[2];
    expect(cipher3.login.totp).toEqual(
      "otpauth://totp/Amazon:me@company.com?secret=JBSWY3DPEHPK3PXP&issuer=Amazon&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("should parse custom fields", async () => {
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);

    expect(result.ciphers.length).toEqual(3);
    const cipher = result.ciphers[0];
    expect(cipher.fields.length).toBe(0);

    const cipher2 = result.ciphers[1];
    expect(cipher2.fields.length).toBe(2);
    expect(cipher2.fields[0].name).toEqual("Account ID");
    expect(cipher2.fields[0].value).toEqual("12345");
    expect(cipher2.fields[1].name).toEqual("Org ID");
    expect(cipher2.fields[1].value).toEqual("54321");

    const cipher3 = result.ciphers[2];
    expect(cipher3.fields[0].name).toEqual("Account ID");
    expect(cipher3.fields[0].value).toEqual("23456");
  });

  it("should create folders, with subfolders and relationships", async () => {
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);

    const folders = result.folders;
    expect(folders).not.toBeNull();
    expect(folders.length).toBe(2);

    const folder1 = folders[0];
    expect(folder1.name).toBe("Foo");

    //With subfolders
    const folder2 = folders[1];
    expect(folder2.name).toBe("Foo/Baz");

    // [Cipher, Folder]
    expect(result.folderRelationships.length).toBe(3);
    expect(result.folderRelationships[0]).toEqual([0, 0]);
    expect(result.folderRelationships[1]).toEqual([1, 0]);
    expect(result.folderRelationships[2]).toEqual([2, 1]);
  });

  it("should create collections, with subcollections and relationships", async () => {
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);

    const collections = result.collections;
    expect(collections).not.toBeNull();
    expect(collections.length).toBe(2);

    const collections1 = collections[0];
    expect(collections1.name).toBe("Foo");

    //With subCollection
    const collections2 = collections[1];
    expect(collections2.name).toBe("Foo/Baz");

    // [Cipher, Folder]
    expect(result.collectionRelationships.length).toBe(3);
    expect(result.collectionRelationships[0]).toEqual([0, 0]);
    expect(result.collectionRelationships[1]).toEqual([1, 0]);
    expect(result.collectionRelationships[2]).toEqual([2, 1]);
  });

  it("should create collections tree, with child collections and relationships", async () => {
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await importer.parse(testDataMultiCollection);
    expect(result != null).toBe(true);

    const collections = result.collections;
    expect(collections).not.toBeNull();
    expect(collections.length).toBe(3);

    // collection with the cipher
    const collections1 = collections[0];
    expect(collections1.name).toBe("Foo/Baz/Bar");

    //second level collection
    const collections2 = collections[1];
    expect(collections2.name).toBe("Foo/Baz");

    //third level
    const collections3 = collections[2];
    expect(collections3.name).toBe("Foo");

    // [Cipher, Folder]
    expect(result.collectionRelationships.length).toBe(3);
    expect(result.collectionRelationships[0]).toEqual([0, 0]);
    expect(result.collectionRelationships[1]).toEqual([1, 1]);
    expect(result.collectionRelationships[2]).toEqual([2, 2]);
  });

  describe("should propertly parse bank accounts, passports, and drivers licenses", () => {
    it("with new item types feature flag OFF", async () => {
      const result = await importer.parse(DedicatedItemTypesData);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toEqual(3);

      const bankAccountCipher = result.ciphers[0];
      expect(bankAccountCipher.type).toEqual(CipherType.Login);
      expect(bankAccountCipher.name).toEqual("Test Bank Account");
      expect(bankAccountCipher.login.username).toEqual("bbaggins@gmail.com");
      expect(bankAccountCipher.login.password).toEqual("d{24|452Jv/p`m7bZpJ[");
      expect(bankAccountCipher.login.uris.length).toEqual(1);
      expect(bankAccountCipher.login.uris[0].uri).toEqual("https://bankoftheshire.com");
      assertFieldsStructure(bankAccountCipher.fields, [
        ["Bank Account", "Checking | 1234567890 | 12345"],
        ["Name", "Bilbo Baggins"],
      ]);

      const passportCipher = result.ciphers[1];
      expect(passportCipher.type).toEqual(CipherType.Login);
      expect(passportCipher.name).toEqual("Test Passport");
      assertFieldsStructure(passportCipher.fields, [
        ["Passport Number", "1234567890"],
        ["Name", "Bilbo Baggins"],
        ["Date of Birth", "09/22/2890"],
        ["Address", "Bag End, Bagshot Row | Under-Hill | Hobbiton | Westfarthing, The Shire | US"],
        ["Date", "06/19/2951"],
        ["Date Issued", "06/19/2941"],
      ]);

      const driversLicenseCipher = result.ciphers[2];
      expect(driversLicenseCipher.type).toEqual(CipherType.Login);
      expect(driversLicenseCipher.name).toEqual("Test Drivers License");
      assertFieldsStructure(driversLicenseCipher.fields, [
        ["Driver's License Number", "1234567890"],
        ["Name", "Bilbo Baggins"],
        ["Date of Birth", "09/22/2890"],
        ["Address", "Bag End, Bagshot Row | Under-Hill | Hobbiton | Westfarthing, The Shire | US"],
        ["Date", "09/22/2916"],
      ]);
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const result = await importer.parse(DedicatedItemTypesData);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toEqual(4);

      const bankAccountLoginCipher = result.ciphers[0];
      expect(bankAccountLoginCipher.type).toEqual(CipherType.Login);
      expect(bankAccountLoginCipher.name).toEqual("Test Bank Account");
      expect(bankAccountLoginCipher.login.username).toEqual("bbaggins@gmail.com");
      expect(bankAccountLoginCipher.login.password).toEqual("d{24|452Jv/p`m7bZpJ[");
      expect(bankAccountLoginCipher.login.uris.length).toEqual(1);
      expect(bankAccountLoginCipher.login.uris[0].uri).toEqual("https://bankoftheshire.com");
      assertFieldsStructure(bankAccountLoginCipher.fields, []);

      const bankAccountCipher = result.ciphers[1];
      expect(bankAccountCipher.type).toEqual(CipherType.BankAccount);
      expect(bankAccountCipher.name).toEqual("Test Bank Account");
      expect(bankAccountCipher.bankAccount.accountType).toEqual("Checking");
      expect(bankAccountCipher.bankAccount.accountNumber).toEqual("1234567890");
      expect(bankAccountCipher.bankAccount.routingNumber).toEqual("12345");
      expect(bankAccountCipher.bankAccount.nameOnAccount).toEqual("Bilbo Baggins");
      assertFieldsStructure(bankAccountCipher.fields, []);

      // The new bank account cipher should be in the same folder as the login
      expect(result.folders.length).toBe(1);
      expect(result.folders[0].name).toBe("Banks");
      expect(result.folderRelationships.length).toBe(2);
      expect(result.folderRelationships[0]).toEqual([0, 0]);
      expect(result.folderRelationships[1]).toEqual([1, 0]);

      const passportCipher = result.ciphers[2];
      expect(passportCipher.type).toEqual(CipherType.Passport);
      expect(passportCipher.name).toEqual("Test Passport");
      expect(passportCipher.passport.passportNumber).toEqual("1234567890");
      expect(passportCipher.passport.givenName).toEqual("Bilbo");
      expect(passportCipher.passport.surname).toEqual("Baggins");
      expect(passportCipher.passport.dateOfBirth).toEqual("09/22/2890");
      expect(passportCipher.passport.expirationDate).toEqual("06/19/2951");
      expect(passportCipher.passport.issueDate).toEqual("06/19/2941");
      assertFieldsStructure(passportCipher.fields, [
        ["Address", "Bag End, Bagshot Row | Under-Hill | Hobbiton | Westfarthing, The Shire | US"],
      ]);

      const driversLicenseCipher = result.ciphers[3];
      expect(driversLicenseCipher.type).toEqual(CipherType.DriversLicense);
      expect(driversLicenseCipher.name).toEqual("Test Drivers License");
      expect(driversLicenseCipher.driversLicense.licenseNumber).toEqual("1234567890");
      expect(driversLicenseCipher.driversLicense.firstName).toEqual("Bilbo");
      expect(driversLicenseCipher.driversLicense.middleName).toBeUndefined();
      expect(driversLicenseCipher.driversLicense.lastName).toEqual("Baggins");
      expect(driversLicenseCipher.driversLicense.dateOfBirth).toEqual("09/22/2890");
      expect(driversLicenseCipher.driversLicense.expirationDate).toEqual("09/22/2916");
      assertFieldsStructure(driversLicenseCipher.fields, [
        ["Address", "Bag End, Bagshot Row | Under-Hill | Hobbiton | Westfarthing, The Shire | US"],
      ]);
    });
  });
});
