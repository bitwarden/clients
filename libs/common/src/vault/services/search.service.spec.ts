import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";

import { SearchService } from "./search.service";

interface CipherViewOptions {
  username?: string;
  notes?: string;
  uris?: string[];
  fields?: { name?: string; value?: string }[];
}

function createCipherView(id: string, name: string, options: CipherViewOptions = {}): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;

  // For a Login cipher the subtitle is driven by the username.
  if (options.username != null) {
    cipher.login.username = options.username;
  }

  if (options.notes != null) {
    cipher.notes = options.notes;
  }

  if (options.uris != null) {
    cipher.login.uris = options.uris.map((uri) => {
      const loginUri = new LoginUriView();
      loginUri.uri = uri;
      return loginUri;
    });
  }

  if (options.fields != null) {
    cipher.fields = options.fields.map((f) => {
      const field = new FieldView();
      field.name = f.name;
      field.value = f.value;
      return field;
    });
  }

  return cipher;
}

describe("SearchService", () => {
  let service: SearchService;

  const userId = "user-id" as UserId;
  const mockLogService = {
    error: jest.fn(),
    info: jest.fn(),
    measure: jest.fn(),
  };
  const mockLocale$ = new BehaviorSubject<string>("en");
  const mockI18nService = {
    locale$: mockLocale$.asObservable(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService(
      mockLogService as unknown as LogService,
      mockI18nService as unknown as I18nService,
    );
  });

  describe("isSearchable", () => {
    it("returns false if the query is empty", async () => {
      const result = await service.isSearchable("");
      expect(result).toBe(false);
    });

    it("returns false if the query is null", async () => {
      const result = await service.isSearchable(null as any);
      expect(result).toBe(false);
    });

    it("returns true if the query is longer than searchableMinLength", async () => {
      service["searchableMinLength"] = 3;
      const result = await service.isSearchable("test");
      expect(result).toBe(true);
    });

    it("returns false if the query is shorter than searchableMinLength", async () => {
      service["searchableMinLength"] = 5;
      const result = await service.isSearchable("test");
      expect(result).toBe(false);
    });
  });

  describe("searchCiphers", () => {
    it("uses basic search for regular queries", async () => {
      const basicSearchSpy = jest.spyOn(service, "searchCiphersBasic");
      const ciphers = [createCipherView("cipher-1", "Personal Login")];

      const result = await service.searchCiphers(userId, null, "personal", ciphers);

      expect(basicSearchSpy).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("returns original ciphers for non-searchable queries", async () => {
      const ciphers = [createCipherView("cipher-1", "Personal Login")];

      const result = await service.searchCiphers(userId, null, "", ciphers);

      expect(result).toEqual(ciphers);
    });
  });

  describe("searchCiphersBasic", () => {
    describe("single-target matching", () => {
      it("matches on the name", () => {
        const cipher = createCipherView("cipher-1", "Personal Login");

        const result = service.searchCiphersBasic([cipher], "personal");

        expect(result).toEqual([cipher]);
      });

      it("matches on the subtitle (username)", () => {
        const cipher = createCipherView("cipher-1", "Work", { username: "alice@example.com" });

        const result = service.searchCiphersBasic([cipher], "alice");

        expect(result).toEqual([cipher]);
      });

      it("matches on the UUID when the query is at least 8 characters", () => {
        const cipher = createCipherView("abcdef12-3456-7890", "Some Item");

        const result = service.searchCiphersBasic([cipher], "abcdef12");

        expect(result).toEqual([cipher]);
      });

      it("does not match on the UUID when the query is shorter than 8 characters", () => {
        const cipher = createCipherView("abcdef12-3456-7890", "Some Item");

        const result = service.searchCiphersBasic([cipher], "abcdef1");

        expect(result).toEqual([]);
      });

      it("matches on a login URI hostname", () => {
        const cipher = createCipherView("cipher-1", "Work", {
          uris: ["https://mycompany.com/login"],
        });

        const result = service.searchCiphersBasic([cipher], "mycompany");

        expect(result).toEqual([cipher]);
      });

      it("does not match on a login URI path", () => {
        const cipher = createCipherView("cipher-1", "Work", {
          uris: ["https://example.com/secret-path"],
        });

        const result = service.searchCiphersBasic([cipher], "secret-path");

        expect(result).toEqual([]);
      });

      it("skips invalid login URIs without throwing", () => {
        const cipher = createCipherView("cipher-1", "Work", {
          uris: ["not a valid uri"],
        });

        expect(() => service.searchCiphersBasic([cipher], "valid")).not.toThrow();
        expect(service.searchCiphersBasic([cipher], "valid")).toEqual([]);
      });

      it("matches on a custom field name", () => {
        const cipher = createCipherView("cipher-1", "Work", {
          fields: [{ name: "Security Question", value: "blue" }],
        });

        const result = service.searchCiphersBasic([cipher], "security");

        expect(result).toEqual([cipher]);
      });

      it("matches on a custom field value", () => {
        const cipher = createCipherView("cipher-1", "Work", {
          fields: [{ name: "Security Question", value: "azure" }],
        });

        const result = service.searchCiphersBasic([cipher], "azure");

        expect(result).toEqual([cipher]);
      });

      it("matches on the notes", () => {
        const cipher = createCipherView("cipher-1", "Work", { notes: "Archived account" });

        const result = service.searchCiphersBasic([cipher], "archived");

        expect(result).toEqual([cipher]);
      });
    });

    describe("multi-token semantics", () => {
      it("matches when all parts are found in the same target", () => {
        const cipher = createCipherView("cipher-1", "Email Work MyCompany");

        const result = service.searchCiphersBasic([cipher], "email work");

        expect(result).toEqual([cipher]);
      });

      it("matches when parts are spread across different targets", () => {
        const cipher = createCipherView("cipher-1", "Work", {
          username: "alice@mycompany.com",
          notes: "Archived",
        });

        const result = service.searchCiphersBasic([cipher], "alice archived");

        expect(result).toEqual([cipher]);
      });

      it("matches regardless of the order of the parts", () => {
        const cipher = createCipherView("cipher-1", "Email Work MyCompany");

        const result = service.searchCiphersBasic([cipher], "work email");

        expect(result).toEqual([cipher]);
      });

      it("matches on partial tokens across multiple targets", () => {
        const cipher = createCipherView("cipher-1", "Email Work MyCompany");

        const result = service.searchCiphersBasic([cipher], "mycomp mail");

        expect(result).toEqual([cipher]);
      });

      it("returns no results when one of the parts has no matching target", () => {
        const cipher = createCipherView("cipher-1", "Email Work MyCompany");

        const result = service.searchCiphersBasic([cipher], "email missing");

        expect(result).toEqual([]);
      });
    });

    describe("query normalization", () => {
      it("matches ignoring case", () => {
        const cipher = createCipherView("cipher-1", "Personal Login");

        const result = service.searchCiphersBasic([cipher], "PERSONAL");

        expect(result).toEqual([cipher]);
      });

      it("matches ignoring diacritics", () => {
        const cipher = createCipherView("cipher-1", "Cafe Account");

        const result = service.searchCiphersBasic([cipher], "café");

        expect(result).toEqual([cipher]);
      });

      it("trims surrounding whitespace", () => {
        const cipher = createCipherView("cipher-1", "Personal Login");

        const result = service.searchCiphersBasic([cipher], "  personal  ");

        expect(result).toEqual([cipher]);
      });
    });

    it("returns only the matching subset across multiple ciphers", () => {
      const match = createCipherView("cipher-1", "Personal Login");
      const other = createCipherView("cipher-2", "Bank Account");

      const result = service.searchCiphersBasic([match, other], "personal");

      expect(result).toEqual([match]);
    });
  });
});
