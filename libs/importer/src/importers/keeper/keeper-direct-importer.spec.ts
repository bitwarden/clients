/**
 * @jest-environment node
 */
import { fromBinary } from "@bufbuild/protobuf";

import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { ImportResult } from "../../models";
import * as fixture from "../spec-data/keeper-direct/sync-down-fixture.json";

import { Vault } from "./access";
import { SyncDownResponseSchema } from "./access/generated/sync-down_pb";
import { VaultField, VaultItem, VaultRecordError, VaultRecordErrorReason } from "./access/models";
import { KeeperDirectImporter } from "./keeper-direct-importer";
import { ImportRecordError, ImportRecordErrorReason } from "./keeper-import-error";

describe("Keeper Direct Importer", () => {
  let vault: Vault;
  let result: ImportResult;
  let errors: ImportRecordError[];

  beforeAll(async () => {
    // Pin locale and timezone so date formatting is machine-independent. In production we use the user's locale and timezone.
    const originalToLocaleString = Date.prototype.toLocaleString;
    jest.spyOn(Date.prototype, "toLocaleString").mockImplementation(function (
      this: Date,
      ...args: Parameters<Date["toLocaleString"]>
    ) {
      if (args.length === 0) {
        return originalToLocaleString.call(this, "en-US", { timeZone: "UTC" });
      }
      return originalToLocaleString.apply(this, args);
    });

    jest.spyOn(console, "warn").mockImplementation();

    const response = fromBinary(SyncDownResponseSchema, Buffer.from(fixture.response, "base64"));
    vault = await (Vault as any).processMergedSyncDownPages(
      response,
      new Uint8Array(Buffer.from(fixture.masterKey, "base64")),
    );

    const importer = new KeeperDirectImporter();
    ({ result, errors } = importer.convertVaultToImportResult(vault));
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
    expect(getField(cipher, "birthDate")?.value).toBe("5/14/1990, 10:00:00 PM");
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
    expect(cipher.type).toBe(CipherType.Identity);

    // Properties
    expect(cipher.notes).toBe("Valid Oregon driver's license - Class C");
    expect(cipher.identity.licenseNumber).toBe("DL-7482693");
    expect(cipher.identity.firstName).toBe("Robert");
    expect(cipher.identity.middleName).toBe("William");
    expect(cipher.identity.lastName).toBe("Anderson");

    // Fields
    expect(cipher.fields.length).toBe(2);
    expect(getField(cipher, "birthDate")?.value).toBe("3/14/1985, 11:00:00 PM");
    expect(getField(cipher, "expirationDate")?.value).toBe("3/14/2028, 11:00:00 PM");
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
    expect(getField(cipher, "date")?.value).toBe("10/14/2024, 10:00:00 PM");
  });

  it("should not import file records and report them as unsupported", () => {
    expect(result.ciphers.find((c) => c.name === "Project Proposal Document")).toBeUndefined();
    expect(
      errors.some((e) => e.reason === ImportRecordErrorReason.UnsupportedType && e.type === "file"),
    ).toBe(true);
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
    expect(getField(cipher, "some date")?.value).toBe("11/30/2025, 8:50:48 PM");

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
    expect(cipher.type).toBe(CipherType.Identity);

    // Properties
    expect(cipher.notes).toBe("Valid US passport for international travel");
    expect(cipher.identity.passportNumber).toBe("543826194");
    expect(cipher.identity.firstName).toBe("Jennifer");
    expect(cipher.identity.middleName).toBe("Lynn");
    expect(cipher.identity.lastName).toBe("Williams");

    // Fields
    expect(cipher.fields.length).toBe(4);
    expect(getField(cipher, "Password")?.value).toBe("Passport2023!Secure");
    expect(getField(cipher, "Password")?.type).toBe(FieldType.Hidden);
    expect(getField(cipher, "birthDate")?.value).toBe("7/21/1990, 10:00:00 PM");
    expect(getField(cipher, "expirationDate")?.value).toBe("7/21/2033, 10:00:00 PM");
    expect(getField(cipher, "dateIssued")?.value).toBe("8/14/2023, 10:00:00 PM");
  });

  it("should not import photo records and report them as unsupported", () => {
    expect(result.ciphers.find((c) => c.name === "Family Vacation 2024")).toBeUndefined();
    expect(
      errors.some(
        (e) => e.reason === ImportRecordErrorReason.UnsupportedType && e.type === "photo",
      ),
    ).toBe(true);
  });

  it("should report exactly the file and photo records as unsupported entry types", () => {
    const unsupported = errors.filter((e) => e.reason === ImportRecordErrorReason.UnsupportedType);
    expect(unsupported.map((e) => e.type).sort()).toEqual(["file", "photo"]);
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
    expect(getField(cipher, "expirationDate")?.value).toBe("12/30/2025, 11:00:00 PM");
    expect(getField(cipher, "dateActive")?.value).toBe("1/14/2024, 11:00:00 PM");
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

  it("should parse an invalid ssh key as a secure note", () => {
    const cipher = findCipher(result, "Invalid SSH key");
    expect(cipher.type).toBe(CipherType.SecureNote);

    // Properties
    expect(cipher.notes).toBe("Broken ssh key");

    // Fields
    expect(cipher.fields.length).toBe(6);
    expect(getField(cipher, "Username")?.value).toBe("deploy_user");
    expect(getField(cipher, "Passphrase")?.value).toBe("blah-blah-blah");
    expect(getField(cipher, "Passphrase")?.type).toBe(FieldType.Hidden);
    expect(getField(cipher, "Public key")?.value).toBe("blah blah public key");
    expect(getField(cipher, "Private key")?.value).toBe("blah blah blah private key");
    expect(getField(cipher, "Hostname")?.value).toBe("prod-server.company.com");
    expect(getField(cipher, "Port")?.value).toBe("22");
  });

  it("should parse ssnCard", () => {
    const cipher = findCipher(result, "National Identity Card");
    expect(cipher.type).toBe(CipherType.Identity);

    // Properties
    expect(cipher.notes).toBe("National identification card - Valid through 2028");
    expect(cipher.identity.ssn).toBe("ID-7849521");
    expect(cipher.identity.firstName).toBe("Sarah");
    expect(cipher.identity.middleName).toBe("Elizabeth");
    expect(cipher.identity.lastName).toBe("Johnson");

    // Fields
    expect(cipher.fields.length).toBe(0);
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

describe("Keeper Direct Importer error handling", () => {
  function buildItem(overrides: Partial<VaultItem> & { id: string }): VaultItem {
    return {
      type: "login",
      title: "",
      notes: "",
      fields: [],
      custom: [],
      folders: [],
      ...overrides,
    };
  }

  function importWith(items: VaultItem[], vaultErrors: VaultRecordError[]) {
    const vault = new (Vault as any)(items, vaultErrors) as Vault;
    return new KeeperDirectImporter().convertVaultToImportResult(vault);
  }

  it("maps an UnsupportedVersion vault error to UnsupportedFeature with the UID as name", () => {
    const { errors } = importWith(
      [],
      [{ id: "uid-1", reason: VaultRecordErrorReason.UnsupportedVersion }],
    );

    expect(errors).toContainEqual(
      new ImportRecordError("uid-1", ImportRecordErrorReason.UnsupportedFeature),
    );
  });

  it("maps a DecryptionFailed vault error to a generic error with the UID as name", () => {
    const { errors } = importWith(
      [],
      [{ id: "uid-2", reason: VaultRecordErrorReason.DecryptionFailed }],
    );

    expect(errors).toContainEqual(new ImportRecordError("uid-2", ImportRecordErrorReason.Error));
  });

  it("maps a FolderDecryptionFailed vault error and still imports the affected record at the root", () => {
    // The folder name could not be decrypted, so the record arrives with no folder path (root).
    const item = buildItem({ id: "rec-1", title: "Rootless Record", folders: [] });
    const { result, errors } = importWith(
      [item],
      [{ id: "folder-uid", reason: VaultRecordErrorReason.FolderDecryptionFailed }],
    );

    expect(errors).toContainEqual(
      new ImportRecordError("folder-uid", ImportRecordErrorReason.FolderDecryptionFailed),
    );

    const cipher = result.ciphers.find((c) => c.name === "Rootless Record");
    expect(cipher).toBeDefined();
    expect(result.folderRelationships.length).toBe(0);
  });

  it("collects a single error for a record that throws mid-parse without aborting the others", () => {
    const throwingItem = {
      id: "throws",
      type: "login",
      title: "Throwing Record",
      notes: "",
      custom: [],
      folders: ["FolderA"],
      get fields(): VaultField[] {
        throw new Error("Simulated parse failure");
      },
    } as unknown as VaultItem;

    const goodItem = buildItem({ id: "good", title: "Good Record", folders: ["FolderB"] });

    const { result, errors } = importWith([throwingItem, goodItem], []);

    // The throwing record produces exactly one generic error.
    expect(errors).toContainEqual(
      new ImportRecordError("throws", ImportRecordErrorReason.Error, "login"),
    );
    expect(errors.filter((e) => e.reason === ImportRecordErrorReason.Error).length).toBe(1);

    // The good record still imports.
    const goodIndex = result.ciphers.findIndex((c) => c.name === "Good Record");
    expect(goodIndex).toBeGreaterThanOrEqual(0);

    // The throwing record's folder is never created, so no relationship leaks onto the good record.
    expect(result.folders.some((f) => f.name === "FolderA")).toBe(false);
    const folderBIndex = result.folders.findIndex((f) => f.name === "FolderB");
    expect(folderBIndex).toBeGreaterThanOrEqual(0);
    expect(result.folderRelationships).toEqual([[goodIndex, folderBIndex]]);
  });
});
