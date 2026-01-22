import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { ArcCsvImporter } from "./arc-csv-importer";
import { data as missingNameAndUrlData } from "./spec-data/arc-csv/missing-name-and-url-data.csv";
import { data as missingNameWithUrlData } from "./spec-data/arc-csv/missing-name-with-url-data.csv";
import { data as passwordWithNoteData } from "./spec-data/arc-csv/password-with-note-data.csv";
import { data as simplePasswordData } from "./spec-data/arc-csv/simple-password-data.csv";
import { data as subdomainData } from "./spec-data/arc-csv/subdomain-data.csv";
import { data as urlWithWwwData } from "./spec-data/arc-csv/url-with-www-data.csv";

const CipherData = [
  {
    title: "should parse password",
    csv: simplePasswordData,
    expected: Object.assign(new CipherView(), {
      name: "example.com",
      login: Object.assign(new LoginView(), {
        username: "user@example.com",
        password: "password123",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://example.com/",
          }),
        ],
      }),
      notes: null,
      type: 1,
    }),
  },
  {
    title: "should parse password with note",
    csv: passwordWithNoteData,
    expected: Object.assign(new CipherView(), {
      name: "example.com",
      login: Object.assign(new LoginView(), {
        username: "user@example.com",
        password: "password123",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://example.com/",
          }),
        ],
      }),
      notes: "This is a test note",
      type: 1,
    }),
  },
  {
    title: "should strip www. prefix from name",
    csv: urlWithWwwData,
    expected: Object.assign(new CipherView(), {
      name: "example.com",
      login: Object.assign(new LoginView(), {
        username: "user@example.com",
        password: "password123",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://www.example.com/",
          }),
        ],
      }),
      notes: null,
      type: 1,
    }),
  },
  {
    title: "should extract name from URL when name is missing",
    csv: missingNameWithUrlData,
    expected: Object.assign(new CipherView(), {
      name: "example.com",
      login: Object.assign(new LoginView(), {
        username: "user@example.com",
        password: "password123",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://example.com/login",
          }),
        ],
      }),
      notes: null,
      type: 1,
    }),
  },
  {
    title: "should use -- as name when both name and URL are missing",
    csv: missingNameAndUrlData,
    expected: Object.assign(new CipherView(), {
      name: "--",
      login: Object.assign(new LoginView(), {
        username: null,
        password: "password123",
        uris: null,
      }),
      notes: null,
      type: 1,
    }),
  },
  {
    title: "should preserve subdomain in name",
    csv: subdomainData,
    expected: Object.assign(new CipherView(), {
      name: "login.example.com",
      login: Object.assign(new LoginView(), {
        username: "user@example.com",
        password: "password123",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://login.example.com/auth",
          }),
        ],
      }),
      notes: null,
      type: 1,
    }),
  },
];

describe("Arc CSV Importer", () => {
  CipherData.forEach((data) => {
    it(data.title, async () => {
      jest.useFakeTimers().setSystemTime(data.expected.creationDate);
      const importer = new ArcCsvImporter();
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
