import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PasskeyDirectoryApiService } from "@bitwarden/common/dirt/services/abstractions/passkey-directory-api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { PasskeyReportComponent } from "./passkey-report.component";
import { PasskeyReportService } from "./passkey-report.service";

describe("PasskeyReportComponent", () => {
  let component: PasskeyReportComponent;
  let fixture: ComponentFixture<PasskeyReportComponent>;
  let organizationService: MockProxy<OrganizationService>;
  let cipherServiceMock: MockProxy<CipherService>;
  let syncServiceMock: MockProxy<SyncService>;
  let logServiceMock: MockProxy<LogService>;
  let passkeyDirectoryApiServiceMock: MockProxy<PasskeyDirectoryApiService>;
  const userId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(userId);

  beforeEach(async () => {
    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));
    cipherServiceMock = mock<CipherService>();
    cipherServiceMock.getAllDecrypted.mockResolvedValue([]);
    syncServiceMock = mock<SyncService>();
    logServiceMock = mock<LogService>();
    passkeyDirectoryApiServiceMock = mock<PasskeyDirectoryApiService>();
    passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [PasskeyReportComponent, I18nPipe],
      providers: [
        {
          provide: CipherService,
          useValue: cipherServiceMock,
        },
        {
          provide: OrganizationService,
          useValue: organizationService,
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: DialogService,
          useValue: mock<DialogService>(),
        },
        {
          provide: LogService,
          useValue: logServiceMock,
        },
        {
          provide: PasskeyDirectoryApiService,
          useValue: passkeyDirectoryApiServiceMock,
        },
        {
          provide: PasswordRepromptService,
          useValue: mock<PasswordRepromptService>(),
        },
        {
          provide: SyncService,
          useValue: syncServiceMock,
        },
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
        {
          provide: CipherFormConfigService,
          useValue: mock<CipherFormConfigService>(),
        },
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({}),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(PasskeyReportComponent, {
        set: {
          imports: [I18nPipe],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
          providers: [PasskeyReportService],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PasskeyReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it("should call fullSync on init", () => {
    expect(syncServiceMock.fullSync).toHaveBeenCalledWith(false);
  });

  describe("setCiphers", () => {
    it("should not set ciphers when passkey directory is empty", async () => {
      passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([]);

      cipherServiceMock.getAllDecrypted.mockResolvedValue([]);

      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(0);
    });

    it("should filter ciphers that match passkey directory entries", async () => {
      passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([
        { domainName: "example.com", instructions: "https://example.com/passkey-setup" } as any,
        { domainName: "test.com", instructions: "" } as any,
      ]);

      const ciphers = [
        createCipherView({
          id: "cipher-1",
          login: { uris: [{ uri: "https://example.com/login" }] },
        }),
        createCipherView({
          id: "cipher-2",
          login: { uris: [{ uri: "https://nomatch.com/login" }] },
        }),
        createCipherView({
          id: "cipher-3",
          login: { uris: [{ uri: "https://test.com/login" }] },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);

      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(2);
      expect((component as any).ciphers()[0].cipher.id).toEqual("cipher-1");
      expect((component as any).ciphers()[1].cipher.id).toEqual("cipher-3");
    });

    it("should populate instructions for entries with instructions URLs", async () => {
      passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([
        { domainName: "example.com", instructions: "https://example.com/passkey-setup" } as any,
        { domainName: "test.com", instructions: "" } as any,
      ]);

      const ciphers = [
        createCipherView({
          id: "cipher-1",
          login: { uris: [{ uri: "https://example.com/login" }] },
        }),
        createCipherView({
          id: "cipher-2",
          login: { uris: [{ uri: "https://test.com/login" }] },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);

      await component.setCiphers();

      const rows = (component as any).ciphers();
      const row1 = rows.find((r: any) => r.cipher.id === "cipher-1");
      const row2 = rows.find((r: any) => r.cipher.id === "cipher-2");
      expect(row1?.instructions).toEqual("https://example.com/passkey-setup");
      // Empty instructions should be undefined
      expect(row2?.instructions).toBeUndefined();
    });

    it("should log error when loadPasskeyServices fails", async () => {
      passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockRejectedValue(
        new Error("API failure"),
      );

      await component.setCiphers();

      expect(logServiceMock.error).toHaveBeenCalled();
    });
  });

  describe("getPasskeyDocUrl (via setCiphers)", () => {
    beforeEach(() => {
      passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([
        { domainName: "example.com", instructions: "https://example.com/passkey-doc" } as any,
      ]);
    });

    it("should exclude non-login ciphers", async () => {
      const ciphers = [
        createCipherView({
          id: "cipher-1",
          type: CipherType.SecureNote,
          login: { uris: [{ uri: "https://example.com" }] },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);
      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(0);
    });

    it("should exclude ciphers without URIs", async () => {
      const ciphers = [
        createCipherView({
          id: "cipher-1",
          login: { hasUris: false, uris: [] },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);
      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(0);
    });

    it("should exclude ciphers that already have fido2 credentials", async () => {
      const ciphers = [
        createCipherView({
          id: "cipher-1",
          login: {
            hasFido2Credentials: true,
            uris: [{ uri: "https://example.com" }],
          },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);
      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(0);
    });

    it("should exclude deleted ciphers", async () => {
      const ciphers = [
        createCipherView({
          id: "cipher-1",
          isDeleted: true,
          login: { uris: [{ uri: "https://example.com" }] },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);
      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(0);
    });

    it("should include ciphers without edit access", async () => {
      const ciphers = [
        createCipherView({
          id: "cipher-1",
          edit: false,
          login: { uris: [{ uri: "https://example.com" }] },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);
      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(1);
    });

    it("should exclude ciphers without viewPassword", async () => {
      const ciphers = [
        createCipherView({
          id: "cipher-1",
          viewPassword: false,
          login: { uris: [{ uri: "https://example.com" }] },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);
      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(0);
    });

    it("should match URIs with www prefix stripped", async () => {
      const ciphers = [
        createCipherView({
          id: "cipher-1",
          login: { uris: [{ uri: "https://www.example.com/login" }] },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);
      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(1);
    });

    it("should check all URIs and match if any matches", async () => {
      const ciphers = [
        createCipherView({
          id: "cipher-1",
          login: {
            uris: [{ uri: "https://nomatch.com" }, { uri: "https://example.com/dashboard" }],
          },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);
      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(1);
    });

    it("should skip URIs that are null or empty", async () => {
      const ciphers = [
        createCipherView({
          id: "cipher-1",
          login: {
            uris: [{ uri: null }, { uri: "" }, { uri: "https://example.com" }],
          },
        }),
      ];

      cipherServiceMock.getAllDecrypted.mockResolvedValue(ciphers);
      await component.setCiphers();

      expect((component as any).ciphers().length).toEqual(1);
    });
  });

  describe("canManageCipher", () => {
    it("should always return true", () => {
      const cipher = createCipherView({ id: "any-cipher" });
      expect((component as any).canManageCipher(cipher)).toBe(true);
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
