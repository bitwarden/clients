import { CipherType } from "@bitwarden/common/vault/enums";

import { DashlaneCsvImporter } from "..";
import { credentialsData_otpUrl } from "../spec-data/dashlane-csv/credentials-otpurl.csv";
import { credentialsData } from "../spec-data/dashlane-csv/credentials.csv";
import { identityData } from "../spec-data/dashlane-csv/id.csv";
import { multiplePersonalInfoData } from "../spec-data/dashlane-csv/multiple-personal-info.csv";
import { paymentsData } from "../spec-data/dashlane-csv/payments.csv";
import { personalInfoData } from "../spec-data/dashlane-csv/personal-info.csv";
import { secureNoteData } from "../spec-data/dashlane-csv/securenotes.csv";

describe("Dashlane CSV Importer", () => {
  let importer: DashlaneCsvImporter;
  beforeEach(() => {
    importer = new DashlaneCsvImporter();
  });

  it("should parse login records", async () => {
    const result = await importer.parse(credentialsData);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("example.com");
    expect(cipher.login.username).toEqual("jdoe");
    expect(cipher.login.password).toEqual("somePassword");
    expect(cipher.login.totp).toEqual("someTOTPSeed");
    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("https://www.example.com");
    expect(cipher.notes).toEqual("some note for example.com");
  });

  it("should parse login with totp when given otpUrl instead of otpSecret", async () => {
    const result = await importer.parse(credentialsData_otpUrl);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.login.totp).toEqual("anotherTOTPSeed");
  });

  it("should parse an item and create a folder", async () => {
    const result = await importer.parse(credentialsData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.folders.length).toBe(1);
    expect(result.folders[0].name).toBe("Entertainment");
    expect(result.folderRelationships[0]).toEqual([0, 0]);
  });

  it("should parse payment records", async () => {
    const result = await importer.parse(paymentsData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(2);

    // Account
    const cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.Card);
    expect(cipher.name).toBe("John's savings account");
    expect(cipher.card.brand).toBeNull();
    expect(cipher.card.cardholderName).toBe("John Doe");
    expect(cipher.card.number).toBe("accountNumber");
    expect(cipher.card.code).toBeNull();
    expect(cipher.card.expMonth).toBeNull();
    expect(cipher.card.expYear).toBeNull();

    expect(cipher.fields.length).toBe(4);

    expect(cipher.fields[0].name).toBe("type");
    expect(cipher.fields[0].value).toBe("bank");

    expect(cipher.fields[1].name).toBe("routing_number");
    expect(cipher.fields[1].value).toBe("routingNumber");

    expect(cipher.fields[2].name).toBe("country");
    expect(cipher.fields[2].value).toBe("US");

    expect(cipher.fields[3].name).toBe("issuing_bank");
    expect(cipher.fields[3].value).toBe("US-ALLY");

    // CreditCard
    const cipher2 = result.ciphers.shift();
    expect(cipher2.type).toBe(CipherType.Card);
    expect(cipher2.name).toBe("John Doe");
    expect(cipher2.card.brand).toBe("Visa");
    expect(cipher2.card.cardholderName).toBe("John Doe");
    expect(cipher2.card.number).toBe("41111111111111111");
    expect(cipher2.card.code).toBe("123");
    expect(cipher2.card.expMonth).toBe("1");
    expect(cipher2.card.expYear).toBe("2023");

    expect(cipher2.fields.length).toBe(2);

    expect(cipher2.fields[0].name).toBe("type");
    expect(cipher2.fields[0].value).toBe("credit_card");

    expect(cipher2.fields[1].name).toBe("country");
    expect(cipher2.fields[1].value).toBe("US");
  });

  it("should parse ids records", async () => {
    const result = await importer.parse(identityData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);

    // Type card
    const cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.Identity);
    expect(cipher.name).toBe("John Doe card");
    expect(cipher.identity.fullName).toBe("John Doe");
    expect(cipher.identity.firstName).toBe("John");
    expect(cipher.identity.middleName).toBeNull();
    expect(cipher.identity.lastName).toBe("Doe");
    expect(cipher.identity.licenseNumber).toBe("123123123");

    expect(cipher.fields.length).toBe(3);

    expect(cipher.fields[0].name).toEqual("type");
    expect(cipher.fields[0].value).toEqual("card");

    expect(cipher.fields[1].name).toEqual("issue_date");
    expect(cipher.fields[1].value).toEqual("2022-1-30");

    expect(cipher.fields[2].name).toEqual("expiration_date");
    expect(cipher.fields[2].value).toEqual("2032-1-30");

    // Type passport
    const cipher2 = result.ciphers.shift();
    expect(cipher2.type).toBe(CipherType.Identity);
    expect(cipher2.name).toBe("John Doe passport");
    expect(cipher2.identity.fullName).toBe("John Doe");
    expect(cipher2.identity.firstName).toBe("John");
    expect(cipher2.identity.middleName).toBeNull();
    expect(cipher2.identity.lastName).toBe("Doe");
    expect(cipher2.identity.passportNumber).toBe("123123123");

    expect(cipher2.fields.length).toBe(4);

    expect(cipher2.fields[0].name).toEqual("type");
    expect(cipher2.fields[0].value).toEqual("passport");
    expect(cipher2.fields[1].name).toEqual("issue_date");
    expect(cipher2.fields[1].value).toEqual("2022-1-30");
    expect(cipher2.fields[2].name).toEqual("expiration_date");
    expect(cipher2.fields[2].value).toEqual("2032-1-30");
    expect(cipher2.fields[3].name).toEqual("place_of_issue");
    expect(cipher2.fields[3].value).toEqual("somewhere in Germany");

    // Type license
    const cipher3 = result.ciphers.shift();
    expect(cipher3.type).toBe(CipherType.Identity);
    expect(cipher3.name).toBe("John Doe license");
    expect(cipher3.identity.fullName).toBe("John Doe");
    expect(cipher3.identity.firstName).toBe("John");
    expect(cipher3.identity.middleName).toBeNull();
    expect(cipher3.identity.lastName).toBe("Doe");
    expect(cipher3.identity.licenseNumber).toBe("1234556");
    expect(cipher3.identity.state).toBe("DC");

    expect(cipher3.fields.length).toBe(3);
    expect(cipher3.fields[0].name).toEqual("type");
    expect(cipher3.fields[0].value).toEqual("license");
    expect(cipher3.fields[1].name).toEqual("issue_date");
    expect(cipher3.fields[1].value).toEqual("2022-8-10");
    expect(cipher3.fields[2].name).toEqual("expiration_date");
    expect(cipher3.fields[2].value).toEqual("2022-10-10");

    // Type social_security
    const cipher4 = result.ciphers.shift();
    expect(cipher4.type).toBe(CipherType.Identity);
    expect(cipher4.name).toBe("John Doe social_security");
    expect(cipher4.identity.fullName).toBe("John Doe");
    expect(cipher4.identity.firstName).toBe("John");
    expect(cipher4.identity.middleName).toBeNull();
    expect(cipher4.identity.lastName).toBe("Doe");
    expect(cipher4.identity.ssn).toBe("123123123");

    expect(cipher4.fields.length).toBe(1);
    expect(cipher4.fields[0].name).toEqual("type");
    expect(cipher4.fields[0].value).toEqual("social_security");

    // Type tax_number
    const cipher5 = result.ciphers.shift();
    expect(cipher5.type).toBe(CipherType.Identity);
    expect(cipher5.name).toBe("tax_number");
    expect(cipher5.identity.licenseNumber).toBe("123123123");

    expect(cipher5.fields.length).toBe(1);
    expect(cipher5.fields[0].name).toEqual("type");
    expect(cipher5.fields[0].value).toEqual("tax_number");
  });

  it("should parse secureNote records", async () => {
    const result = await importer.parse(secureNoteData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.SecureNote);
    expect(cipher.name).toBe("01");
    expect(cipher.notes).toBe("test");
  });

  it("should parse personal information records (multiple identities)", async () => {
    const result = await importer.parse(multiplePersonalInfoData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(6);

    // name
    const cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.SecureNote);
    expect(cipher.name).toBe("MR John Doe");

    expect(cipher.fields.length).toBe(7);
    expect(cipher.fields[0].name).toEqual("type");
    expect(cipher.fields[0].value).toEqual("name");
    expect(cipher.fields[1].name).toEqual("title");
    expect(cipher.fields[1].value).toEqual("MR");
    expect(cipher.fields[2].name).toEqual("first_name");
    expect(cipher.fields[2].value).toEqual("John");
    expect(cipher.fields[3].name).toEqual("last_name");
    expect(cipher.fields[3].value).toEqual("Doe");
    expect(cipher.fields[4].name).toEqual("login");
    expect(cipher.fields[4].value).toEqual("jdoe");
    expect(cipher.fields[5].name).toEqual("date_of_birth");
    expect(cipher.fields[5].value).toEqual("2022-01-30");
    expect(cipher.fields[6].name).toEqual("place_of_birth");
    expect(cipher.fields[6].value).toEqual("world");

    // email
    const cipher2 = result.ciphers.shift();
    expect(cipher2.type).toBe(CipherType.SecureNote);
    expect(cipher2.name).toBe("Johns email");

    expect(cipher2.fields.length).toBe(4);
    expect(cipher2.fields[0].name).toEqual("type");
    expect(cipher2.fields[0].value).toEqual("email");
    expect(cipher2.fields[1].name).toEqual("email");
    expect(cipher2.fields[1].value).toEqual("jdoe@example.com");
    expect(cipher2.fields[2].name).toEqual("email_type");
    expect(cipher2.fields[2].value).toEqual("personal");
    expect(cipher2.fields[3].name).toEqual("item_name");
    expect(cipher2.fields[3].value).toEqual("Johns email");

    // number
    const cipher3 = result.ciphers.shift();
    expect(cipher3.type).toBe(CipherType.SecureNote);
    expect(cipher3.name).toBe("John's number");

    expect(cipher3.fields.length).toBe(3);
    expect(cipher3.fields[0].name).toEqual("type");
    expect(cipher3.fields[0].value).toEqual("number");
    expect(cipher3.fields[1].name).toEqual("item_name");
    expect(cipher3.fields[1].value).toEqual("John's number");
    expect(cipher3.fields[2].name).toEqual("phone_number");
    expect(cipher3.fields[2].value).toEqual("+49123123123");

    // address
    const cipher4 = result.ciphers.shift();
    expect(cipher4.type).toBe(CipherType.SecureNote);
    expect(cipher4.name).toBe("John's home address");

    expect(cipher4.fields.length).toBe(12);
    expect(cipher4.fields[0].name).toEqual("type");
    expect(cipher4.fields[0].value).toEqual("address");
    expect(cipher4.fields[1].name).toEqual("item_name");
    expect(cipher4.fields[1].value).toEqual("John's home address");
    expect(cipher4.fields[2].name).toEqual("address");
    expect(cipher4.fields[2].value).toEqual("1 some street");
    expect(cipher4.fields[3].name).toEqual("country");
    expect(cipher4.fields[3].value).toEqual("de");
    expect(cipher4.fields[4].name).toEqual("state");
    expect(cipher4.fields[4].value).toEqual("DE-0-NW");
    expect(cipher4.fields[5].name).toEqual("city");
    expect(cipher4.fields[5].value).toEqual("some city");
    expect(cipher4.fields[6].name).toEqual("zip");
    expect(cipher4.fields[6].value).toEqual("123123");
    expect(cipher4.fields[7].name).toEqual("address_recipient");
    expect(cipher4.fields[7].value).toEqual("John");
    expect(cipher4.fields[8].name).toEqual("address_building");
    expect(cipher4.fields[8].value).toEqual("1");
    expect(cipher4.fields[9].name).toEqual("address_apartment");
    expect(cipher4.fields[9].value).toEqual("1");
    expect(cipher4.fields[10].name).toEqual("address_floor");
    expect(cipher4.fields[10].value).toEqual("1");
    expect(cipher4.fields[11].name).toEqual("address_door_code");
    expect(cipher4.fields[11].value).toEqual("123");

    // website
    const cipher5 = result.ciphers.shift();
    expect(cipher5.type).toBe(CipherType.SecureNote);
    expect(cipher5.name).toBe("Website");

    expect(cipher5.fields.length).toBe(3);
    expect(cipher5.fields[0].name).toEqual("type");
    expect(cipher5.fields[0].value).toEqual("website");
    expect(cipher5.fields[1].name).toEqual("item_name");
    expect(cipher5.fields[1].value).toEqual("Website");
    expect(cipher5.fields[2].name).toEqual("url");
    expect(cipher5.fields[2].value).toEqual("website.com");

    // 2nd name/identity
    const cipher6 = result.ciphers.shift();
    expect(cipher6.type).toBe(CipherType.SecureNote);
    expect(cipher6.name).toBe("Mrs Jane Doe");

    expect(cipher6.fields.length).toBe(7);
    expect(cipher6.fields[0].name).toEqual("type");
    expect(cipher6.fields[0].value).toEqual("name");
    expect(cipher6.fields[1].name).toEqual("title");
    expect(cipher6.fields[1].value).toEqual("Mrs");
    expect(cipher6.fields[2].name).toEqual("first_name");
    expect(cipher6.fields[2].value).toEqual("Jane");
    expect(cipher6.fields[3].name).toEqual("last_name");
    expect(cipher6.fields[3].value).toEqual("Doe");
    expect(cipher6.fields[4].name).toEqual("login");
    expect(cipher6.fields[4].value).toEqual("jdoe");
    expect(cipher6.fields[5].name).toEqual("date_of_birth");
    expect(cipher6.fields[5].value).toEqual("2022-01-30");
    expect(cipher6.fields[6].name).toEqual("place_of_birth");
    expect(cipher6.fields[6].value).toEqual("earth");
  });

  it("should combine personal information records to one identity if only one identity present", async () => {
    const result = await importer.parse(personalInfoData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.Identity);
    expect(cipher.name).toBe("MR John Doe");
    expect(cipher.identity.fullName).toBe("MR John Doe");
    expect(cipher.identity.title).toBe("MR");
    expect(cipher.identity.firstName).toBe("John");
    expect(cipher.identity.middleName).toBeNull();
    expect(cipher.identity.lastName).toBe("Doe");
    expect(cipher.identity.username).toBe("jdoe");
    expect(cipher.identity.email).toBe("jdoe@example.com");
    expect(cipher.identity.phone).toBe("+49123123123");

    expect(cipher.fields.length).toBe(9);
    expect(cipher.fields[0].name).toBe("date_of_birth");
    expect(cipher.fields[0].value).toBe("2022-01-30");

    expect(cipher.fields[1].name).toBe("place_of_birth");
    expect(cipher.fields[1].value).toBe("world");

    expect(cipher.fields[2].name).toBe("email_type");
    expect(cipher.fields[2].value).toBe("personal");

    expect(cipher.fields[3].name).toBe("address_recipient");
    expect(cipher.fields[3].value).toBe("John");

    expect(cipher.fields[4].name).toBe("address_building");
    expect(cipher.fields[4].value).toBe("1");

    expect(cipher.fields[5].name).toBe("address_apartment");
    expect(cipher.fields[5].value).toBe("1");

    expect(cipher.fields[6].name).toBe("address_floor");
    expect(cipher.fields[6].value).toBe("1");

    expect(cipher.fields[7].name).toBe("address_door_code");
    expect(cipher.fields[7].value).toBe("123");

    expect(cipher.fields[8].name).toBe("url");
    expect(cipher.fields[8].value).toBe("website.com");
  });
});
