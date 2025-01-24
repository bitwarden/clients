import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { EmergencyViewDialogComponent } from "./emergency-view-dialog.component";

describe("EmergencyViewDialogComponent", () => {
  let component: EmergencyViewDialogComponent;
  let fixture: ComponentFixture<EmergencyViewDialogComponent>;

  const open = jest.fn();
  const close = jest.fn();

  const mockCipher = {
    id: "cipher1",
    name: "Cipher",
    type: CipherType.Login,
    login: { uris: [] },
    card: {},
  } as CipherView;

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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmergencyViewDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  it("opens dialog", () => {
    EmergencyViewDialogComponent.open({ open } as unknown as DialogService, { cipher: mockCipher });

    expect(open).toHaveBeenCalled();
  });

  it("closes the dialog", () => {
    EmergencyViewDialogComponent.open({ open } as unknown as DialogService, { cipher: mockCipher });
    fixture.detectChanges();

    const cancelButton = fixture.debugElement.queryAll(By.css("button")).pop();

    cancelButton.nativeElement.click();

    expect(close).toHaveBeenCalled();
  });

  describe("updateTitle", () => {
    it("sets login title", () => {
      mockCipher.type = CipherType.Login;

      component["updateTitle"]();

      expect(component["title"]).toBe("viewItemType typelogin");
    });

    it("sets card title", () => {
      mockCipher.type = CipherType.Card;

      component["updateTitle"]();

      expect(component["title"]).toBe("viewItemType typecard");
    });

    it("sets identity title", () => {
      mockCipher.type = CipherType.Identity;

      component["updateTitle"]();

      expect(component["title"]).toBe("viewItemType typeidentity");
    });

    it("sets note title", () => {
      mockCipher.type = CipherType.SecureNote;

      component["updateTitle"]();

      expect(component["title"]).toBe("viewItemType note");
    });
  });
});
