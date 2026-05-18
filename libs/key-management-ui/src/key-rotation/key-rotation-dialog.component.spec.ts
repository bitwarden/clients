import { DialogRef } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { KeyRotationDialogComponent } from "./key-rotation-dialog.component";
import { KeyRotationDialogService } from "./key-rotation-dialog.service";

describe("KeyRotationDialogComponent", () => {
  let component: KeyRotationDialogComponent;
  let fixture: ComponentFixture<KeyRotationDialogComponent>;

  let mockKeyRotationDialogService: MockProxy<KeyRotationDialogService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let mockDialogRef: MockProxy<DialogRef<KeyRotationDialogComponent>>;
  let mockValidationService: MockProxy<ValidationService>;
  let mockLogService: MockProxy<LogService>;

  const userId = "test-user-id" as UserId;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockKeyRotationDialogService = mock<KeyRotationDialogService>();
    const mockAccountService = mockAccountServiceWith(userId);
    mockDialogService = mock<DialogService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockDialogRef = mock<DialogRef<KeyRotationDialogComponent>>();
    mockValidationService = mock<ValidationService>();
    mockLogService = mock<LogService>();

    mockKeyRotationDialogService.hasLegacyCipherAttachments.mockResolvedValue(false);
    mockKeyRotationDialogService.rotateKeys.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [KeyRotationDialogComponent],
      providers: [
        { provide: KeyRotationDialogService, useValue: mockKeyRotationDialogService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: ValidationService, useValue: mockValidationService },
        { provide: LogService, useValue: mockLogService },
        { provide: I18nService, useValue: mock<I18nService>() },
      ],
    })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();

    fixture = TestBed.createComponent(KeyRotationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("submit", () => {
    async function callSubmit(component: KeyRotationDialogComponent) {
      await (component as any).submit();
    }

    describe("form validation", () => {
      it("returns early without calling any services when masterPassword is empty", async () => {
        await callSubmit(component);

        expect(mockKeyRotationDialogService.hasLegacyCipherAttachments).not.toHaveBeenCalled();
        expect(mockKeyRotationDialogService.rotateKeys).not.toHaveBeenCalled();
      });

      it("returns early without calling any services when masterPassword is null", async () => {
        (component as any).form.controls.masterPassword.setValue(null);

        await callSubmit(component);

        expect(mockKeyRotationDialogService.hasLegacyCipherAttachments).not.toHaveBeenCalled();
        expect(mockKeyRotationDialogService.rotateKeys).not.toHaveBeenCalled();
      });
    });

    describe("when masterPassword is valid", () => {
      beforeEach(() => {
        (component as any).form.controls.masterPassword.setValue("valid-password");
      });

      it("calls hasLegacyCipherAttachments with the active account userId", async () => {
        await callSubmit(component);

        expect(mockKeyRotationDialogService.hasLegacyCipherAttachments).toHaveBeenCalledWith(
          userId,
        );
      });

      it("calls rotateKeys with masterPassword and userId", async () => {
        await callSubmit(component);

        expect(mockKeyRotationDialogService.rotateKeys).toHaveBeenCalledWith(
          "valid-password",
          userId,
        );
      });

      it("closes dialog when rotateKeys returns true", async () => {
        mockKeyRotationDialogService.rotateKeys.mockResolvedValue(true);

        await callSubmit(component);

        expect(mockDialogRef.close).toHaveBeenCalled();
      });

      it("does not close dialog when rotateKeys returns false", async () => {
        await callSubmit(component);

        expect(mockDialogRef.close).not.toHaveBeenCalled();
      });
    });

    describe("dialogRef.disableClose lifecycle", () => {
      beforeEach(() => {
        (component as any).form.controls.masterPassword.setValue("valid-password");
      });

      it("sets disableClose to true before async operations then resets to false in finally", async () => {
        const disableCloseValues: boolean[] = [];
        Object.defineProperty(mockDialogRef, "disableClose", {
          set: (value: boolean) => disableCloseValues.push(value),
          configurable: true,
        });

        await callSubmit(component);

        expect(disableCloseValues).toEqual([true, false]);
      });

      it("resets disableClose to false even when rotateKeys throws", async () => {
        mockKeyRotationDialogService.rotateKeys.mockRejectedValue(new Error("rotation failed"));
        const disableCloseValues: boolean[] = [];
        Object.defineProperty(mockDialogRef, "disableClose", {
          set: (value: boolean) => disableCloseValues.push(value),
          configurable: true,
        });

        await callSubmit(component);

        expect(disableCloseValues).toEqual([true, false]);
      });
    });

    describe("legacy cipher attachments", () => {
      beforeEach(() => {
        (component as any).form.controls.masterPassword.setValue("valid-password");
        mockKeyRotationDialogService.hasLegacyCipherAttachments.mockResolvedValue(true);
        mockDialogService.openSimpleDialog.mockResolvedValue(false);
      });

      it("closes dialog when legacy attachments exist", async () => {
        await callSubmit(component);

        expect(mockDialogRef.close).toHaveBeenCalled();
        expect(mockKeyRotationDialogService.rotateKeys).not.toHaveBeenCalled();
        expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
          title: { key: "warning" },
          content: { key: "oldAttachmentsNeedFixDesc" },
          acceptButtonText: { key: "learnMore" },
          cancelButtonText: { key: "close" },
          type: "warning",
        });
      });

      it("launches learn-more URL when user clicks 'Learn more'", async () => {
        mockDialogService.openSimpleDialog.mockResolvedValue(true);

        await callSubmit(component);

        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://bitwarden.com/help/attachments/#fixing-old-attachments",
        );
      });

      it("does not launch URL when user clicks 'Close'", async () => {
        await callSubmit(component);

        expect(mockPlatformUtilsService.launchUri).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      const rotationError = new Error("rotation failed");

      beforeEach(() => {
        (component as any).form.controls.masterPassword.setValue("valid-password");
        mockKeyRotationDialogService.rotateKeys.mockRejectedValue(rotationError);
      });

      it("logs the error and shows toast when rotateKeys throws", async () => {
        await callSubmit(component);

        expect(mockLogService.error).toHaveBeenCalledWith(rotationError);
        expect(mockValidationService.showError).toHaveBeenCalledWith(rotationError);
        expect(mockDialogRef.close).not.toHaveBeenCalled();
      });
    });
  });
});
