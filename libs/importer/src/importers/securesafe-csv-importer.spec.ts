import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { SecureSafeCsvImporter } from "./securesafe-csv-importer";
import { data_upperUrl, data_lowerUrl } from "./spec-data/securesafe-csv/securesafe-example.csv";

const CipherData = [
  {
    title: "should parse upper case url",
    csv: data_upperUrl,
    expected: Object.assign(new CipherView(), {
      id: null,
      organizationId: null,
      folderId: null,
      name: "Gmail",
      login: Object.assign(new LoginView(), {
        username: "test@gmail.com",
        password: "test",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://gmail.com",
          }),
        ],
      }),
      notes: null,
      type: 1,
    }),
  },
  {
    title: "should parse lower case url",
    csv: data_lowerUrl,
    expected: Object.assign(new CipherView(), {
      id: null,
      organizationId: null,
      folderId: null,
      name: "Gmail",
      login: Object.assign(new LoginView(), {
        username: "test@gmail.com",
        password: "test",
        uris: [
          Object.assign(new LoginUriView(), {
            uri: "https://gmail.com",
          }),
        ],
      }),
      notes: null,
      type: 1,
    }),
  },
];

describe("SecureSafe CSV Importer", () => {
  beforeEach(() => {
    // Importers currently create their own ConsoleLogService. This should be replaced by injecting a test log service.
    jest.spyOn(console, "warn").mockImplementation();
  });

  CipherData.forEach((data) => {
    it(data.title, async () => {
      const importer = new SecureSafeCsvImporter();
      const result = await importer.parse(data.csv);
      expect(result != null).toBe(true);
      expect(result.ciphers.length).toBeGreaterThan(0);

      const cipher = result.ciphers.shift();
      expect(cipher.name).toEqual(data.expected.name);
      expect(cipher.login).toEqual(
        expect.objectContaining({
          username: data.expected.login.username,
          password: data.expected.login.password,
        }),
      );
      expect(cipher.login.uris.length).toEqual(1);
      expect(cipher.login.uris[0].uri).toEqual(data.expected.login.uris[0].uri);
    });
  });
});
