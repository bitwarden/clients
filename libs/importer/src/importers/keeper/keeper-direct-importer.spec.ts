/**
 * @jest-environment node
 */
import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { ImportResult } from "../../models";
import * as fixture from "../spec-data/keeper-direct/keeper-vault-fixture.json";

import { Vault } from "./access";
import { SyncDownResponse } from "./access/generated/SyncDown";
import { KeeperDirectImporter } from "./keeper-direct-importer";

describe("Keeper Direct Importer", () => {
  let vault: Vault;
  let result: ImportResult;

  beforeAll(async () => {
    jest.spyOn(console, "warn").mockImplementation();

    const response = SyncDownResponse.fromBinary(Buffer.from(fixture.response, "base64"));
    vault = await (Vault as any).processMergedSyncDownPages(
      response,
      new Uint8Array(Buffer.from(fixture.masterKey, "base64")),
    );

    const importer = new KeeperDirectImporter();
    result = importer.convertVaultToImportResult(vault);
  });

  it("should parse address", () => {
    const cipher = findCipher(result, "Home Address");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe("Primary residence - mailing and billing address");

    // Fields
    expect(getField(cipher, "address")?.value).toBe(
      "742 Evergreen Terrace, Apt 3B, Springfield, Oregon, 97477, US",
    );
  });

  it("should parse bankAccount", () => {
    const cipher = findCipher(result, "Wells Fargo Checking");
    expect(cipher.type).toBe(CipherType.Login);

    // Properties
    expect(cipher.notes).toBe("Primary checking account for direct deposit and bill payments");
    expect(cipher.login.username).toBe("m.thompson@email.com");
    expect(cipher.login.password).toBe("BankS3cur3!Pass");
    expect(cipher.login.totp).toContain("otpauth://totp/");

    // Fields
    expect(getField(cipher, "bankAccount")?.value).toBe(
      "Type: Checking, Account Number: 8472651938, Routing Number: 121000248",
    );
    expect(getField(cipher, "name")?.value).toBe("Michael James Thompson");
  });

  it("should parse bankAccount with other type", () => {
    const cipher = findCipher(result, "Other bank");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Fields
    expect(getField(cipher, "bankAccount")?.value).toBe("Type: Crypto, Account Number: 12345678");
    expect(getField(cipher, "name")?.value).toBe("Mark Zwei");
  });

  it("should parse bankCard", () => {
    const cipher = findCipher(result, "Chase Visa");
    expect(cipher.type).toBe(CipherType.Card);

    // Properties
    expect(cipher.notes).toBe("Primary credit card for everyday purchases and rewards");
    expect(cipher.card.number).toBe("4532123456789010");
    expect(cipher.card.cardholderName).toBe("Sarah Johnson");
    expect(cipher.card.brand).toBe("Visa");
    expect(cipher.card.expMonth).toBe("06");
    expect(cipher.card.expYear).toBe("2030");

    // Fields
    expect(cipher.fields.length).toBe(3);
    expect(getField(cipher, "PIN")?.value).toBe("8426");
    expect(getField(cipher, "PIN")?.type).toBe(FieldType.Hidden);
    expect(
      getFields(cipher, "URL")
        .map((x) => x.value)
        .sort(),
    ).toEqual(["https://bank.card/test", "https://bank.card/test/with/label"]);
  });

  it("should parse birthCertificate", () => {
    const cipher = findCipher(result, "John Doe Birth Certificate");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe("Official birth certificate for identification purposes");

    // Fields
    expect(cipher.fields.length).toBe(2);
    expect(getField(cipher, "name")?.value).toBe("John Michael Doe");
    expect(getField(cipher, "birthDate")?.value).toBe("5/15/1990, 12:00:00 AM");
  });

  it("should parse contact", () => {
    const cipher = findCipher(result, "Dr. Emily Chen");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe("Primary care physician - office visits and consultations");

    // Fields
    expect(getField(cipher, "name")?.value).toBe("Emily Marie Chen");
    expect(getField(cipher, "company")?.value).toBe("Springfield Medical Center");
    expect(getField(cipher, "email")?.value).toBe("emily.chen@smc.org");
    expect(getField(cipher, "phone")?.value).toBe("(AF) 5415558723 ext. 5577 (Work)");

    expect(getField(cipher, "address")?.value).toBe(
      "1428 Elm Street, Suite 200, Portland, Oregon, 97204, US",
    );
  });

  it("should parse databaseCredentials", () => {
    const cipher = findCipher(result, "Production MySQL Database");
    expect(cipher.type).toBe(CipherType.Login);

    // Properties
    expect(cipher.notes).toBe("Production database server for main application - handle with care");
    expect(cipher.login.username).toBe("db_admin");
    expect(cipher.login.password).toBe("SecureDb#2024$Pass");

    // Fields
    expect(cipher.fields.length).toBe(3);
    expect(getField(cipher, "type")?.value).toBe("MySQL");
    expect(getField(cipher, "Hostname")?.value).toBe("db.production.company.com");
    expect(getField(cipher, "Port")?.value).toBe("3306");
  });

  it("should parse driverLicense", () => {
    const cipher = findCipher(result, "Oregon Driver's License");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe("Valid Oregon driver's license - Class C");

    // Fields
    expect(cipher.fields.length).toBe(4);
    expect(getField(cipher, "dlNumber")?.value).toBe("DL-7482693");
    expect(getField(cipher, "name")?.value).toBe("Robert William Anderson");
    expect(getField(cipher, "birthDate")?.value).toBe("3/15/1985, 12:00:00 AM");
    expect(getField(cipher, "expirationDate")?.value).toBe("3/15/2028, 12:00:00 AM");
  });

  it("should parse encryptedNotes", () => {
    const cipher = findCipher(result, "Important Meeting Notes");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe(
      "Confidential meeting with executive team - requires follow-up by end of month",
    );

    // Fields
    expect(cipher.fields.length).toBe(2);
    expect(getField(cipher, "note")?.value).toBe(
      "Q4 2024 Strategic Planning - Discussed budget allocations, team restructuring, and new product launch timeline",
    );
    expect(getField(cipher, "date")?.value).toBe("10/15/2024, 12:00:00 AM");
  });

  it("should parse file", () => {
    const cipher = findCipher(result, "Project Proposal Document");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe(
      "Annual project proposal for Q1 2025 business development initiatives",
    );

    // Fields
    expect(cipher.fields.length).toBe(0);
  });

  it("should parse general", () => {
    const cipher = findCipher(result, "General Information Record");
    expect(cipher.type).toBe(CipherType.Login);

    // Properties
    expect(cipher.notes).toBe(
      "General purpose record for miscellaneous information and credentials",
    );
    expect(cipher.login.username).toBe("general_user@example.com");
    expect(cipher.login.password).toBe("GeneralPass#2024!Secure");
    expect(cipher.login.uri).toBe("https://general.example.com");
    expect(cipher.login.totp).toContain("otpauth://totp/");

    // Fields
    expect(cipher.fields.length).toBe(0);
  });

  it("should parse healthInsurance", () => {
    const cipher = findCipher(result, "Blue Cross Blue Shield");
    expect(cipher.type).toBe(CipherType.Login);

    // Properties
    expect(cipher.notes).toBe("PPO plan with nationwide coverage - family deductible $2500");
    expect(cipher.login.username).toBe("david.martinez@email.com");
    expect(cipher.login.password).toBe("Health$ecure789");
    expect(cipher.login.uri).toBe("https://www.bcbs.com");

    // Fields
    expect(cipher.fields.length).toBe(2);
    expect(getField(cipher, "accountNumber")?.value).toBe("BCBS-12345678");
    expect(getField(cipher, "insuredsName")?.value).toBe("David Alan Martinez");
  });

  it("should parse login", () => {
    const cipher = findCipher(result, "Amazon Account");
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.login.totp).toContain("otpauth://totp/");

    // Properties
    expect(cipher.notes).toBe("Primary Amazon account for online shopping and Prime membership");
    expect(cipher.login.username).toBe("john.martinez@email.com");
    expect(cipher.login.password).toBe("Sp@rkl3Sun!2024");
    expect(cipher.login.uri).toBe("https://www.amazon.com");
    expect(cipher.login.uris.map((x) => x.uri)).toEqual([
      "https://www.amazon.com",
      "https://login.amazon.com",
      "https://logout.amazon.com",
      "https://account.amazon.com",
      "https://profile.amazon.com",
    ]);

    // Fields
    expect(cipher.fields.length).toBe(17);

    // 1
    expect(getField(cipher, "some label")?.value).toBe("some text");

    // 2
    expect(getField(cipher, "some more text")?.value).toBe(
      "some lines\nsome more lines\nblah blah blah",
    );

    // 3
    expect(getField(cipher, "pin-pin-pin")?.value).toBe("1234");
    expect(getField(cipher, "pin-pin-pin")?.type).toBe(FieldType.Hidden);

    // 4-9
    const questions = getFields(cipher, "Security question");
    expect(questions.map((x) => x.value)).toEqual([
      "how old were you when you were born?",
      "how are you?",
      "how old are you?",
    ]);
    const answers = getFields(cipher, "Security question answer");
    expect(answers.map((x) => x.value)).toEqual(["zero", "good, thanks!", "five"]);
    expect(answers.map((x) => x.type)).toEqual([
      FieldType.Hidden,
      FieldType.Hidden,
      FieldType.Hidden,
    ]);

    // 10-11
    const phones = getFields(cipher, "phone");
    expect(phones.map((x) => x.value)).toEqual([
      "(AZ) 123123123 (Home)",
      "(CZ) 555555555 ext. 444",
    ]);

    // 12
    expect(getField(cipher, "some date")?.value).toBe("11/30/2025, 9:50:48 PM");

    // 13
    expect(getField(cipher, "email")?.value).toBe("blah@blah.com");

    // 14
    expect(getField(cipher, "someone")?.value).toBe("Maria Smith");

    // 15
    expect(getField(cipher, "special secret")?.value).toBe("big secret");
    expect(getField(cipher, "special secret")?.type).toBe(FieldType.Hidden);

    // 16-17: resolved address references
    expect(
      getFields(cipher, "address")
        .map((x) => x.value)
        .sort(),
    ).toEqual([
      "1428 Elm Street, Suite 200, Portland, Oregon, 97204, US",
      "742 Evergreen Terrace, Apt 3B, Springfield, Oregon, 97477, US",
    ]);
  });

  it("should parse membership", () => {
    const cipher = findCipher(result, "LA Fitness Gym");
    expect(cipher.type).toBe(CipherType.Login);

    // Properties
    expect(cipher.notes).toBe("Annual membership - full gym access including pool and classes");

    // Fields
    expect(cipher.fields.length).toBe(2);
    expect(getField(cipher, "accountNumber")?.value).toBe("LAF-987654321");
    expect(getField(cipher, "name")?.value).toBe("Lisa Marie Rodriguez");
  });

  it("should parse passport", () => {
    const cipher = findCipher(result, "US Passport");
    expect(cipher.type).toBe(CipherType.Login);

    // Properties
    expect(cipher.notes).toBe("Valid US passport for international travel");

    // Fields
    expect(cipher.fields.length).toBe(5);
    expect(getField(cipher, "passportNumber")?.value).toBe("543826194");
    expect(getField(cipher, "name")?.value).toBe("Jennifer Lynn Williams");
    expect(getField(cipher, "birthDate")?.value).toBe("7/22/1990, 12:00:00 AM");
    expect(getField(cipher, "expirationDate")?.value).toBe("7/22/2033, 12:00:00 AM");
    expect(getField(cipher, "dateIssued")?.value).toBe("8/15/2023, 12:00:00 AM");
  });

  it("should parse photo", () => {
    const cipher = findCipher(result, "Family Vacation 2024");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe("Summer vacation photos from Hawaii trip - scenic beach views");

    // Fields
    expect(cipher.fields.length).toBe(0);
  });

  it("should parse serverCredentials", () => {
    const cipher = findCipher(result, "Web Server - Production");
    expect(cipher.type).toBe(CipherType.Login);

    // Properties
    expect(cipher.notes).toBe("Primary production web server - Apache 2.4.52 - Ubuntu 22.04");
    expect(cipher.login.username).toBe("sysadmin");
    expect(cipher.login.password).toBe("Srv#Prod2024!Sec");

    // Fields
    expect(cipher.fields.length).toBe(2);
    expect(getField(cipher, "Hostname")?.value).toBe("web01.company.com");
    expect(getField(cipher, "Port")?.value).toBe("22");
  });

  it("should parse softwareLicense", () => {
    const cipher = findCipher(result, "Adobe Creative Cloud");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe(
      "Annual subscription - full access to Photoshop, Illustrator, Premiere Pro",
    );

    // Fields
    expect(cipher.fields.length).toBe(3);
    expect(getField(cipher, "licenseNumber")?.value).toBe("ACDB-7849-2635-1947-8520");
    expect(getField(cipher, "expirationDate")?.value).toBe("12/31/2025, 12:00:00 AM");
    expect(getField(cipher, "dateActive")?.value).toBe("1/15/2024, 12:00:00 AM");
  });

  it("should parse sshKeys", () => {
    const cipher = findCipher(result, "Production Server SSH Key");
    expect(cipher.type).toBe(CipherType.SshKey);

    // Properties
    expect(cipher.notes).toBe("SSH key for production server deployment - RSA 2048 bit");

    // Fields
    expect(cipher.fields.length).toBe(3);
    expect(getField(cipher, "Username")?.value).toBe("deploy_user");
    expect(getField(cipher, "Hostname")?.value).toBe("prod-server.company.com");
    expect(getField(cipher, "Port")?.value).toBe("22");
  });

  it("should parse sshKeys with a passphrase", () => {
    const cipher = findCipher(result, "Production Server SSH Key with a passphrase");
    expect(cipher.type).toBe(CipherType.SshKey);

    // Properties
    expect(cipher.notes).toBe("SSH key for production server deployment - RSA 2048 bit");

    // Fields
    expect(cipher.fields.length).toBe(4);
    expect(getField(cipher, "Username")?.value).toBe("deploy_user");
    expect(getField(cipher, "Password")?.value).toBe("blah-blah-blah");
    expect(getField(cipher, "Password")?.type).toBe(FieldType.Hidden);
    expect(getField(cipher, "Hostname")?.value).toBe("prod-server.company.com");
    expect(getField(cipher, "Port")?.value).toBe("22");
  });

  it("should parse an invalid ssh key as login", () => {
    const cipher = findCipher(result, "Invalid SSH key");
    // TODO: Invalid SSH key falls back to Login (has username/password) rather than SecureNote. This is different from JSON importer.
    expect(cipher.type).toBe(CipherType.Login);

    // Properties
    expect(cipher.notes).toBe("Broken ssh key");
    expect(cipher.login.username).toBe("deploy_user");
    expect(cipher.login.password).toBe("blah-blah-blah");

    // Fields
    expect(cipher.fields.length).toBe(5);
    expect(getField(cipher, "Passphrase")?.value).toBe("blah-blah-blah");
    expect(getField(cipher, "Public key")?.value).toBe("blah blah public key");
    expect(getField(cipher, "Private key")?.value).toBe("blah blah blah private key");
    expect(getField(cipher, "Hostname")?.value).toBe("prod-server.company.com");
    expect(getField(cipher, "Port")?.value).toBe("22");
  });

  it("should parse ssnCard", () => {
    const cipher = findCipher(result, "National Identity Card");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe("National identification card - Valid through 2028");

    // Fields
    expect(cipher.fields.length).toBe(2);
    expect(getField(cipher, "identityNumber")?.value).toBe("ID-7849521");
    expect(getField(cipher, "name")?.value).toBe("Sarah Elizabeth Johnson");
  });

  // TODO: wifiCredentials record ("Home Wi-Fi") is not present in the vault fixture

  it("should create folders and assign ciphers to them", () => {
    const folders = result.folders;
    expect(folders.length).toBe(33);

    const folderNames = folders.map((f) => f.name).sort((a, b) => a.localeCompare(b));
    expect(folderNames).toEqual(allFolderNames);

    // No collections should be created outside of org context
    expect(result.collections.length).toBe(0);

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

  //
  // Helpers
  //

  function findCipher(r: ImportResult, name: string): CipherView {
    const cipher = r.ciphers.find((c) => c.name === name);
    if (!cipher) {
      throw new Error(`Cipher not found: ${name}`);
    }
    return cipher;
  }

  function getField(cipher: CipherView, name: string): FieldView | undefined {
    return cipher.fields?.find((f) => f.name === name);
  }

  function getFields(cipher: CipherView, name: string): FieldView[] {
    return cipher.fields?.filter((f) => f.name === name) ?? [];
  }

  function assertInFolder(r: ImportResult, cipherName: string, folderName: string): void {
    const cipherIndex = r.ciphers.findIndex((c) => c.name === cipherName);
    expect(cipherIndex).toBeGreaterThanOrEqual(0);

    const folderIndex = r.folders.findIndex((f) => f.name === folderName);
    expect(folderIndex).toBeGreaterThanOrEqual(0);

    const hasRelationship = r.folderRelationships.some(
      ([ci, fi]) => ci === cipherIndex && fi === folderIndex,
    );
    expect(hasRelationship).toBe(true);
  }

  //
  // Test data
  //

  const allFolderNames = [
    "Clients",
    "Clients/Enterprise",
    "Clients/Enterprise/North America",
    "Clients/Enterprise/North America/TechCorp",
    "Dev build ",
    "Dev build /dfdfgh",
    "Development",
    "Development/Name-with-both-slashes",
    "Development/Name-with-both-slashes/Android",
    "Development/Name-with-both-slashes/Name-with-forward-slashes",
    "Development/Name-with-both-slashes/Name-with-forward-slashes/Name-with-backslashes",
    "Development/Web",
    "Education",
    "Inheritance",
    "Inheritance/name change-folder",
    "Inheritance/Sub-inheritance",
    "Marketing",
    "Marketing/Social Media",
    "Marketing/Social Media/Cards",
    "Personal",
    "Personal/Finance",
    "Personal/Finance/Banking",
    "Personal/Finance/Banking/Accounts",
    "Shared Project Folder",
    "Transferred: Account",
    "Transferred: Account/Test Item",
    "Transferred: garrisonconsultinguser@gmail.com",
    "Transferred: garrisonconsultinguser@gmail.com/Marketing",
    "Work",
    "Work/Documents",
    "Work/Projects",
    "Work/Projects/2025",
    "Work/Projects/2025/Q4",
  ];
});
