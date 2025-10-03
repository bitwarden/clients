import { ChangeDetectorRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { ToastService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

import { CipherFormConfig } from "../abstractions/cipher-form-config.service";
import { CipherFormService } from "../abstractions/cipher-form.service";
import { CipherFormCacheService } from "../services/default-cipher-form-cache.service";

import { CipherFormComponent } from "./cipher-form.component";

describe("CipherFormComponent", () => {
  let component: CipherFormComponent;
  let fixture: ComponentFixture<CipherFormComponent>;

  const decryptCipher = jest.fn().mockResolvedValue(new CipherView());

  const mockAccountService = mock<AccountService>();
  const mockCipherArchiveService = mock<CipherArchiveService>();
  const mockAddEditFormService = { saveCipher: jest.fn(), decryptCipher };

  beforeEach(async () => {
    decryptCipher.mockClear();

    await TestBed.configureTestingModule({
      imports: [CipherFormComponent, ReactiveFormsModule],
      providers: [
        { provide: ChangeDetectorRef, useValue: {} },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: CipherFormService, useValue: mockAddEditFormService },
        {
          provide: CipherFormCacheService,
          useValue: { init: jest.fn(), getCachedCipherView: jest.fn() },
        },
        { provide: ViewCacheService, useValue: { signal: jest.fn(() => () => null) } },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: AccountService, useValue: mockAccountService },
        { provide: CipherArchiveService, useValue: mockCipherArchiveService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CipherFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create the component", () => {
    expect(component).toBeTruthy();
  });

  describe("submit", () => {
    beforeEach(() => {
      component.config = { mode: "edit" } as CipherFormConfig;

      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].archivedDate = new Date();
    });

    it("should remove archivedDate when user cannot archive and cipher is archived", async () => {
      mockAccountService.activeAccount$ = of({ id: "user-id" as UserId } as Account);
      mockCipherArchiveService.userCanArchive$.mockReturnValue(of(false));
      mockAddEditFormService.saveCipher = jest.fn().mockResolvedValue(new CipherView());

      const originalArchivedDate = component["updatedCipherView"]?.archivedDate;
      expect(originalArchivedDate).not.toBeNull();

      await component.submit();

      expect(component["updatedCipherView"]?.archivedDate).toBeNull();
      expect(mockCipherArchiveService.userCanArchive$).toHaveBeenCalledWith("user-id");
    });
  });

  describe("website", () => {
    it("should return null if updatedCipherView is null", () => {
      component["updatedCipherView"] = null as any;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login is undefined", () => {
      component["updatedCipherView"] = new CipherView();
      delete component["updatedCipherView"].login;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login is null", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = null as any;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login.uris is undefined", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: undefined } as any;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login.uris is null", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: null } as any;
      expect(component.website).toBeNull();
    });

    it("should return null if updatedCipherView.login.uris is an empty array", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: [] } as any;
      expect(component.website).toBeNull();
    });

    it("should return updatedCipherView if login.uris contains at least one URI", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: [{ uri: "https://example.com" }] } as any;
      expect(component.website).toEqual("https://example.com");
    });
  });

  describe("clone", () => {
    const cipherView = new CipherView();
    cipherView.id = "test-id";
    cipherView.login.fido2Credentials = [new Fido2CredentialView()];

    beforeEach(() => {
      component.config = {
        mode: "clone",
        originalCipher: new Cipher(),
      } as CipherFormConfig;

      decryptCipher.mockResolvedValue(cipherView);
    });

    it("clears id on updatedCipherView", async () => {
      await component.ngOnInit();

      expect(component["updatedCipherView"]?.id).toBeNull();
    });

    it("clears fido2Credentials on updatedCipherView", async () => {
      await component.ngOnInit();

      expect(component["updatedCipherView"]?.login.fido2Credentials).toBeNull();
    });
  });

  describe("enableFormFields", () => {
    beforeEach(() => {
      // disable the form so enabling occurs
      component.disableFormFields();
    });

    it("only enables the form when it is disabled", () => {
      jest.spyOn(component["cipherForm"], "enable");
      component.enableFormFields();

      expect(component["cipherForm"].enable).toHaveBeenCalled();

      component.enableFormFields();
      component.enableFormFields();

      // enable is only called once
      expect(component["cipherForm"].enable).toHaveBeenCalledTimes(1);
    });

    it("emits formStatusChange$", (done) => {
      component.formStatusChange$.subscribe((status) => {
        expect(status).toBe("enabled");
        done();
      });

      component.enableFormFields();
    });
  });
});
