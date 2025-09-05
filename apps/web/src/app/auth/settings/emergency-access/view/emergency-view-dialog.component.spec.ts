import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId, EmergencyAccessId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { TaskService } from "@bitwarden/common/vault/tasks";
import { DialogService, DialogRef, DIALOG_DATA } from "@bitwarden/components";
import { ChangeLoginPasswordService } from "@bitwarden/vault";

import { EmergencyViewDialogComponent } from "./emergency-view-dialog.component";

describe("EmergencyViewDialogComponent", () => {
  let component: EmergencyViewDialogComponent;
  let fixture: ComponentFixture<EmergencyViewDialogComponent>;

  const open = jest.fn();
  const close = jest.fn();
  const emergencyAccessId = "emergency-access-id" as EmergencyAccessId;

  const mockCipher = {
    id: "cipher1",
    name: "Cipher",
    type: CipherType.Login,
    login: { uris: [] } as Partial<LoginView>,
    card: {},
  } as Partial<CipherView> as CipherView;

  const accountService: FakeAccountService = mockAccountServiceWith(Utils.newGuid() as UserId);

  beforeEach(async () => {
    open.mockClear();
    close.mockClear();

    await TestBed.configureTestingModule({
      imports: [EmergencyViewDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: AccountService, useValue: accountService },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: FolderService, useValue: mock<FolderService>() },
        { provide: I18nService, useValue: { t: (...keys: string[]) => keys.join(" ") } },
        { provide: DialogService, useValue: { open } },
        { provide: DialogRef, useValue: { close } },
        { provide: DIALOG_DATA, useValue: { cipher: mockCipher } },
        { provide: AccountService, useValue: accountService },
        { provide: TaskService, useValue: mock<TaskService>() },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.example.com" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
      ],
    })
      .overrideComponent(EmergencyViewDialogComponent, {
        remove: {
          providers: [
            { provide: PlatformUtilsService, useValue: PlatformUtilsService },
            {
              provide: ChangeLoginPasswordService,
              useValue: ChangeLoginPasswordService,
            },
            { provide: ConfigService, useValue: ConfigService },
            { provide: CipherService, useValue: mock<CipherService>() },
          ],
        },
        add: {
          providers: [
            { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
            {
              provide: ChangeLoginPasswordService,
              useValue: mock<ChangeLoginPasswordService>(),
            },
            { provide: ConfigService, useValue: mock<ConfigService>() },
            { provide: CipherService, useValue: mock<CipherService>() },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EmergencyViewDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  it("opens dialog", () => {
    EmergencyViewDialogComponent.open({ open } as unknown as DialogService, {
      cipher: mockCipher,
      emergencyAccessId,
    });

    expect(open).toHaveBeenCalled();
  });

  it("closes the dialog", () => {
    EmergencyViewDialogComponent.open({ open } as unknown as DialogService, {
      cipher: mockCipher,
      emergencyAccessId,
    });
    fixture.detectChanges();

    const cancelButton = fixture.debugElement.queryAll(By.css("button")).pop();

    cancelButton!.nativeElement.click();

    expect(close).toHaveBeenCalled();
  });

  describe("updateTitle", () => {
    it("sets login title", () => {
      mockCipher.type = CipherType.Login;

      component["updateTitle"]();

      expect(component["title"]).toBe("viewItemHeaderLogin");
    });

    it("sets card title", () => {
      mockCipher.type = CipherType.Card;

      component["updateTitle"]();

      expect(component["title"]).toBe("viewItemHeaderCard");
    });

    it("sets identity title", () => {
      mockCipher.type = CipherType.Identity;

      component["updateTitle"]();

      expect(component["title"]).toBe("viewItemHeaderIdentity");
    });

    it("sets note title", () => {
      mockCipher.type = CipherType.SecureNote;

      component["updateTitle"]();

      expect(component["title"]).toBe("viewItemHeaderNote");
    });
  });
});
