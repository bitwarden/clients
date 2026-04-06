import { CipherType } from "@bitwarden/common/vault/enums";

import { FSecureFskImporter as Importer } from "./fsecure-fsk-importer";
import { CreditCardTestEntry, LoginTestEntry } from "./fsk-test-data";

describe("FSecure FSK Importer", () => {
  it("should import data of type login", async () => {
    const importer = new Importer();
    const LoginTestEntryStringified = JSON.stringify(LoginTestEntry);
    const result = await importer.parse(LoginTestEntryStringified);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();

    expect(cipher.name).toEqual("example.com");
    expect(cipher.favorite).toBe(true);
    expect(cipher.notes).toEqual("some note for example.com");

    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.login.username).toEqual("jdoe");
    expect(cipher.login.password).toEqual("somePassword");

    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("https://www.example.com");
  });

  it("should import data of type creditCard", async () => {
    const importer = new Importer();
    const CreditCardTestEntryStringified = JSON.stringify(CreditCardTestEntry);
    const result = await importer.parse(CreditCardTestEntryStringified);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();

    expect(cipher.name).toEqual("My credit card");
    expect(cipher.favorite).toBe(false);
    expect(cipher.notes).toEqual("some notes to my card");

    expect(cipher.type).toBe(CipherType.Card);
    expect(cipher.card.cardholderName).toEqual("John Doe");
    expect(cipher.card.number).toEqual("4242424242424242");
    expect(cipher.card.code).toEqual("123");

    expect(cipher.fields.length).toBe(2);
    expect(cipher.fields[0].name).toEqual("Expiration");
    expect(cipher.fields[0].value).toEqual("22.10.2026");

    expect(cipher.fields[1].name).toEqual("PIN");
    expect(cipher.fields[1].value).toEqual("1234");
  });
});
