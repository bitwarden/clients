import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { PasskeyDirectoryApiService } from "@bitwarden/common/dirt/services/abstractions/passkey-directory-api.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  PasskeyCipherRow,
  PasskeyReportService,
  PasskeyServiceEntry,
} from "./passkey-report.service";

describe("PasskeyReportService", () => {
  let service: PasskeyReportService;
  let passkeyDirectoryApiServiceMock: MockProxy<PasskeyDirectoryApiService>;

  const passkeyServices = new Map<string, PasskeyServiceEntry>([
    [
      "example.com",
      {
        instructions: "https://example.com/setup",
        supportsPasskeyLogin: true,
        supportsPasskeyMfa: false,
      },
    ],
    [
      "test.com",
      {
        instructions: "",
        supportsPasskeyLogin: false,
        supportsPasskeyMfa: true,
      },
    ],
  ]);

  beforeEach(() => {
    passkeyDirectoryApiServiceMock = mock<PasskeyDirectoryApiService>();

    TestBed.configureTestingModule({
      providers: [
        PasskeyReportService,
        { provide: PasskeyDirectoryApiService, useValue: passkeyDirectoryApiServiceMock },
      ],
    });

    service = TestBed.inject(PasskeyReportService);
  });

  describe("loadPasskeyDirectory", () => {
    const userId = Utils.newGuid() as UserId;

    it("should fetch and return a map of passkey services", async () => {
      passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([
        {
          domainName: "example.com",
          instructions: "https://example.com/setup",
          supportsPasskeyLogin: true,
          supportsPasskeyMfa: false,
        } as any,
        {
          domainName: "test.com",
          instructions: "",
          supportsPasskeyLogin: false,
          supportsPasskeyMfa: true,
        } as any,
      ]);

      const result = await service.loadPasskeyDirectory(userId);

      expect(result.size).toBe(2);
      expect(result.get("example.com")?.supportsPasskeyLogin).toBe(true);
      expect(result.get("test.com")?.supportsPasskeyMfa).toBe(true);
    });

    it("should filter out entries with null domainName", async () => {
      passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([
        {
          domainName: "example.com",
          instructions: "https://example.com/setup",
          supportsPasskeyLogin: true,
          supportsPasskeyMfa: false,
        } as any,
        {
          domainName: null,
          instructions: "",
          supportsPasskeyLogin: false,
          supportsPasskeyMfa: true,
        } as any,
      ]);

      const result = await service.loadPasskeyDirectory(userId);

      expect(result.size).toBe(1);
      expect(result.has("example.com")).toBe(true);
    });

    it("should return empty map when no entries exist", async () => {
      passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([]);

      const result = await service.loadPasskeyDirectory(userId);

      expect(result.size).toBe(0);
    });
  });

  describe("processCiphers", () => {
    it("should return rows for matching ciphers", () => {
      const ciphers = [
        createCipherView({ id: "1", login: { uris: [{ uri: "https://example.com" }] } }),
        createCipherView({ id: "2", login: { uris: [{ uri: "https://nomatch.com" }] } }),
      ];

      const rows = service.processCiphers(ciphers, passkeyServices);

      expect(rows.length).toBe(1);
      expect(rows[0].cipher.id).toBe("1");
    });

    it("should return empty array when no ciphers match", () => {
      const ciphers = [
        createCipherView({ id: "1", login: { uris: [{ uri: "https://nomatch.com" }] } }),
      ];

      const rows = service.processCiphers(ciphers, passkeyServices);

      expect(rows.length).toBe(0);
    });

    it("should return empty array with empty directory", () => {
      const ciphers = [
        createCipherView({ id: "1", login: { uris: [{ uri: "https://example.com" }] } }),
      ];

      const rows = service.processCiphers(ciphers, new Map());

      expect(rows.length).toBe(0);
    });
  });

  describe("getPasskeyServiceMatch", () => {
    it("should return match for a matching cipher", () => {
      const cipher = createCipherView({
        id: "1",
        login: { uris: [{ uri: "https://example.com" }] },
      });

      const match = service.getPasskeyServiceMatch(cipher, passkeyServices);

      expect(match).not.toBeNull();
      expect(match!.instructions).toBe("https://example.com/setup");
    });

    it("should return null for non-login ciphers", () => {
      const cipher = createCipherView({
        id: "1",
        type: CipherType.SecureNote,
        login: { uris: [{ uri: "https://example.com" }] },
      });

      expect(service.getPasskeyServiceMatch(cipher, passkeyServices)).toBeNull();
    });

    it("should return null for ciphers without URIs", () => {
      const cipher = createCipherView({
        id: "1",
        login: { hasUris: false, uris: [] },
      });

      expect(service.getPasskeyServiceMatch(cipher, passkeyServices)).toBeNull();
    });

    it("should return null for ciphers with fido2 credentials", () => {
      const cipher = createCipherView({
        id: "1",
        login: { hasFido2Credentials: true, uris: [{ uri: "https://example.com" }] },
      });

      expect(service.getPasskeyServiceMatch(cipher, passkeyServices)).toBeNull();
    });

    it("should return null for deleted ciphers", () => {
      const cipher = createCipherView({
        id: "1",
        isDeleted: true,
        login: { uris: [{ uri: "https://example.com" }] },
      });

      expect(service.getPasskeyServiceMatch(cipher, passkeyServices)).toBeNull();
    });

    it("should return null for ciphers without viewPassword", () => {
      const cipher = createCipherView({
        id: "1",
        viewPassword: false,
        login: { uris: [{ uri: "https://example.com" }] },
      });

      expect(service.getPasskeyServiceMatch(cipher, passkeyServices)).toBeNull();
    });

    it("should match URIs with www prefix stripped", () => {
      const cipher = createCipherView({
        id: "1",
        login: { uris: [{ uri: "https://www.example.com/login" }] },
      });

      expect(service.getPasskeyServiceMatch(cipher, passkeyServices)).not.toBeNull();
    });

    it("should check all URIs and match if any matches", () => {
      const cipher = createCipherView({
        id: "1",
        login: {
          uris: [{ uri: "https://nomatch.com" }, { uri: "https://example.com/dashboard" }],
        },
      });

      expect(service.getPasskeyServiceMatch(cipher, passkeyServices)).not.toBeNull();
    });

    it("should skip URIs that are null or empty", () => {
      const cipher = createCipherView({
        id: "1",
        login: {
          uris: [{ uri: null }, { uri: "" }, { uri: "https://example.com" }],
        },
      });

      expect(service.getPasskeyServiceMatch(cipher, passkeyServices)).not.toBeNull();
    });

    it("should return null for non-matching URIs", () => {
      const cipher = createCipherView({
        id: "1",
        login: { uris: [{ uri: "https://nomatch.com" }] },
      });

      expect(service.getPasskeyServiceMatch(cipher, passkeyServices)).toBeNull();
    });
  });

  describe("evaluateCipher", () => {
    it("should return a row for a matching cipher", () => {
      const cipher = createCipherView({
        id: "1",
        login: { uris: [{ uri: "https://example.com" }] },
      });

      const row = service.evaluateCipher(cipher, passkeyServices);

      expect(row).not.toBeNull();
      expect(row!.cipher.id).toBe("1");
      expect(row!.instructions).toBe("https://example.com/setup");
    });

    it("should return null for a non-matching cipher", () => {
      const cipher = createCipherView({
        id: "1",
        login: { uris: [{ uri: "https://nomatch.com" }] },
      });

      expect(service.evaluateCipher(cipher, passkeyServices)).toBeNull();
    });
  });

  describe("buildPasskeyCipherRow", () => {
    it("should map instructions to undefined when empty string", () => {
      const cipher = createCipherView({ id: "1" });
      const entry: PasskeyServiceEntry = {
        instructions: "",
        supportsPasskeyLogin: true,
        supportsPasskeyMfa: false,
      };

      const row = service.buildPasskeyCipherRow(cipher, entry);

      expect(row.instructions).toBeUndefined();
    });

    it("should preserve non-empty instructions", () => {
      const cipher = createCipherView({ id: "1" });
      const entry: PasskeyServiceEntry = {
        instructions: "https://example.com/setup",
        supportsPasskeyLogin: true,
        supportsPasskeyMfa: false,
      };

      const row = service.buildPasskeyCipherRow(cipher, entry);

      expect(row.instructions).toBe("https://example.com/setup");
    });
  });

  describe("applyDialogResult", () => {
    const existingRows: PasskeyCipherRow[] = [
      {
        cipher: { id: "cipher-1" } as CipherView,
        instructions: "https://example.com/setup",
        supportsPasskeyLogin: true,
        supportsPasskeyMfa: false,
      },
      {
        cipher: { id: "cipher-2" } as CipherView,
        instructions: undefined,
        supportsPasskeyLogin: false,
        supportsPasskeyMfa: true,
      },
    ];

    it("should remove cipher when action is deleted", () => {
      const result = service.applyDialogResult(
        existingRows,
        "deleted",
        { id: "cipher-1" } as CipherView,
        passkeyServices,
      );

      expect(result.length).toBe(1);
      expect(result[0].cipher.id).toBe("cipher-2");
    });

    it("should not mutate original array on delete", () => {
      service.applyDialogResult(
        existingRows,
        "deleted",
        { id: "cipher-1" } as CipherView,
        passkeyServices,
      );

      expect(existingRows.length).toBe(2);
    });

    it("should replace cipher when action is saved and cipher still matches", () => {
      const updatedServices = new Map<string, PasskeyServiceEntry>([
        [
          "example.com",
          {
            instructions: "https://example.com/updated",
            supportsPasskeyLogin: true,
            supportsPasskeyMfa: true,
          },
        ],
      ]);

      const updatedCipher = createCipherView({
        id: "cipher-1",
        login: { uris: [{ uri: "https://example.com" }] },
      });

      const result = service.applyDialogResult(
        existingRows,
        "saved",
        { id: "cipher-1" } as CipherView,
        updatedServices,
        updatedCipher,
      );

      expect(result.length).toBe(2);
      expect(result[0].cipher.id).toBe("cipher-1");
      expect(result[0].instructions).toBe("https://example.com/updated");
    });

    it("should remove cipher when action is saved but cipher no longer matches", () => {
      const updatedCipher = createCipherView({
        id: "cipher-1",
        login: { uris: [{ uri: "https://nomatch.com" }] },
      });

      const result = service.applyDialogResult(
        existingRows,
        "saved",
        { id: "cipher-1" } as CipherView,
        passkeyServices,
        updatedCipher,
      );

      expect(result.length).toBe(1);
      expect(result[0].cipher.id).toBe("cipher-2");
    });

    it("should return copy of rows when action is saved but no updatedCipherView provided", () => {
      const result = service.applyDialogResult(
        existingRows,
        "saved",
        { id: "cipher-1" } as CipherView,
        passkeyServices,
      );

      expect(result.length).toBe(2);
      expect(result).not.toBe(existingRows);
    });
  });

  function createCipherView({
    id = "test-id",
    type = CipherType.Login,
    login = {} as any,
    isDeleted = false,
    edit = true,
    viewPassword = true,
  }: any = {}): CipherView {
    return {
      id,
      type,
      login: {
        hasUris: true,
        hasFido2Credentials: false,
        uris: [],
        ...login,
      },
      isDeleted,
      edit,
      viewPassword,
    } as unknown as CipherView;
  }
});
