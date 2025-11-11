import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { newGuid } from "@bitwarden/guid";

import { ImportResult } from "../../models";
import { TestData } from "../spec-data/keeper-json/testdata.json";

import { KeeperJsonImporter } from "./keeper-json-importer";

describe("Keeper Json Importer", () => {
  const testDataJson = JSON.stringify(TestData);

  let result: ImportResult;
  let orgResult: ImportResult;

  beforeAll(async () => {
    const importer = new KeeperJsonImporter();
    result = await expectParse(importer);

    const orgImporter = new KeeperJsonImporter();
    orgImporter.organizationId = newGuid() as OrganizationId;
    orgResult = await expectParse(orgImporter);
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
    // Cipher
    const address = getCipher(result, "Home Address");
    expect(address).toBeDefined();
    expect(address.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(address.notes).toEqual("Primary residence - mailing and billing address");

    // Fields
    expect(address.fields.length).toEqual(1);
    expect(getField(address, "address")?.value).toEqual(
      "742 Evergreen Terrace, Apt 3B, Springfield, Oregon, 97477, US",
    );
  });

  it("should parse bankAccount", async () => {
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
    expect(bankAccount.login.totp).toContain("otpauth://totp/");

    // Fields
    expect(bankAccount.fields.length).toEqual(2);
    expect(getField(bankAccount, "bankAccount")?.value).toEqual(
      "Type: Checking, Account Number: 8472651938, Routing Number: 121000248",
    );
    expect(getField(bankAccount, "name")?.value).toEqual("Michael James Thompson");
  });

  it("should parse bankAccount with other type", async () => {
    // Cipher
    const bankAccount = getCipher(result, "Other bank");
    expect(bankAccount).toBeDefined();
    expect(bankAccount.type).toEqual(CipherType.SecureNote);

    // Fields
    expect(bankAccount.fields.length).toEqual(2);
    expect(getField(bankAccount, "bankAccount")?.value).toEqual(
      "Type: Crypto, Account Number: 12345678",
    );
    expect(getField(bankAccount, "name")?.value).toEqual("Mark Zwei");
  });

  it("should parse bankCard", async () => {
    // Cipher
    const bankCard = getCipher(result, "Chase Visa");
    expect(bankCard).toBeDefined();
    expect(bankCard.type).toEqual(CipherType.Card);

    // Properties
    expect(bankCard.notes).toEqual("Primary credit card for everyday purchases and rewards");
    expect(bankCard.card.number).toEqual("4532123456789010");
    expect(bankCard.card.cardholderName).toEqual("Sarah Johnson");
    expect(bankCard.card.brand).toEqual("Visa");
    expect(bankCard.card.expMonth).toEqual("06");
    expect(bankCard.card.expYear).toEqual("2030");

    // Fields
    expect(bankCard.fields.length).toEqual(1);
    expect(getField(bankCard, "PIN")?.value).toEqual("8426");
    expect(getField(bankCard, "PIN")?.type).toEqual(FieldType.Hidden);
  });

  it("should parse birthCertificate", async () => {
    // Cipher
    const birthCertificate = getCipher(result, "John Doe Birth Certificate");
    expect(birthCertificate).toBeDefined();
    expect(birthCertificate.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(birthCertificate.notes).toEqual(
      "Official birth certificate for identification purposes",
    );

    // Fields
    expect(birthCertificate.fields.length).toEqual(2);
    expect(getField(birthCertificate, "name")?.value).toEqual("John Michael Doe");
    expect(getField(birthCertificate, "birthDate")?.value).toEqual("5/15/1990, 12:00:00 AM");
  });

  it("should parse contact", async () => {
    // Cipher
    const contact = getCipher(result, "Dr. Emily Chen");
    expect(contact).toBeDefined();
    expect(contact.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(contact.notes).toEqual("Primary care physician - office visits and consultations");

    // Fields
    expect(contact.fields.length).toEqual(4);
    expect(getField(contact, "name")?.value).toEqual("Emily Marie Chen");
    expect(getField(contact, "company")?.value).toEqual("Springfield Medical Center");
    expect(getField(contact, "email")?.value).toEqual("emily.chen@smc.org");
    expect(getField(contact, "phone")?.value).toEqual("(AF) 5415558723 ext. 5577 (Work)");
  });

  it("should parse databaseCredentials", async () => {
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
    expect(databaseCredentials.fields.length).toEqual(3);
    expect(getField(databaseCredentials, "type")?.value).toEqual("MySQL");
    expect(getField(databaseCredentials, "Hostname")?.value).toEqual("db.production.company.com");
    expect(getField(databaseCredentials, "Port")?.value).toEqual("3306");
  });

  it("should parse driverLicense", async () => {
    // Cipher
    const driverLicense = getCipher(result, "Oregon Driver's License");
    expect(driverLicense).toBeDefined();
    expect(driverLicense.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(driverLicense.notes).toEqual("Valid Oregon driver's license - Class C");

    // Fields
    expect(driverLicense.fields.length).toEqual(4);
    expect(getField(driverLicense, "dlNumber")?.value).toEqual("DL-7482693");
    expect(getField(driverLicense, "name")?.value).toEqual("Robert William Anderson");
    expect(getField(driverLicense, "birthDate")?.value).toEqual("3/15/1985, 12:00:00 AM");
    expect(getField(driverLicense, "expirationDate")?.value).toEqual("3/15/2028, 12:00:00 AM");
  });

  it("should parse encryptedNotes", async () => {
    // Cipher
    const encryptedNotes = getCipher(result, "Important Meeting Notes");
    expect(encryptedNotes).toBeDefined();
    expect(encryptedNotes.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(encryptedNotes.notes).toEqual(
      "Confidential meeting with executive team - requires follow-up by end of month",
    );

    // Fields
    expect(encryptedNotes.fields.length).toEqual(2);
    expect(getField(encryptedNotes, "note")?.value).toEqual(
      "Q4 2024 Strategic Planning - Discussed budget allocations, team restructuring, and new product launch timeline",
    );
    expect(getField(encryptedNotes, "date")?.value).toEqual("10/15/2024, 12:00:00 AM");
  });

  it("should parse file", async () => {
    // Cipher
    const file = getCipher(result, "Project Proposal Document");
    expect(file).toBeDefined();
    expect(file.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(file.notes).toEqual(
      "Annual project proposal for Q1 2025 business development initiatives",
    );

    // Fields
    expect(file.fields.length).toEqual(0);
  });

  it("should parse general", async () => {
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
    expect(general.login.uri).toEqual("https://general.example.com");
    expect(general.login.totp).toContain("otpauth://totp/");

    // Fields
    expect(general.fields.length).toEqual(0);
  });

  it("should parse healthInsurance", async () => {
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
    expect(healthInsurance.login.uri).toEqual("https://www.bcbs.com");

    // Fields
    expect(healthInsurance.fields.length).toEqual(2);
    expect(getField(healthInsurance, "accountNumber")?.value).toEqual("BCBS-12345678");
    expect(getField(healthInsurance, "insuredsName")?.value).toEqual("David Alan Martinez");
  });

  it("should parse login", async () => {
    // Cipher
    const login = getCipher(result, "Amazon Account");
    expect(login).toBeDefined();
    expect(login.type).toEqual(CipherType.Login);
    expect(login.login.totp).toContain("otpauth://totp/");

    // Properties
    expect(login.notes).toEqual("Primary Amazon account for online shopping and Prime membership");
    expect(login.login.username).toEqual("john.martinez@email.com");
    expect(login.login.password).toEqual("Sp@rkl3Sun!2024");
    expect(login.login.uri).toEqual("https://www.amazon.com");
    expect(login.login.uris.map((x) => x.uri)).toEqual([
      "https://www.amazon.com",
      "https://login.amazon.com",
      "https://logout.amazon.com",
      "https://account.amazon.com",
      "https://profile.amazon.com",
    ]);

    // Fields
    expect(login.fields.length).toEqual(8);
    expect(getField(login, "some label")?.value).toEqual("some text");
    expect(getField(login, "some more text")?.value).toEqual(
      "some lines\nsome more lines\nblah blah blah",
    );

    const questions = getFields(login, "Security question");
    const answers = getFields(login, "Security question answer");
    expect(questions.map((x) => x.value)).toEqual([
      "how old were you when you were born?",
      "how are you?",
      "how old are you?",
    ]);
    expect(answers.map((x) => x.value)).toEqual(["zero", "good, thanks!", "five"]);
    expect(answers.map((x) => x.type)).toEqual([
      FieldType.Hidden,
      FieldType.Hidden,
      FieldType.Hidden,
    ]);
  });

  it("should parse membership", async () => {
    // Cipher
    const membership = getCipher(result, "LA Fitness Gym");
    expect(membership).toBeDefined();
    expect(membership.type).toEqual(CipherType.Login);

    // Properties
    expect(membership.notes).toEqual(
      "Annual membership - full gym access including pool and classes",
    );

    // Fields
    expect(membership.fields.length).toEqual(2);
    expect(getField(membership, "accountNumber")?.value).toEqual("LAF-987654321");
    expect(getField(membership, "name")?.value).toEqual("Lisa Marie Rodriguez");
  });

  it("should parse passport", async () => {
    // Cipher
    const passport = getCipher(result, "US Passport");
    expect(passport).toBeDefined();
    expect(passport.type).toEqual(CipherType.Login);

    // Properties
    expect(passport.notes).toEqual("Valid US passport for international travel");

    // Fields
    expect(passport.fields.length).toEqual(5);
    expect(getField(passport, "passportNumber")?.value).toEqual("543826194");
    expect(getField(passport, "name")?.value).toEqual("Jennifer Lynn Williams");
    expect(getField(passport, "birthDate")?.value).toEqual("7/22/1990, 12:00:00 AM");
    expect(getField(passport, "expirationDate")?.value).toEqual("7/22/2033, 12:00:00 AM");
    expect(getField(passport, "dateIssued")?.value).toEqual("8/15/2023, 12:00:00 AM");
  });

  it("should parse photo", async () => {
    // Cipher
    const photo = getCipher(result, "Family Vacation 2024");
    expect(photo).toBeDefined();
    expect(photo.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(photo.notes).toEqual("Summer vacation photos from Hawaii trip - scenic beach views");

    // Fields
    expect(photo.fields.length).toEqual(0);
  });

  it("should parse serverCredentials", async () => {
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
    expect(serverCredentials.fields.length).toEqual(2);
    expect(getField(serverCredentials, "Hostname")?.value).toEqual("web01.company.com");
    expect(getField(serverCredentials, "Port")?.value).toEqual("22");
  });

  it("should parse softwareLicense", async () => {
    // Cipher
    const softwareLicense = getCipher(result, "Adobe Creative Cloud");
    expect(softwareLicense).toBeDefined();
    expect(softwareLicense.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(softwareLicense.notes).toEqual(
      "Annual subscription - full access to Photoshop, Illustrator, Premiere Pro",
    );

    // Fields
    expect(softwareLicense.fields.length).toEqual(3);
    expect(getField(softwareLicense, "licenseNumber")?.value).toEqual("ACDB-7849-2635-1947-8520");
    expect(getField(softwareLicense, "expirationDate")?.value).toEqual("12/31/2025, 12:00:00 AM");
    expect(getField(softwareLicense, "dateActive")?.value).toEqual("1/15/2024, 12:00:00 AM");
  });

  it("should parse sshKeys", async () => {
    // Cipher
    const sshKey = getCipher(result, "Production Server SSH Key");
    expect(sshKey).toBeDefined();
    expect(sshKey.type).toEqual(CipherType.SshKey);

    // Properties
    expect(sshKey.notes).toEqual("SSH key for production server deployment - RSA 2048 bit");

    // Fields
    expect(sshKey.fields.length).toEqual(3);
    expect(getField(sshKey, "Username")?.value).toEqual("deploy_user");
    expect(getField(sshKey, "Hostname")?.value).toEqual("prod-server.company.com");
    expect(getField(sshKey, "Port")?.value).toEqual("22");
  });

  it("should parse sshKeys with a passphrase", async () => {
    // Cipher
    const sshKey = getCipher(result, "Production Server SSH Key with a passphrase");
    expect(sshKey).toBeDefined();
    expect(sshKey.type).toEqual(CipherType.SshKey);

    // Properties
    expect(sshKey.notes).toEqual("SSH key for production server deployment - RSA 2048 bit");

    // Fields
    expect(sshKey.fields.length).toEqual(3);
    expect(getField(sshKey, "Username")?.value).toEqual("deploy_user");
    expect(getField(sshKey, "Hostname")?.value).toEqual("prod-server.company.com");
    expect(getField(sshKey, "Port")?.value).toEqual("22");
  });

  it("should parse an invalid ssh key as secure note", async () => {
    // Cipher
    const secNote = getCipher(result, "Invalid SSH key");
    expect(secNote).toBeDefined();
    expect(secNote.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(secNote.notes).toEqual("Broken ssh key");

    // Fields
    expect(secNote.fields.length).toEqual(5);
    expect(getField(secNote, "Public key")?.value).toEqual("blah blah public key");
    expect(getField(secNote, "Private key")?.value).toEqual("blah blah blah private key");
    expect(getField(secNote, "Passphrase")?.value).toEqual("blah-blah-blah");
    expect(getField(secNote, "Hostname")?.value).toEqual("prod-server.company.com");
    expect(getField(secNote, "Port")?.value).toEqual("22");
  });

  it("should parse ssnCard", async () => {
    // Cipher
    const ssnCard = getCipher(result, "National Identity Card");
    expect(ssnCard).toBeDefined();
    expect(ssnCard.type).toEqual(CipherType.SecureNote);

    // Properties
    expect(ssnCard.notes).toEqual("National identification card - Valid through 2028");

    // Fields
    expect(ssnCard.fields.length).toEqual(2);
    expect(getField(ssnCard, "identityNumber")?.value).toEqual("ID-7849521");
    expect(getField(ssnCard, "name")?.value).toEqual("Sarah Elizabeth Johnson");
  });
  it("should parse wifiCredentials", async () => {
    // Cipher
    const wifiCredentials = getCipher(result, "Home Wi-Fi");
    expect(wifiCredentials).toBeDefined();
    expect(wifiCredentials.type).toEqual(CipherType.Login);

    // Properties
    expect(wifiCredentials.notes).toEqual("My cozy home wi-fi");
    expect(wifiCredentials.login.password).toEqual("secure-password-123");

    // Fields
    expect(wifiCredentials.fields.length).toEqual(1);
    expect(getField(wifiCredentials, "SSID")?.value).toEqual("cozy-home-netz");
  });

  it("should create folders and assigned ciphers to them", async () => {
    const folders = result.folders;
    expect(folders.length).toEqual(29);

    // Sort names and compare in bulk so we don't depend on specific ordering
    const folderNames = folders.map((f) => f.name).sort((a, b) => a.localeCompare(b));
    expect(folderNames).toEqual(allFolderNames);

    // No collections should be created outside of org context
    expect(result.collections.length).toEqual(0);

    // Folder relationships
    assertInFolder(result, "Home Address", "Personal/Finance/Banking");
    assertInFolder(
      result,
      "Production Server SSH Key",
      "Development/Name-with-both-slashes/Android",
    );
    assertInFolder(result, "Chase Visa", "Work/Projects/2025/Q4");
    assertInFolder(result, "John Doe Birth Certificate", "Work/Documents");

    // In two folders at the same time
    assertInFolder(
      result,
      "Production MySQL Database",
      "Development/Name-with-both-slashes/Name-with-forward-slashes/Name-with-backslashes",
    );
    assertInFolder(
      result,
      "Production MySQL Database",
      "Development/Name-with-both-slashes/Name-with-forward-slashes",
    );
  });

  it("should create collections if part of an organization", async () => {
    const folders = orgResult.collections;
    expect(folders.length).toEqual(29);

    // Sort names and compare in bulk so we don't depend on specific ordering
    const folderNames = folders.map((f) => f.name).sort((a, b) => a.localeCompare(b));
    expect(folderNames).toEqual(allFolderNames);

    // All folders should have been moved to collections
    expect(orgResult.folders.length).toEqual(0);
  });

  // Helpers
  async function expectParse(importer: KeeperJsonImporter): Promise<ImportResult> {
    const result = await importer.parse(testDataJson);
    expect(result).toBeDefined();
    expect(result.ciphers).toBeDefined();
    expect(result.ciphers.length).toEqual(23);
    return result;
  }

  function getCipher(result: ImportResult, name: string): CipherView | undefined {
    return result.ciphers.find((c) => c.name === name);
  }

  function getField(cipher: CipherView, name: string): FieldView | undefined {
    return cipher.fields.find((f) => f.name === name);
  }

  function getFields(cipher: CipherView, name: string): FieldView[] {
    return cipher.fields.filter((f) => f.name === name);
  }

  function assertInFolder(result: ImportResult, cipherName: string, folderName: string) {
    const cipherIndex = result.ciphers.findIndex((c) => c.name === cipherName);
    const folderIndex = result.folders.findIndex((f) => f.name === folderName);
    expect(result.folderRelationships).toContainEqual([cipherIndex, folderIndex]);
  }

  const allFolderNames = [
    "CanManageRecords-CanEdit",
    "CanManageUsers-ViewOnly",
    "Clients",
    "Clients/Enterprise",
    "Clients/Enterprise/North America",
    "Clients/Enterprise/North America/TechCorp",
    "Clients/Enterprise/North America/TechCorp/Shared-Needsted-Deep-Inside-Normal-Folder",
    "Development",
    "Development/Name-with-both-slashes",
    "Development/Name-with-both-slashes/Android",
    "Development/Name-with-both-slashes/Name-with-forward-slashes",
    "Development/Name-with-both-slashes/Name-with-forward-slashes/Name-with-backslashes",
    "Development/Web",
    "Education",
    "Empty Folder",
    "Empty Folder/Empty Nested Folder Level 2",
    "Empty Folder/Empty Nested Folder Level 2/Empty Nested Folder Level 3",
    "Empty Folder/Empty Nested Folder Level 2/Empty Nested Folder Level 3/Shared Folder Inside Empty Nested Folder",
    "FullAccess-CanShare",
    "NoUserPerms-EditAndShare",
    "Personal",
    "Personal/Finance",
    "Personal/Finance/Banking",
    "Personal/Finance/Banking/Accounts",
    "Work",
    "Work/Documents",
    "Work/Projects",
    "Work/Projects/2025",
    "Work/Projects/2025/Q4",
  ];
});
