import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

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
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockDownloadAttachmentComponent {
  readonly attachment = input<AttachmentView>();
  readonly cipher = input<CipherView>();
  readonly admin = input<boolean>(false);
}

describe("CipherAttachmentsComponent", () => {
  let component: CipherAttachmentsComponent;
  let fixture: ComponentFixture<CipherAttachmentsComponent>;
  let submitBtnFixture: ComponentFixture<ButtonComponent>;
  const showToast = jest.fn();
  const cipherView = {
    id: "5555-444-3333",
    type: CipherType.Login,
    name: "Test Login",
    login: {
      username: "username",
      password: "password",
    },
    edit: true,
  } as CipherView;

  const cipherDomain = {
    decrypt: () => cipherView,
  };

  const organization = new Organization();
  organization.id = "org-123" as OrganizationId;
  organization.type = OrganizationUserType.Admin;
  organization.allowAdminAccessToAllCollectionItems = true;

  const cipherServiceGet = jest.fn().mockResolvedValue(cipherDomain);
  const cipherServiceDecrypt = jest.fn().mockResolvedValue(cipherView);
  const saveAttachmentWithServer = jest.fn().mockResolvedValue(cipherDomain);

  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);
  const organizations$ = new BehaviorSubject<Organization[]>([organization]);

  beforeEach(async () => {
    cipherServiceGet.mockClear();
    cipherServiceDecrypt.mockClear().mockResolvedValue(cipherView);
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
            decrypt: cipherServiceDecrypt,
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
          useValue: {
            organizations$: () => organizations$.asObservable(),
          },
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
    submitBtnFixture = TestBed.createComponent(ButtonComponent);

    fixture.componentRef.setInput("cipherId", "5555-444-3333" as CipherId);
    fixture.componentRef.setInput("submitBtn", submitBtnFixture.componentInstance);
    fixture.detectChanges();
  });

  /**
   * Helper to wait for the async initialization effect to complete
   */
  async function waitForInitialization(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it("fetches cipherView using `cipherId`", async () => {
    await waitForInitialization();

    expect(cipherServiceGet).toHaveBeenCalledWith("5555-444-3333", mockUserId);
  });

  it("sets testids for automation testing", async () => {
    const attachment = {
      id: "1234-5678",
      fileName: "test file.txt",
      sizeName: "244.2 KB",
    } as AttachmentView;

    const cipherWithAttachments = { ...cipherView, attachments: [attachment] };
    cipherServiceDecrypt.mockResolvedValue(cipherWithAttachments);

    // Create fresh fixture to pick up the mock
    fixture = TestBed.createComponent(CipherAttachmentsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("cipherId", "5555-444-3333" as CipherId);
    fixture.detectChanges();

    await waitForInitialization();

    const fileName = fixture.debugElement.query(By.css('[data-testid="file-name"]'));
    const fileSize = fixture.debugElement.query(By.css('[data-testid="file-size"]'));

    expect(fileName.nativeElement.textContent.trim()).toEqual(attachment.fileName);
    expect(fileSize.nativeElement.textContent.trim()).toEqual(attachment.sizeName);
  });

  describe("bitSubmit", () => {
    it("updates sets initial state of the submit button", async () => {
      // Create fresh fixture to properly test initial state
      submitBtnFixture = TestBed.createComponent(ButtonComponent);
      submitBtnFixture.componentInstance.disabled.set(undefined as unknown as boolean);

      fixture = TestBed.createComponent(CipherAttachmentsComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput("submitBtn", submitBtnFixture.componentInstance);
      fixture.componentRef.setInput("cipherId", "5555-444-3333" as CipherId);
      fixture.detectChanges();

      await waitForInitialization();

      expect(submitBtnFixture.componentInstance.disabled()).toBe(true);
    });
  });

  describe("attachmentForm", () => {
    let file: File;

    beforeEach(() => {
      const nonEditableCipherView = { ...cipherView, edit: false };
      cipherServiceDecrypt.mockResolvedValue(nonEditableCipherView);
      fixture.detectChanges();

      submitBtnFixture.componentInstance.disabled.set(undefined as unknown as boolean);
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
      expect(component.attachmentForm.controls.file.value?.name).toEqual(file.name);
    });

    it("updates disabled state of submit button", () => {
      expect(submitBtnFixture.componentInstance.disabled()).toBe(false);
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

      it("shows error toast with server message when saveAttachmentWithServer fails", async () => {
        await waitForInitialization();

        const file = { size: 100 } as File;
        component.attachmentForm.controls.file.setValue(file);

        const serverError = new Error("Cipher has been modified by another client");
        saveAttachmentWithServer.mockRejectedValue(serverError);

        await component.submit();

        expect(showToast).toHaveBeenCalledWith({
          variant: "error",
          message: "Cipher has been modified by another client",
        });
      });

      it("shows error toast with fallback message when error has no message property", async () => {
        await waitForInitialization();

        const file = { size: 100 } as File;
        component.attachmentForm.controls.file.setValue(file);

        saveAttachmentWithServer.mockRejectedValue({ code: "UNKNOWN_ERROR" });

        await component.submit();

        expect(showToast).toHaveBeenCalledWith({
          variant: "error",
          message: "unexpectedError",
        });
      });

      it("shows error toast with string error message", async () => {
        await waitForInitialization();

        const file = { size: 100 } as File;
        component.attachmentForm.controls.file.setValue(file);

        saveAttachmentWithServer.mockRejectedValue("Network connection failed");

        await component.submit();

        expect(showToast).toHaveBeenCalledWith({
          variant: "error",
          message: "Network connection failed",
        });
      });
    });

    describe("success", () => {
      const file = { size: 524287999 } as File;

      async function setupWithOrganization(adminAccess: boolean): Promise<void> {
        // Create fresh fixture with organization set before cipherId
        organization.allowAdminAccessToAllCollectionItems = adminAccess;

        fixture = TestBed.createComponent(CipherAttachmentsComponent);
        component = fixture.componentInstance;
        submitBtnFixture = TestBed.createComponent(ButtonComponent);

        // Set organizationId BEFORE cipherId so the effect picks it up
        fixture.componentRef.setInput("organizationId", organization.id);
        fixture.componentRef.setInput("submitBtn", submitBtnFixture.componentInstance);
        fixture.componentRef.setInput("cipherId", "5555-444-3333" as CipherId);
        fixture.detectChanges();

        await waitForInitialization();
        component.attachmentForm.controls.file.setValue(file);
      }

      it("calls `saveAttachmentWithServer` with admin=false when admin permission is false for organization", async () => {
        await setupWithOrganization(false);

        await component.submit();

        expect(saveAttachmentWithServer).toHaveBeenCalledWith(
          cipherDomain,
          file,
          mockUserId,
          false,
        );
      });

      it("calls `saveAttachmentWithServer` with admin=true when using admin API", async () => {
        await setupWithOrganization(true);

        await component.submit();

        expect(saveAttachmentWithServer).toHaveBeenCalledWith(cipherDomain, file, mockUserId, true);
      });

      it("resets form and input values", async () => {
        await setupWithOrganization(true);

        await component.submit();

        const fileInput = fixture.debugElement.query(By.css("input[type=file]"));

        expect(fileInput.nativeElement.value).toEqual("");
        expect(component.attachmentForm.controls.file.value).toEqual(null);
      });

      it("shows success toast", async () => {
        await setupWithOrganization(true);

        await component.submit();

        expect(showToast).toHaveBeenCalledWith({
          variant: "success",
          message: "attachmentSaved",
        });
      });

      it('emits "onUploadSuccess"', async () => {
        await setupWithOrganization(true);

        const emitSpy = jest.spyOn(component.onUploadSuccess, "emit");

        await component.submit();

        expect(emitSpy).toHaveBeenCalled();
      });
    });

    describe("close", () => {
      async function setup(): Promise<void> {
        fixture = TestBed.createComponent(CipherAttachmentsComponent);
        component = fixture.componentInstance;
        submitBtnFixture = TestBed.createComponent(ButtonComponent);

        // Set organizationId BEFORE cipherId so the effect picks it up
        fixture.componentRef.setInput("organizationId", organization.id);
        fixture.componentRef.setInput("submitBtn", submitBtnFixture.componentInstance);
        fixture.componentRef.setInput("cipherId", "5555-444-3333" as CipherId);
        await waitForInitialization();
        const nonEditableCipherView = { ...cipherView, edit: false };
        cipherServiceDecrypt.mockResolvedValue(nonEditableCipherView);
        fixture.detectChanges();
      }

      it('emits "onCloseButtonPress"', async () => {
        await setup();
        const emitSpy = jest.spyOn(component.onCloseButtonPress, "emit");

        await component.submit();

        expect(emitSpy).toHaveBeenCalled();
      });
    });
  });

  describe("removeAttachment", () => {
    const attachment = { id: "1234-5678", fileName: "test.txt" } as AttachmentView;

    it("removes attachment from cipher", async () => {
      // Create a new fixture with cipher that has attachments
      const cipherWithAttachments = { ...cipherView, attachments: [attachment] };
      cipherServiceDecrypt.mockResolvedValue(cipherWithAttachments);

      // Create fresh fixture
      fixture = TestBed.createComponent(CipherAttachmentsComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput("cipherId", "5555-444-3333" as CipherId);
      fixture.detectChanges();

      await waitForInitialization();

      // Verify attachment is rendered
      const attachmentsBefore = fixture.debugElement.queryAll(By.css('[data-testid="file-name"]'));
      expect(attachmentsBefore.length).toEqual(1);

      const deleteAttachmentComponent = fixture.debugElement.query(
        By.directive(DeleteAttachmentComponent),
      ).componentInstance as DeleteAttachmentComponent;

      deleteAttachmentComponent.onDeletionSuccess.emit();

      fixture.detectChanges();

      // After removal, there should be no attachments displayed
      const attachmentItems = fixture.debugElement.queryAll(By.css('[data-testid="file-name"]'));
      expect(attachmentItems.length).toEqual(0);
    });
  });
});
