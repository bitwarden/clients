import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { ButtonModule, DialogService, ToastService } from "@bitwarden/components";
import { ArchiveCipherUtilitiesService, PasswordRepromptService } from "@bitwarden/vault";

import { ItemFooterComponent } from "./item-footer.component";

describe("ItemFooterComponent", () => {
  let component: ItemFooterComponent;
  let fixture: ComponentFixture<ItemFooterComponent>;
  let accountService: FakeAccountService;

  const mockUserId = Utils.newGuid() as UserId;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(mockUserId);

    const cipherArchiveService = {
      userCanArchive$: jest.fn().mockReturnValue(of(false)),
      hasArchiveFlagEnabled$: of(false),
    };

    await TestBed.configureTestingModule({
      imports: [ItemFooterComponent, ButtonModule, JslibModule],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: CipherAuthorizationService, useValue: mock<CipherAuthorizationService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: ArchiveCipherUtilitiesService, useValue: mock<ArchiveCipherUtilitiesService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemFooterComponent);
    component = fixture.componentInstance;
  });

  const createCipherView = (overrides: Partial<CipherView> = {}): CipherView => {
    const cipher = new CipherView();
    cipher.id = "test-cipher-id";
    cipher.permissions = {
      delete: false,
      restore: false,
      manage: false,
      edit: false,
      view: false,
      viewPassword: false,
    };
    return Object.assign(cipher, overrides);
  };

  describe("delete button visibility", () => {
    it("shows the delete button when cipher.permissions.delete is true and action is 'view'", async () => {
      const cipher = createCipherView({
        permissions: {
          delete: true,
          restore: false,
          manage: false,
          edit: false,
          view: false,
          viewPassword: false,
        },
      });

      component.cipher = cipher;
      component.action = "view";

      await component.ngOnInit();
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(
        By.css('[data-test-id="footer-delete-button"]'),
      );

      expect(deleteButton).toBeTruthy();
    });

    it("shows the delete button when cipher.permissions.delete is true and action is 'edit'", async () => {
      const cipher = createCipherView({
        permissions: {
          delete: true,
          restore: false,
          manage: false,
          edit: false,
          view: false,
          viewPassword: false,
        },
      });

      component.cipher = cipher;
      component.action = "edit";

      await component.ngOnInit();
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(
        By.css('[data-test-id="footer-delete-button"]'),
      );

      expect(deleteButton).toBeTruthy();
    });

    it("does not show the delete button when cipher.permissions.delete is false", async () => {
      const cipher = createCipherView({
        permissions: {
          delete: false,
          restore: false,
          manage: false,
          edit: false,
          view: false,
          viewPassword: false,
        },
      });

      component.cipher = cipher;
      component.action = "view";

      await component.ngOnInit();
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(
        By.css('[data-test-id="footer-delete-button"]'),
      );

      expect(deleteButton).toBeFalsy();
    });

    it("does not show the delete button when action is not 'view' or 'edit'", async () => {
      const cipher = createCipherView({
        permissions: {
          delete: true,
          restore: false,
          manage: false,
          edit: false,
          view: false,
          viewPassword: false,
        },
      });

      component.cipher = cipher;
      component.action = "add";

      await component.ngOnInit();
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(
        By.css('[data-test-id="footer-delete-button"]'),
      );

      expect(deleteButton).toBeFalsy();
    });
  });
});
