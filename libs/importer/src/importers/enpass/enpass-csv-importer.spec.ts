import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { data as loginQuotedData } from "../spec-data/enpass-csv/enpass.login-quoted.csv";
import { data as loginData } from "../spec-data/enpass-csv/enpass.login.csv";

import { EnpassCsvImporter } from "./enpass-csv-importer";

function validateCustomField(fields: FieldView[], fieldName: string, expectedValue: any) {
  expect(fields).toBeDefined();
  const customField = fields.find((f) => f.name === fieldName);
  expect(customField).toBeDefined();

  expect(customField.value).toEqual(expectedValue);
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
    // Website label is treated as the URL
    expect(booking.login.uris.length).toEqual(1);
    expect(booking.login.uris[0].uri).toEqual("https://account.booking.com");
    // A second Website field falls through to a custom field
    validateCustomField(booking.fields, "Website", "https://account.booking.com/sign-in");

    expect(consumerreports.type).toEqual(CipherType.Login);
    expect(consumerreports.name).toEqual("Consumerreports");
    expect(consumerreports.login.username).toEqual("rwilsoncloud@gmail.com");
    expect(consumerreports.login.password).toEqual("MyPassWordHere2");
    expect(consumerreports.login.uris[0].uri).toEqual("https://secure.consumerreports.org");
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
});
