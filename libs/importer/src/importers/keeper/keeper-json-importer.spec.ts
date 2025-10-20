import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";


import { ImportResult } from "../../models";
import { TestData } from "../spec-data/keeper-json/testdata.json";

import { KeeperJsonImporter } from "./keeper-json-importer";

describe("Keeper Json Importer", () => {
  const testDataJson = JSON.stringify(TestData);

  let importer: KeeperJsonImporter;

  beforeEach(() => {
    // TODO: Should this be just done once for all tests? We're
    //       importing lots of records every time, just to check one.
    importer = new KeeperJsonImporter();
  });

  // All possible record types
  // (use `keeper rti` command to list them)
  //
  //  1  address
  //  2  bankAccount
  //  3  bankCard
  //  4  birthCertificate
  //  5  contact
  //  6  databaseCredentials
  //  7  driverLicense
  //  8  encryptedNotes
  //  9  file
  // 10  general
  // 11  healthInsurance
  // 12  login
  // 13  membership
  // 14  passport
  // 15  photo
  // 16  serverCredentials
  // 17  softwareLicense
  // 18  sshKeys
  // 19  ssnCard
  // 96  wifiCredentials

  it("should parse address", async () => {
    const result = await expectParse();

    // Cipher
    const address = getCipher(result, "Home Address");
    expect(address).toBeDefined();
    expect(address.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(address.notes).toEqual("Primary residence - mailing and billing address");

    // Fields
    expect(getField(address, "$address")).toBeDefined();
  });

  it("should parse bankAccount", async () => {
    const result = await expectParse();

    // Cipher
    const bankAccount = getCipher(result, "Wells Fargo Checking");
    expect(bankAccount).toBeDefined();
    expect(bankAccount.type).toEqual(CipherType.Login);

    // Properties
    expect(bankAccount.notes).toEqual(
      "Primary checking account for direct deposit and bill payments",
    );
    expect(bankAccount.login.username).toEqual("m.thompson@email.com");
    expect(bankAccount.login.password).toEqual("BankS3cur3!Pass");

    // Fields
    expect(getField(bankAccount, "$bankAccount")).toBeDefined();
    expect(getField(bankAccount, "$name")).toBeDefined();
  });

  it("should parse bankCard", async () => {
    const result = await expectParse();

    // Cipher
    const bankCard = getCipher(result, "Chase Visa");
    expect(bankCard).toBeDefined();
    expect(bankCard.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(bankCard.notes).toEqual("Primary credit card for everyday purchases and rewards");

    // Fields
    expect(getField(bankCard, "$paymentCard")).toBeDefined();
    expect(getField(bankCard, "$text:cardholderName")).toBeDefined();
    expect(getField(bankCard, "$pinCode")).toBeDefined();
  });

  it("should parse birthCertificate", async () => {
    const result = await expectParse();

    // Cipher
    const birthCertificate = getCipher(result, "John Doe Birth Certificate");
    expect(birthCertificate).toBeDefined();
    expect(birthCertificate.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(birthCertificate.notes).toEqual(
      "Official birth certificate for identification purposes",
    );

    // Fields
    expect(getField(birthCertificate, "$name")).toBeDefined();
    expect(getField(birthCertificate, "$birthDate")).toBeDefined();
  });

  it("should parse contact", async () => {
    const result = await expectParse();

    // Cipher
    const contact = getCipher(result, "Dr. Emily Chen");
    expect(contact).toBeDefined();
    expect(contact.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(contact.notes).toEqual("Primary care physician - office visits and consultations");

    // Fields
    expect(getField(contact, "$name")).toBeDefined();
    expect(getField(contact, "$text:company")).toBeDefined();
    expect(getField(contact, "$email")).toBeDefined();
    expect(getField(contact, "$phone")).toBeDefined();
  });

  it("should parse databaseCredentials", async () => {
    const result = await expectParse();

    // Cipher
    const databaseCredentials = getCipher(result, "Production MySQL Database");
    expect(databaseCredentials).toBeDefined();
    expect(databaseCredentials.type).toEqual(CipherType.Login);

    // Properties
    expect(databaseCredentials.notes).toEqual(
      "Production database server for main application - handle with care",
    );
    expect(databaseCredentials.login.username).toEqual("db_admin");
    expect(databaseCredentials.login.password).toEqual("SecureDb#2024$Pass");

    // Fields
    expect(getField(databaseCredentials, "$text:type")).toBeDefined();
    expect(getField(databaseCredentials, "$host")).toBeDefined();
  });

  it("should parse driverLicense", async () => {
    const result = await expectParse();

    // Cipher
    const driverLicense = getCipher(result, "Oregon Driver's License");
    expect(driverLicense).toBeDefined();
    expect(driverLicense.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(driverLicense.notes).toEqual("Valid Oregon driver's license - Class C");

    // Fields
    expect(getField(driverLicense, "$accountNumber:dlNumber")).toBeDefined();
    expect(getField(driverLicense, "$name")).toBeDefined();
    expect(getField(driverLicense, "$birthDate")).toBeDefined();
    expect(getField(driverLicense, "$expirationDate")).toBeDefined();
  });

  it("should parse encryptedNotes", async () => {
    const result = await expectParse();

    // Cipher
    const encryptedNotes = getCipher(result, "Important Meeting Notes");
    expect(encryptedNotes).toBeDefined();
    expect(encryptedNotes.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(encryptedNotes.notes).toEqual(
      "Confidential meeting with executive team - requires follow-up by end of month",
    );

    // Fields
    expect(getField(encryptedNotes, "$note")).toBeDefined();
    expect(getField(encryptedNotes, "$date")).toBeDefined();
  });

  it("should parse file", async () => {
    const result = await expectParse();

    // Cipher
    const file = getCipher(result, "Project Proposal Document");
    expect(file).toBeDefined();
    expect(file.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(file.notes).toEqual(
      "Annual project proposal for Q1 2025 business development initiatives",
    );
  });

  it("should parse general", async () => {
    const result = await expectParse();

    // Cipher
    const general = getCipher(result, "General Information Record");
    expect(general).toBeDefined();
    expect(general.type).toEqual(CipherType.Login);

    // Properties
    expect(general.notes).toEqual(
      "General purpose record for miscellaneous information and credentials",
    );
    expect(general.login.username).toEqual("general_user@example.com");
    expect(general.login.password).toEqual("GeneralPass#2024!Secure");
  });

  it("should parse healthInsurance", async () => {
    const result = await expectParse();

    // Cipher
    const healthInsurance = getCipher(result, "Blue Cross Blue Shield");
    expect(healthInsurance).toBeDefined();
    expect(healthInsurance.type).toEqual(CipherType.Login);

    // Properties
    expect(healthInsurance.notes).toEqual(
      "PPO plan with nationwide coverage - family deductible $2500",
    );
    expect(healthInsurance.login.username).toEqual("david.martinez@email.com");
    expect(healthInsurance.login.password).toEqual("Health$ecure789");

    // Fields
    expect(getField(healthInsurance, "$accountNumber")).toBeDefined();
    expect(getField(healthInsurance, "$name:insuredsName")).toBeDefined();
  });

  it("should parse login", async () => {
    const result = await expectParse();

    // Cipher
    const login = getCipher(result, "Amazon Account");
    expect(login).toBeDefined();
    expect(login.type).toEqual(CipherType.Login);

    // Properties
    expect(login.notes).toEqual("Primary Amazon account for online shopping and Prime membership");
    expect(login.login.username).toEqual("john.martinez@email.com");
    expect(login.login.password).toEqual("Sp@rkl3Sun!2024");
  });

  it("should parse membership", async () => {
    const result = await expectParse();

    // Cipher
    const membership = getCipher(result, "LA Fitness Gym");
    expect(membership).toBeDefined();
    expect(membership.type).toEqual(CipherType.Login);

    // Properties
    expect(membership.notes).toEqual(
      "Annual membership - full gym access including pool and classes",
    );

    // Fields
    expect(getField(membership, "$accountNumber")).toBeDefined();
    expect(getField(membership, "$name")).toBeDefined();
  });

  it("should parse passport", async () => {
    const result = await expectParse();

    // Cipher
    const passport = getCipher(result, "US Passport");
    expect(passport).toBeDefined();
    expect(passport.type).toEqual(CipherType.Login);

    // Properties
    expect(passport.notes).toEqual("Valid US passport for international travel");

    // Fields
    expect(getField(passport, "$accountNumber:passportNumber")).toBeDefined();
    expect(getField(passport, "$name")).toBeDefined();
    expect(getField(passport, "$birthDate")).toBeDefined();
    expect(getField(passport, "$expirationDate")).toBeDefined();
    expect(getField(passport, "$date:dateIssued")).toBeDefined();
  });

  it("should parse photo", async () => {
    const result = await expectParse();

    // Cipher
    const photo = getCipher(result, "Family Vacation 2024");
    expect(photo).toBeDefined();
    expect(photo.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(photo.notes).toEqual("Summer vacation photos from Hawaii trip - scenic beach views");
  });

  it("should parse serverCredentials", async () => {
    const result = await expectParse();

    // Cipher
    const serverCredentials = getCipher(result, "Web Server - Production");
    expect(serverCredentials).toBeDefined();
    expect(serverCredentials.type).toEqual(CipherType.Login);

    // Properties
    expect(serverCredentials.notes).toEqual(
      "Primary production web server - Apache 2.4.52 - Ubuntu 22.04",
    );
    expect(serverCredentials.login.username).toEqual("sysadmin");
    expect(serverCredentials.login.password).toEqual("Srv#Prod2024!Sec");

    // Fields
    expect(getField(serverCredentials, "$host")).toBeDefined();
  });

  it("should parse softwareLicense", async () => {
    const result = await expectParse();

    // Cipher
    const softwareLicense = getCipher(result, "Adobe Creative Cloud");
    expect(softwareLicense).toBeDefined();
    expect(softwareLicense.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(softwareLicense.notes).toEqual(
      "Annual subscription - full access to Photoshop, Illustrator, Premiere Pro",
    );

    // Fields
    expect(getField(softwareLicense, "$licenseNumber")).toBeDefined();
    expect(getField(softwareLicense, "$expirationDate")).toBeDefined();
    expect(getField(softwareLicense, "$date:dateActive")).toBeDefined();
  });

  it("should parse sshKeys", async () => {
    const result = await expectParse();

    // Cipher
    const sshKey = getCipher(result, "Production Server SSH Key");
    expect(sshKey).toBeDefined();
    expect(sshKey.type).toEqual(CipherType.Login);

    // Properties
    expect(sshKey.notes).toEqual("SSH key for production server deployment - RSA 4096 bit");
    expect(sshKey.login.username).toEqual("deploy_user");
    expect(sshKey.login.password).toEqual("SecurePass#SSH2024");

    // Fields
    expect(getField(sshKey, "$keyPair")).toBeDefined();
    expect(getField(sshKey, "$host")).toBeDefined();
  });

  it("should parse ssnCard", async () => {
    const result = await expectParse();

    // Cipher
    const ssnCard = getCipher(result, "National Identity Card");
    expect(ssnCard).toBeDefined();
    expect(ssnCard.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(ssnCard.notes).toEqual("National identification card - Valid through 2028");

    // Fields
    expect(getField(ssnCard, "$accountNumber:identityNumber")).toBeDefined();
    expect(getField(ssnCard, "$name")).toBeDefined();
  });

  it("should parse wifiCredentials", async () => {
    const result = await expectParse();

    // Cipher
    const wifiCredentials = getCipher(result, "Home Wi-Fi");
    expect(wifiCredentials).toBeDefined();
    expect(wifiCredentials.type).toEqual(CipherType.Login);

    // Properties
    expect(wifiCredentials.notes).toEqual("My cozy home wi-fi");
    expect(wifiCredentials.login.password).toEqual("mega-secure-password-123");

    // Fields
    expect(getField(wifiCredentials, "$text:SSID")).toBeDefined();
  });

  it.skip("should import TOTP when present", async () => {
    const result = await expectParse();

    const cipher = result.ciphers.shift();
    expect(cipher.login.totp).toBeUndefined();

    // 2nd Cipher
    const cipher2 = result.ciphers.shift();
    expect(cipher2.login.totp).toEqual(
      "otpauth://totp/Amazon:me@company.com?secret=JBSWY3DPEHPK3PXP&issuer=Amazon&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("should create folders and assigned ciphers to them", async () => {
    const result = await expectParse();

    const folders = result.folders;
    expect(folders.length).toBe(20);

    // Sort names and compare in bulk so we don't depend on specific ordering
    const folderNames = folders.map((f) => f.name).sort((a, b) => a.localeCompare(b));
    expect(folderNames).toEqual([
      "Clients",
      "Clients/Enterprise",
      "Clients/Enterprise/North America",
      "Clients/Enterprise/North America/TechCorp",
      "Development",
      "Development/Name-with-both-slashes",
      "Development/Name-with-both-slashes/Android",
      "Development/Name-with-both-slashes/Name-with-forward-slashes",
      "Development/Name-with-both-slashes/Name-with-forward-slashes/Name-with-backslashes",
      "Development/Web",
      "Education",
      "Personal",
      "Personal/Finance",
      "Personal/Finance/Banking",
      "Personal/Finance/Banking/Accounts",
      "Work",
      "Work/Documents",
      "Work/Projects",
      "Work/Projects/2025",
      "Work/Projects/2025/Q4",
    ]);

    function assertInFolder(cipherName: string, folderName: string) {
      const cipherIndex = result.ciphers.findIndex((c) => c.name === cipherName);
      const folderIndex = folders.findIndex((f) => f.name === folderName);
      expect(result.folderRelationships).toContainEqual([cipherIndex, folderIndex]);
    }

    // Folder relationships
    assertInFolder("Home Address", "Personal/Finance/Banking");
    assertInFolder("Production Server SSH Key", "Development/Name-with-both-slashes/Android");
    assertInFolder("Chase Visa", "Work/Projects/2025/Q4");
    assertInFolder("John Doe Birth Certificate", "Work/Documents");

    // In two folders at the same time
    assertInFolder(
      "Production MySQL Database",
      "Development/Name-with-both-slashes/Name-with-forward-slashes/Name-with-backslashes",
    );
    assertInFolder(
      "Production MySQL Database",
      "Development/Name-with-both-slashes/Name-with-forward-slashes",
    );
  });

  it.skip("should create collections if part of an organization", async () => {
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await expectParse();

    const collections = result.collections;
    expect(collections.length).toBe(2);
    expect(collections[0].name).toBe("Optional Private Folder 1");
    expect(collections[1].name).toBe("My Customer 1");

    expect(result.collectionRelationships[0]).toEqual([0, 0]);
    expect(result.collectionRelationships[1]).toEqual([1, 0]);
    expect(result.collectionRelationships[2]).toEqual([1, 1]);
  });

  // Helpers
  async function expectParse(): Promise<ImportResult> {
    const result = await importer.parse(testDataJson);
    expect(result).toBeDefined();
    expect(result.ciphers).toBeDefined();
    expect(result.ciphers.length).toBe(20);
    return result;
  }

  function getCipher(result: ImportResult, name: string): CipherView | undefined {
    return result.ciphers.find((c) => c.name === name);
  }

  function getField(cipher: CipherView, name: string): FieldView | undefined {
    return cipher.fields.find((f) => f.name === name);
  }
});
