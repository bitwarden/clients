import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ButtonComponent, ToastService } from "@bitwarden/components";
import { DownloadAttachmentComponent } from "@bitwarden/vault";

import { FakeAccountService, mockAccountServiceWith } from "../../../../../common/spec";

import { CipherAttachmentsComponent } from "./cipher-attachments.component";
import { DeleteAttachmentComponent } from "./delete-attachment/delete-attachment.component";

@Component({
  selector: "app-download-attachment",
  template: "",
})
class MockDownloadAttachmentComponent {
  @Input() attachment: AttachmentView;
  @Input() cipher: CipherView;
  @Input() admin: boolean = false;
}

describe("CipherAttachmentsComponent", () => {
  let component: CipherAttachmentsComponent;
  let fixture: ComponentFixture<CipherAttachmentsComponent>;
  const showToast = jest.fn();
  const cipherView = {
    id: "5555-444-3333",
    type: CipherType.Login,
    name: "Test Login",
    login: {
      username: "username",
      password: "password",
    },
  } as CipherView;

  const cipherDomain = {
    decrypt: () => cipherView,
  };

  const organization = new Organization();
  organization.type = OrganizationUserType.Admin;
  organization.allowAdminAccessToAllCollectionItems = true;

  const cipherServiceGet = jest.fn().mockResolvedValue(cipherDomain);
  const saveAttachmentWithServer = jest.fn().mockResolvedValue(cipherDomain);

  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  beforeEach(async () => {
    cipherServiceGet.mockClear();
    showToast.mockClear();
    saveAttachmentWithServer.mockClear().mockResolvedValue(cipherDomain);

    await TestBed.configureTestingModule({
      imports: [CipherAttachmentsComponent],
      providers: [
        {
          provide: CipherService,
          useValue: {
            organization,
            get: cipherServiceGet,
            saveAttachmentWithServer,
            getKeyForCipherKeyDecryption: () => Promise.resolve(null),
            decrypt: jest.fn().mockResolvedValue(cipherView),
          },
        },
        {
          provide: ToastService,
          useValue: {
            showToast,
          },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: ApiService,
          useValue: mock<ApiService>(),
        },
        {
          provide: OrganizationService,
          useValue: mock<OrganizationService>(),
        },
      ],
    })
      .overrideComponent(CipherAttachmentsComponent, {
        remove: {
          imports: [DownloadAttachmentComponent],
        },
        add: {
          imports: [MockDownloadAttachmentComponent],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CipherAttachmentsComponent);
    component = fixture.componentInstance;
    component.cipherId = "5555-444-3333" as CipherId;
    component.submitBtn = TestBed.createComponent(ButtonComponent).componentInstance;
    fixture.detectChanges();
  });

  it("fetches cipherView using `cipherId`", async () => {
    await component.ngOnInit();

    expect(cipherServiceGet).toHaveBeenCalledWith("5555-444-3333", mockUserId);
    expect(component.cipher).toEqual(cipherView);
  });

  it("sets testids for automation testing", () => {
    const attachment = {
      id: "1234-5678",
      fileName: "test file.txt",
      sizeName: "244.2 KB",
    } as AttachmentView;

    component.cipher.attachments = [attachment];

    fixture.detectChanges();

    const fileName = fixture.debugElement.query(By.css('[data-testid="file-name"]'));
    const fileSize = fixture.debugElement.query(By.css('[data-testid="file-size"]'));

    expect(fileName.nativeElement.textContent).toEqual(attachment.fileName);
    expect(fileSize.nativeElement.textContent).toEqual(attachment.sizeName);
  });

  describe("bitSubmit", () => {
    beforeEach(() => {
      component.submitBtn.disabled.set(undefined);
      component.submitBtn.loading.set(undefined);
    });

    it("updates sets initial state of the submit button", async () => {
      await component.ngOnInit();

      expect(component.submitBtn.disabled()).toBe(true);
    });

    it("sets submitBtn loading state", () => {
      jest.useFakeTimers();

      component.bitSubmit.loading = true;

      jest.runAllTimers();

      expect(component.submitBtn.loading()).toBe(true);

      component.bitSubmit.loading = false;

      expect(component.submitBtn.loading()).toBe(false);
    });

    it("sets submitBtn disabled state", () => {
      component.bitSubmit.disabled = true;

      expect(component.submitBtn.disabled()).toBe(true);

      component.bitSubmit.disabled = false;

      expect(component.submitBtn.disabled()).toBe(false);
    });
  });

  describe("attachmentForm", () => {
    let file: File;

    beforeEach(() => {
      component.submitBtn.disabled.set(undefined);
      file = new File([""], "attachment.txt", { type: "text/plain" });

      const inputElement = fixture.debugElement.query(By.css("input[type=file]"));

      // Set the file value of the input element
      Object.defineProperty(inputElement.nativeElement, "files", {
        value: [file],
        writable: false,
      });

      // Trigger change event, for event listeners
      inputElement.nativeElement.dispatchEvent(new InputEvent("change"));
    });

    it("sets value of `file` control when input changes", () => {
      expect(component.attachmentForm.controls.file.value.name).toEqual(file.name);
    });

    it("updates disabled state of submit button", () => {
      expect(component.submitBtn.disabled()).toBe(false);
    });
  });

  describe("submit", () => {
    describe("error", () => {
      it("shows error toast if no file is selected", async () => {
        await component.submit();

        expect(showToast).toHaveBeenCalledWith({
          variant: "error",
          title: "errorOccurred",
          message: "selectFile",
        });
      });

      it("shows error toast if file size is greater than 500MB", async () => {
        component.attachmentForm.controls.file.setValue({
          size: 524288001,
        } as File);

        await component.submit();

        expect(showToast).toHaveBeenCalledWith({
          variant: "error",
          title: "errorOccurred",
          message: "maxFileSize",
        });
      });
    });

    describe("success", () => {
      const file = { size: 524287999 } as File;

      beforeEach(() => {
        component.attachmentForm.controls.file.setValue(file);
        component.organization = organization;
      });

      it("calls `saveAttachmentWithServer` with admin=false when admin permission is false for organization", async () => {
        component.organization.allowAdminAccessToAllCollectionItems = false;
        await component.submit();

        expect(saveAttachmentWithServer).toHaveBeenCalledWith(
          cipherDomain,
          file,
          mockUserId,
          false,
        );
      });

      it("calls `saveAttachmentWithServer` with admin=true when using admin API", async () => {
        component.organization.allowAdminAccessToAllCollectionItems = true;
        await component.submit();

        expect(saveAttachmentWithServer).toHaveBeenCalledWith(cipherDomain, file, mockUserId, true);
      });

      it("resets form and input values", async () => {
        await component.submit();

        const fileInput = fixture.debugElement.query(By.css("input[type=file]"));

        expect(fileInput.nativeElement.value).toEqual("");
        expect(component.attachmentForm.controls.file.value).toEqual(null);
      });

      it("shows success toast", async () => {
        await component.submit();

        expect(showToast).toHaveBeenCalledWith({
          variant: "success",
          title: null,
          message: "attachmentSaved",
        });
      });

      it('emits "onUploadSuccess"', async () => {
        const emitSpy = jest.spyOn(component.onUploadSuccess, "emit");

        await component.submit();

        expect(emitSpy).toHaveBeenCalled();
      });
    });
  });

  describe("removeAttachment", () => {
    const attachment = { id: "1234-5678" } as AttachmentView;

    beforeEach(() => {
      component.cipher.attachments = [attachment];

      fixture.detectChanges();
    });

    it("removes attachment from cipher", () => {
      const deleteAttachmentComponent = fixture.debugElement.query(
        By.directive(DeleteAttachmentComponent),
      ).componentInstance as DeleteAttachmentComponent;

      deleteAttachmentComponent.onDeletionSuccess.emit();

      expect(component.cipher.attachments).toEqual([]);
    });
  });
});
