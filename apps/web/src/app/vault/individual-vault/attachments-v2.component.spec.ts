import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  AttachmentsV2Component,
  AttachmentDialogResult,
  AttachmentsDialogParams,
} from "./attachments-v2.component";

describe("AttachmentsV2Component", () => {
  let component: AttachmentsV2Component;
  let fixture: ComponentFixture<AttachmentsV2Component>;

  const mockCipherId: CipherId = "cipher-id" as CipherId;
  const mockOrganizationId: OrganizationId = "organization-id" as OrganizationId;
  const mockParams: AttachmentsDialogParams = {
    cipherId: mockCipherId,
    organizationId: mockOrganizationId,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachmentsV2Component, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: mockParams },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AttachmentsV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("initializes without errors and with the correct cipherId and organizationId", () => {
    expect(component).toBeTruthy();
    expect(component.cipherId).toBe(mockParams.cipherId);
    expect(component.organizationId).toBe(mockParams.organizationId);
  });

  it("closes the dialog with 'uploaded' result on uploadSuccessful", () => {
    const dialogRefCloseSpy = jest.spyOn(component["dialogRef"], "close");

    component.uploadSuccessful();

    expect(dialogRefCloseSpy).toHaveBeenCalledWith({ action: AttachmentDialogResult.Uploaded });
  });

  it("closes the dialog with 'removed' result on removalSuccessful", () => {
    const dialogRefCloseSpy = jest.spyOn(component["dialogRef"], "close");

    component.removalSuccessful();

    expect(dialogRefCloseSpy).toHaveBeenCalledWith({ action: AttachmentDialogResult.Removed });
  });
});
