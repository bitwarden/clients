import { BehaviorSubject } from "rxjs";

import { I18nService } from "../../platform/abstractions/i18n.service";
import { LogService } from "../../platform/abstractions/log.service";
import { UserId } from "../../types/guid";
import { CipherType } from "../enums";
import { CipherView } from "../models/view/cipher.view";
import { LoginUriView } from "../models/view/login-uri.view";
import { LoginView } from "../models/view/login.view";

import { SearchService } from "./search.service";

function createCipherView(id: string, name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;
  return cipher;
}

function createLoginCipherView(id: string, name: string, uris: string[]): CipherView {
  const cipher = createCipherView(id, name);
  cipher.type = CipherType.Login;
  cipher.login = new LoginView();
  cipher.login.uris = uris.map((uri) => {
    const uriView = new LoginUriView();
    uriView.uri = uri;
    return uriView;
  });
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
    mockLocale$.next("en");
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

    it("returns true if a single-character query contains a CJK character", async () => {
      const result = await service.isSearchable("密");

      expect(result).toBe(true);
    });

    it("returns false if a single-character query does not contain a CJK character", async () => {
      const result = await service.isSearchable("p");

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

    it("finds ciphers with single-character CJK queries", async () => {
      const ciphers = [createCipherView("cipher-1", "密碼"), createCipherView("cipher-2", "Login")];

      const result = await service.searchCiphers(userId, null, "密", ciphers);

      expect(result).toEqual([ciphers[0]]);
    });

    it("matches ciphers by notes", async () => {
      const cipherWithNotes = createCipherView("cipher-1", "My Login");
      cipherWithNotes.notes = "recovery code: abc123";
      const cipherWithoutNotes = createCipherView("cipher-2", "Other Login");

      const result = await service.searchCiphers(userId, null, "recovery", [
        cipherWithNotes,
        cipherWithoutNotes,
      ]);

      expect(result).toEqual([cipherWithNotes]);
    });
  });

  describe("searchCiphersBasic", () => {
    describe("multi-word queries", () => {
      it("matches a cipher when terms appear non-contiguously in the name", () => {
        const ciphers = [createCipherView("cipher-1", "dog.jump vehicle.stream")];

        expect(service.searchCiphersBasic(ciphers, "dog vehicle")).toHaveLength(1);
        expect(service.searchCiphersBasic(ciphers, "jump stream")).toHaveLength(1);
        expect(service.searchCiphersBasic(ciphers, "dog stream")).toHaveLength(1);
      });

      it("requires all terms to match (AND logic)", () => {
        const ciphers = [createCipherView("cipher-1", "dog.jump vehicle.stream")];

        expect(service.searchCiphersBasic(ciphers, "dog foobar")).toHaveLength(0);
        expect(service.searchCiphersBasic(ciphers, "dog.jump foobar")).toHaveLength(0);
      });

      it("returns no results when no term matches", () => {
        const ciphers = [createCipherView("cipher-1", "dog.jump vehicle.stream")];

        expect(service.searchCiphersBasic(ciphers, "foo bar")).toHaveLength(0);
      });
    });

    describe("diacritic normalization", () => {
      it("matches a cipher name containing diacritics when searching without diacritics", () => {
        const ciphers = [createCipherView("cipher-1", "Café Login")];

        expect(service.searchCiphersBasic(ciphers, "cafe")).toHaveLength(1);
      });

      it("matches a cipher name without diacritics when searching with diacritics", () => {
        const ciphers = [createCipherView("cipher-1", "Cafe Login")];

        expect(service.searchCiphersBasic(ciphers, "café")).toHaveLength(1);
      });

      it("matches a cipher name when both name and query contain diacritics", () => {
        const ciphers = [createCipherView("cipher-1", "Ré Login")];

        expect(service.searchCiphersBasic(ciphers, "ré")).toHaveLength(1);
      });
    });

    describe("login URI matching", () => {
      it("matches against the URI hostname", () => {
        const ciphers = [
          createLoginCipherView("cipher-1", "My Login", ["https://example.com/path"]),
        ];

        expect(service.searchCiphersBasic(ciphers, "example.com")).toHaveLength(1);
      });

      it("does not match against the URI path or query params", () => {
        const ciphers = [
          createLoginCipherView("cipher-1", "My Login", [
            "https://example.com/secret-path?secretValue=hidden",
          ]),
        ];

        expect(service.searchCiphersBasic(ciphers, "secret-path")).toHaveLength(0);
        expect(service.searchCiphersBasic(ciphers, "secretvalue")).toHaveLength(0);
      });
    });
  });
});
