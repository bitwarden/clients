import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { creditCard } from "../spec-data/enpass-json/credit-card";
import { folders } from "../spec-data/enpass-json/folders";
import { login } from "../spec-data/enpass-json/login";
import { loginAndroidUrl } from "../spec-data/enpass-json/login-android-url";
import { note } from "../spec-data/enpass-json/note";

import { EnpassJsonImporter } from "./enpass-json-importer";

function validateCustomField(fields: FieldView[], fieldName: string, expectedValue: any) {
  expect(fields).toBeDefined();
  const customField = fields.find((f) => f.name === fieldName);
  expect(customField).toBeDefined();

  expect(customField.value).toEqual(expectedValue);
}

describe("Enpass JSON Importer", () => {
  it("should create folders/ nested folder and assignment", async () => {
    const importer = new EnpassJsonImporter();
    const testDataString = JSON.stringify(folders);
    const result = await importer.parse(testDataString);
    expect(result != null).toBe(true);

    expect(result.folders.length).toEqual(2);
    const folder1 = result.folders.shift();
    expect(folder1.name).toEqual("Social");

    // Created 2 folders and Twitter is child of Social
    const folder2 = result.folders.shift();
    expect(folder2.name).toEqual("Social/Twitter");

    // Expect that the single cipher item is assigned to sub-folder "Social/Twitter"
    const folderRelationship = result.folderRelationships.shift();
    expect(folderRelationship).toEqual([0, 1]);
  });

  it("should parse login items", async () => {
    const importer = new EnpassJsonImporter();
    const testDataString = JSON.stringify(login);
    const result = await importer.parse(testDataString);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("Amazon");
    expect(cipher.subTitle).toEqual("emily@enpass.io");
    expect(cipher.favorite).toBe(true);
    expect(cipher.notes).toEqual("some notes on the login item");

    expect(cipher.login.username).toEqual("emily@enpass.io");
    expect(cipher.login.password).toEqual("$&W:v@}4\\iRpUXVbjPdPKDGbD<xK>");
    expect(cipher.login.totp).toEqual("TOTP_SEED_VALUE");
    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("https://www.amazon.com");

    // remaining fields as custom fields
    expect(cipher.fields.length).toEqual(3);
    validateCustomField(cipher.fields, "Phone number", "12345678");
    validateCustomField(cipher.fields, "Security question", "SECURITY_QUESTION");
    validateCustomField(cipher.fields, "Security answer", "SECURITY_ANSWER");
  });

  it("should parse login items with Android Autofill information", async () => {
    const importer = new EnpassJsonImporter();
    const testDataString = JSON.stringify(loginAndroidUrl);
    const result = await importer.parse(testDataString);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toEqual("Amazon");

    expect(cipher.login.uris.length).toEqual(5);
    expect(cipher.login.uris[0].uri).toEqual("https://www.amazon.com");
    expect(cipher.login.uris[1].uri).toEqual("androidapp://com.amazon.0");
    expect(cipher.login.uris[2].uri).toEqual("androidapp://com.amazon.1");
    expect(cipher.login.uris[3].uri).toEqual("androidapp://com.amazon.2");
    expect(cipher.login.uris[4].uri).toEqual("androidapp://com.amazon.3");
  });

  it("should parse credit card items", async () => {
    const importer = new EnpassJsonImporter();
    const testDataString = JSON.stringify(creditCard);
    const result = await importer.parse(testDataString);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toEqual(CipherType.Card);
    expect(cipher.name).toEqual("Emily Sample Credit Card");
    expect(cipher.subTitle).toEqual("Amex, *10005");
    expect(cipher.favorite).toBe(true);
    expect(cipher.notes).toEqual("some notes on the credit card");

    expect(cipher.card.cardholderName).toEqual("Emily Sample");
    expect(cipher.card.number).toEqual("3782 822463 10005");
    expect(cipher.card.brand).toEqual("Amex");
    expect(cipher.card.code).toEqual("1234");
    expect(cipher.card.expMonth).toEqual("3");
    expect(cipher.card.expYear).toEqual("2023");

    // remaining fields as custom fields
    expect(cipher.fields.length).toEqual(9);
    validateCustomField(cipher.fields, "PIN", "9874");
    validateCustomField(cipher.fields, "Username", "Emily_ENP");
    validateCustomField(
      cipher.fields,
      "Login password",
      "nnn tug shoot selfish bon liars convent dusty minnow uncheck",
    );
    validateCustomField(cipher.fields, "Website", "http://global.americanexpress.com/");
    validateCustomField(cipher.fields, "Issuing bank", "American Express");
    validateCustomField(cipher.fields, "Credit limit", "100000");
    validateCustomField(cipher.fields, "Withdrawal limit", "50000");
    validateCustomField(cipher.fields, "Interest rate", "1.5");
    validateCustomField(cipher.fields, "If lost, call", "12345678");
  });

  it("should parse notes", async () => {
    const importer = new EnpassJsonImporter();
    const testDataString = JSON.stringify(note);
    const result = await importer.parse(testDataString);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toEqual("some secure note title");
    expect(cipher.favorite).toBe(false);
    expect(cipher.notes).toEqual("some secure note content");
  });
});
