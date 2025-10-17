import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { ChromeCsvImporter } from "./chrome-csv-importer";
import { data as androidData } from "./spec-data/chrome-csv/android-data.csv";
import { data as simplePasswordData } from "./spec-data/chrome-csv/simple-password-data.csv";

const CipherData = [
  {
    title: "should parse app name",
    csv: androidData,
    expected: Object.assign(new CipherView(), {
      name: "com.xyz.example.app.android",
      login: Object.assign(new LoginView(), {
        username: "username@example.com",
        password: "Qh6W4Wz55YGFNU",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "androidapp://com.xyz.example.app.android",
          }),
        ],
      }),
      type: 1,
    }),
  },
  {
    title: "should parse password",
    csv: simplePasswordData,
    expected: Object.assign(new CipherView(), {
      name: "www.example.com",
      login: Object.assign(new LoginView(), {
        username: "username@example.com",
        password: "wpC9qFvsbWQK5Z",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://www.example.com/",
          }),
        ],
      }),
      type: 1,
    }),
  },
];

describe("Chrome CSV Importer", () => {
  CipherData.forEach((data) => {
    it(data.title, async () => {
      jest.useFakeTimers().setSystemTime(data.expected.creationDate);
      const importer = new ChromeCsvImporter();
      const result = await importer.parse(data.csv);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toBeGreaterThan(0);

      const cipher = result.ciphers.shift();
      let property: keyof typeof data.expected;
      for (property in data.expected) {
        if (Object.prototype.hasOwnProperty.call(data.expected, property)) {
          expect(Object.prototype.hasOwnProperty.call(cipher, property)).toBe(true);
          expect(cipher[property]).toEqual(data.expected[property]);
        }
      }
    });
  });
});
