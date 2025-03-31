import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { mockAccountServiceWith } from "../../../../../../common/spec";

import { DeleteAttachmentComponent } from "./delete-attachment.component";

describe("DeleteAttachmentComponent", () => {
  let component: DeleteAttachmentComponent;
  let fixture: ComponentFixture<DeleteAttachmentComponent>;
  const showToast = jest.fn();
  const attachment = {
    id: "222-3333-4444",
    url: "attachment-url",
    fileName: "attachment-filename",
    size: "1234",
  } as AttachmentView;

  const deleteAttachmentWithServer = jest.fn().mockResolvedValue(null);
  const openSimpleDialog = jest.fn().mockResolvedValue(true);

  beforeEach(async () => {
    deleteAttachmentWithServer.mockClear();
    showToast.mockClear();
    openSimpleDialog.mockClear().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [DeleteAttachmentComponent],
      providers: [
        {
          provide: CipherService,
          useValue: { deleteAttachmentWithServer },
        },
        {
          provide: ToastService,
          useValue: { showToast },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: AccountService, useValue: mockAccountServiceWith("UserId" as UserId) },
      ],
    })
      .overrideProvider(DialogService, {
        useValue: {
          openSimpleDialog,
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DeleteAttachmentComponent);
    component = fixture.componentInstance;
    component.cipherId = "5555-444-3333";
    component.attachment = attachment;
    fixture.detectChanges();
  });

  it("renders delete button", () => {
    const deleteButton = fixture.debugElement.query(By.css("button"));

    expect(deleteButton.attributes["title"]).toBe("deleteAttachmentName");
  });

  it("does not delete when the user cancels the dialog", async () => {
    openSimpleDialog.mockResolvedValue(false);

    await component.delete();

    expect(openSimpleDialog).toHaveBeenCalledWith({
      title: { key: "deleteAttachment" },
      content: { key: "permanentlyDeleteAttachmentConfirmation" },
      type: "warning",
    });

    expect(deleteAttachmentWithServer).not.toHaveBeenCalled();
  });

  it("deletes the attachment", async () => {
    await component.delete();

    expect(openSimpleDialog).toHaveBeenCalledWith({
      title: { key: "deleteAttachment" },
      content: { key: "permanentlyDeleteAttachmentConfirmation" },
      type: "warning",
    });

    // Called with cipher id and attachment id
    expect(deleteAttachmentWithServer).toHaveBeenCalledWith(
      "5555-444-3333",
      "222-3333-4444",
      "UserId",
    );
  });

  it("shows toast message on successful deletion", async () => {
    await component.delete();

    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "",
      message: "deletedAttachment",
    });
  });
});
