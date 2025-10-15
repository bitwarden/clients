import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { SafariCsvImporter } from "./safari-csv-importer";
import { data as oldSimplePasswordData } from "./spec-data/safari-csv/old-simple-password-data.csv";
import { data as simplePasswordData } from "./spec-data/safari-csv/simple-password-data.csv";

const CipherData = [
  {
    title: "should parse URLs in new CSV format",
    csv: simplePasswordData,
    expected: Object.assign(new CipherView(), {
      name: "example.com (example_user)",
      login: Object.assign(new LoginView(), {
        username: "example_user",
        password: "example_p@ssword",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://example.com",
          }),
        ],
        totp: "otpauth://totp/test?secret=examplesecret",
      }),
      notes: "Example note\nMore notes on new line",
      type: 1,
    }),
  },
  {
    title: "should parse URLs in old CSV format",
    csv: oldSimplePasswordData,
    expected: Object.assign(new CipherView(), {
      name: "example.com (example_user)",
      login: Object.assign(new LoginView(), {
        username: "example_user",
        password: "example_p@ssword",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://example.com",
          }),
        ],
        totp: null,
      }),
      type: 1,
    }),
  },
];

describe("Safari CSV Importer", () => {
  CipherData.forEach((data) => {
    it(data.title, async () => {
      jest.useFakeTimers().setSystemTime(data.expected.creationDate);
      const importer = new SafariCsvImporter();
      const result = await importer.parse(data.csv);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toBeGreaterThan(0);

      const cipher = result.ciphers.shift();
      let property: keyof typeof data.expected;
      for (property in data.expected) {
        // eslint-disable-next-line
        if (data.expected.hasOwnProperty(property)) {
          // eslint-disable-next-line
          expect(cipher.hasOwnProperty(property)).toBe(true);
          expect(cipher[property]).toEqual(data.expected[property]);
        }
      }
    });
  });
});
