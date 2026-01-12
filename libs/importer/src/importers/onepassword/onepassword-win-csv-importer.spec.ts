import { FieldType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { data as creditCardData } from "../spec-data/onepassword-csv/credit-card.windows.csv";
import { data as identityData } from "../spec-data/onepassword-csv/identity.windows.csv";
import { data as multiTypeData } from "../spec-data/onepassword-csv/multiple-items.windows.csv";

import { OnePasswordWinCsvImporter } from "./onepassword-win-csv-importer";

function expectIdentity(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);

  expect(cipher.identity).toEqual(
    expect.objectContaining({
      firstName: "first name",
      middleName: "mi",
      lastName: "last name",
      username: "userNam3",
      company: "bitwarden",
      phone: "8005555555",
      email: "email@bitwarden.com",
    }),
  );

  expect(cipher.fields).toEqual(
    expect.arrayContaining([
      Object.assign(new FieldView(), {
        type: FieldType.Text,
        name: "address",
        value: "address city state zip us",
      }),
    ]),
  );
}

function expectCreditCard(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Card);

  expect(cipher.card).toEqual(
    expect.objectContaining({
      number: "4111111111111111",
      code: "111",
      cardholderName: "test",
      expMonth: "1",
      expYear: "1970",
    }),
  );
}

describe("1Password windows CSV Importer", () => {
  let importer: OnePasswordWinCsvImporter;
  beforeEach(() => {
    importer = new OnePasswordWinCsvImporter();
  });

  it("should parse identity records", async () => {
    const result = await importer.parse(identityData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expectIdentity(cipher);
  });

  it("should parse credit card records", async () => {
    const result = await importer.parse(creditCardData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expectCreditCard(cipher);
  });

  it("should parse csv's with multiple record types", async () => {
    const result = await importer.parse(multiTypeData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(4);

    expectIdentity(result.ciphers[1]);
    expectCreditCard(result.ciphers[2]);
  });
});
