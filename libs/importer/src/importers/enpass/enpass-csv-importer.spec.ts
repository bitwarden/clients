import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { data as cardData } from "../spec-data/enpass-csv/enpass.card.csv";
import { data as loginNoUsernameData } from "../spec-data/enpass-csv/enpass.login-no-username.csv";
import { data as loginOneTimeCodeData } from "../spec-data/enpass-csv/enpass.login-one-time-code.csv";
import { data as loginQuotedData } from "../spec-data/enpass-csv/enpass.login-quoted.csv";
import { data as loginSensitiveCustomFieldData } from "../spec-data/enpass-csv/enpass.login-sensitive-custom-field.csv";
import { data as loginStarredOnlyData } from "../spec-data/enpass-csv/enpass.login-starred-only.csv";
import { data as loginTrailingNoteData } from "../spec-data/enpass-csv/enpass.login-trailing-note.csv";
import { data as loginData } from "../spec-data/enpass-csv/enpass.login.csv";
import { data as secureNoteData } from "../spec-data/enpass-csv/enpass.secure-note.csv";

import { EnpassCsvImporter } from "./enpass-csv-importer";

function validateCustomField(
  fields: FieldView[],
  fieldName: string,
  expectedValue: any,
  expectedType: FieldType = FieldType.Text,
) {
  expect(fields).toBeDefined();
  const customField = fields.find((f) => f.name === fieldName);
  expect(customField).toBeDefined();

  expect(customField.value).toEqual(expectedValue);
  expect(customField.type).toEqual(expectedType);
}

describe("Enpass CSV Importer", () => {
  let importer: EnpassCsvImporter;
  beforeEach(() => {
    importer = new EnpassCsvImporter();
  });

  it("should parse username, password, and url from real Enpass export labels", async () => {
    const result = await importer.parse(loginData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(2);

    const [booking, consumerreports] = result.ciphers;

    expect(booking.type).toEqual(CipherType.Login);
    expect(booking.name).toEqual("Booking");
    // Username field is blank; falls back to E-mail
    expect(booking.login.username).toEqual("rwilsoncloud@gmail.com");
    // *Password label has the sensitive-field '*' prefix stripped
    expect(booking.login.password).toEqual("MyPassWordHere");
    // Website label is treated as the URL; a repeated Website column becomes a second URI
    expect(booking.login.uris.length).toEqual(2);
    expect(booking.login.uris[0].uri).toEqual("https://account.booking.com");
    expect(booking.login.uris[1].uri).toEqual("https://account.booking.com/sign-in");
    // Odd-length row (no trailing note column) must not misread the last field as a note
    expect(booking.notes).toBeNull();

    expect(consumerreports.type).toEqual(CipherType.Login);
    expect(consumerreports.name).toEqual("Consumerreports");
    expect(consumerreports.login.username).toEqual("rwilsoncloud@gmail.com");
    expect(consumerreports.login.password).toEqual("MyPassWordHere2");
    expect(consumerreports.login.uris.length).toEqual(2);
    expect(consumerreports.login.uris[0].uri).toEqual("https://secure.consumerreports.org");
    expect(consumerreports.login.uris[1].uri).toEqual(
      "https://secure.consumerreports.org/ec/account/change-password",
    );
    // Username already set, so E-mail becomes a custom field
    validateCustomField(consumerreports.fields, "E-mail", "rwilsoncloud@gmail.com");
  });

  it("should parse multiple quoted rows", async () => {
    const result = await importer.parse(loginQuotedData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(4);

    const [amazon, google, linkedin, wikipedia] = result.ciphers;

    expect(amazon.name).toEqual("Amazon");
    expect(amazon.login.username).toEqual("Food");
    expect(amazon.login.password).toEqual("Adasceafazxc");
    expect(amazon.login.uris[0].uri).toEqual("https://www.amazon.com");

    expect(google.name).toEqual("Google");
    expect(google.login.username).toEqual("Test");
    expect(google.login.password).toEqual("Testingas");
    expect(google.login.uris[0].uri).toEqual("https://accounts.google.com/");

    expect(linkedin.name).toEqual("LinkedIn");
    expect(linkedin.login.username).toEqual("aksldkl");
    expect(linkedin.login.password).toEqual("amlkzmcklmxklzmclkzmxklcmzlkxmclkm");
    expect(linkedin.login.uris[0].uri).toEqual("https://www.linkedin.com/");

    expect(wikipedia.name).toEqual("Wikipedia");
    expect(wikipedia.login.username).toEqual("aslmdlkads");
    // Comma inside a quoted field is preserved
    expect(wikipedia.login.password).toEqual("amc,.zxla;skd;lkpokpokwpoqkeopkalsd");
    expect(wikipedia.login.uris[0].uri).toEqual(
      "https://en.wikipedia.org/w/index.php?title=Special:UserLogin&returnto=Main+Page",
    );
  });

  it("should parse a note-only row (title + bare note, no field pairs)", async () => {
    const result = await importer.parse(secureNoteData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(1);

    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("MyNote");
    expect(cipher.notes).toEqual("Some note text");
  });

  it("should parse a login row with a trailing unpaired note column", async () => {
    const result = await importer.parse(loginTrailingNoteData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(1);

    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("SomeSite");
    expect(cipher.login.username).toEqual("someuser");
    expect(cipher.login.password).toEqual("somepass");
    expect(cipher.notes).toEqual("Some trailing note text");
  });

  it("should classify a row as Login when it has *Password/Website but no literal Username", async () => {
    const result = await importer.parse(loginNoUsernameData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(1);

    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("Router");
    expect(cipher.login.password).toEqual("secret");
    expect(cipher.login.uris[0].uri).toEqual("https://router.local");
  });

  it("should classify a row as Login from a *Password label alone, with no Username/Website", async () => {
    const result = await importer.parse(loginStarredOnlyData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(1);

    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("Router");
    expect(cipher.login.password).toEqual("secret");
  });

  it("should parse card items, including starred field labels", async () => {
    const result = await importer.parse(cardData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(1);

    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.Card);
    expect(cipher.name).toEqual("Visa");
    expect(cipher.card.cardholderName).toEqual("John Doe");
    expect(cipher.card.number).toEqual("4111111111111111");
    expect(cipher.card.brand).toEqual("Visa");
    expect(cipher.card.code).toEqual("123");
    expect(cipher.card.expMonth).toEqual("1");
    expect(cipher.card.expYear).toEqual("2030");
  });

  it("should strip the '*' from a sensitive custom field's name and mark it Hidden", async () => {
    const result = await importer.parse(loginSensitiveCustomFieldData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(1);

    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.Login);
    // '*' prefix is stripped from the displayed field name
    validateCustomField(cipher.fields, "Security answer", "42", FieldType.Hidden);
  });

  it("should parse TOTP from the real Enpass 'One-time code' label", async () => {
    const result = await importer.parse(loginOneTimeCodeData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(1);

    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.login.totp).toEqual("TOTP_SEED_VALUE");
  });
});
