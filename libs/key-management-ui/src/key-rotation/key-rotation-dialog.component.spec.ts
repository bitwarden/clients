import { DialogRef } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
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
  let mockKeyConnectorService: MockProxy<KeyConnectorService>;
  let mockUserDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;

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
    mockKeyConnectorService = mock<KeyConnectorService>();
    mockUserDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();

    mockKeyRotationDialogService.hasLegacyCipherAttachments.mockResolvedValue(false);
    mockKeyRotationDialogService.rotateKeys.mockResolvedValue(false);
    mockKeyRotationDialogService.rotateKeysForKeyConnector.mockResolvedValue(false);
    mockKeyConnectorService.getUsesKeyConnector.mockResolvedValue(false);
    mockUserDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(false));

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
        { provide: KeyConnectorService, useValue: mockKeyConnectorService },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: mockUserDecryptionOptionsService,
        },
      ],
    })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();

    fixture = TestBed.createComponent(KeyRotationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("ngOnInit", () => {
    describe("master password user", () => {
      it("sets isMasterPasswordEncryptionUser to true", async () => {
        mockKeyConnectorService.getUsesKeyConnector.mockResolvedValue(false);
        mockUserDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));

        await component.ngOnInit();

        expect(component["isMasterPasswordEncryptionUser"]()).toBe(true);
        expect(component["isKeyConnectorEncryptionUser"]()).toBe(false);
      });

      it("sets isMasterPasswordEncryptionUser to false when user has no master password", async () => {
        mockKeyConnectorService.getUsesKeyConnector.mockResolvedValue(false);
        mockUserDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(false));

        await component.ngOnInit();

        expect(component["isMasterPasswordEncryptionUser"]()).toBe(false);
        expect(component["isKeyConnectorEncryptionUser"]()).toBe(false);
      });
    });

    describe("key connector user", () => {
      it("sets isKeyConnectorEncryptionUser to true", async () => {
        mockKeyConnectorService.getUsesKeyConnector.mockResolvedValue(true);

        await component.ngOnInit();

        expect(component["isKeyConnectorEncryptionUser"]()).toBe(true);
        expect(component["isMasterPasswordEncryptionUser"]()).toBe(false);
      });
    });
  });

  describe("submit", () => {
    async function callSubmit() {
      await component["submit"]();
    }

    describe("master password user", () => {
      beforeEach(() => {
        component["isMasterPasswordEncryptionUser"].set(true);
        component["isKeyConnectorEncryptionUser"].set(false);
      });

      describe("form validation", () => {
        it("returns early when masterPassword is empty", async () => {
          await callSubmit();

          expect(mockKeyRotationDialogService.hasLegacyCipherAttachments).not.toHaveBeenCalled();
          expect(mockKeyRotationDialogService.rotateKeys).not.toHaveBeenCalled();
        });

        it("returns early when masterPassword is null", async () => {
          component["form"].controls.masterPassword.setValue(null);

          await callSubmit();

          expect(mockKeyRotationDialogService.hasLegacyCipherAttachments).not.toHaveBeenCalled();
          expect(mockKeyRotationDialogService.rotateKeys).not.toHaveBeenCalled();
        });
      });

      describe("when masterPassword is valid", () => {
        beforeEach(() => {
          component["form"].controls.masterPassword.setValue("valid-password");
        });

        it("calls hasLegacyCipherAttachments with the active account userId", async () => {
          await callSubmit();

          expect(mockKeyRotationDialogService.hasLegacyCipherAttachments).toHaveBeenCalledWith(
            userId,
          );
        });

        it("calls rotateKeys with masterPassword and userId", async () => {
          await callSubmit();

          expect(mockKeyRotationDialogService.rotateKeys).toHaveBeenCalledWith(
            "valid-password",
            userId,
          );
        });

        it("closes dialog when rotateKeys returns true", async () => {
          mockKeyRotationDialogService.rotateKeys.mockResolvedValue(true);

          await callSubmit();

          expect(mockDialogRef.close).toHaveBeenCalled();
        });

        it("does not close dialog when rotateKeys returns false", async () => {
          await callSubmit();

          expect(mockDialogRef.close).not.toHaveBeenCalled();
        });
      });

      describe("dialogRef.disableClose lifecycle", () => {
        beforeEach(() => {
          component["form"].controls.masterPassword.setValue("valid-password");
        });

        it("sets disableClose to true before async operations then resets to false in finally", async () => {
          const disableCloseValues: boolean[] = [];
          Object.defineProperty(mockDialogRef, "disableClose", {
            set: (value: boolean) => disableCloseValues.push(value),
            configurable: true,
          });

          await callSubmit();

          expect(disableCloseValues).toEqual([true, false]);
        });

        it("resets disableClose to false even when rotateKeys throws", async () => {
          mockKeyRotationDialogService.rotateKeys.mockRejectedValue(new Error("rotation failed"));
          const disableCloseValues: boolean[] = [];
          Object.defineProperty(mockDialogRef, "disableClose", {
            set: (value: boolean) => disableCloseValues.push(value),
            configurable: true,
          });

          await callSubmit();

          expect(disableCloseValues).toEqual([true, false]);
        });
      });

      describe("legacy cipher attachments", () => {
        beforeEach(() => {
          component["form"].controls.masterPassword.setValue("valid-password");
          mockKeyRotationDialogService.hasLegacyCipherAttachments.mockResolvedValue(true);
          mockDialogService.openSimpleDialog.mockResolvedValue(false);
        });

        it("closes dialog when legacy attachments exist", async () => {
          await callSubmit();

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

          await callSubmit();

          expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
            "https://bitwarden.com/help/attachments/#fixing-old-attachments",
          );
        });

        it("does not launch URL when user clicks 'Close'", async () => {
          await callSubmit();

          expect(mockPlatformUtilsService.launchUri).not.toHaveBeenCalled();
        });
      });

      describe("error handling", () => {
        beforeEach(() => {
          component["form"].controls.masterPassword.setValue("valid-password");
          mockKeyRotationDialogService.rotateKeys.mockRejectedValue(new Error("rotation failed"));
        });

        it("logs the error and shows toast when rotateKeys throws", async () => {
          await callSubmit();

          expect(mockLogService.error).toHaveBeenCalled();
          expect(mockValidationService.showError).toHaveBeenCalled();
          expect(mockDialogRef.close).not.toHaveBeenCalled();
        });
      });
    });

    describe("key connector user", () => {
      beforeEach(() => {
        component["isMasterPasswordEncryptionUser"].set(false);
        component["isKeyConnectorEncryptionUser"].set(true);
      });

      it("calls rotateKeysForKeyConnector without requiring master password", async () => {
        await callSubmit();

        expect(mockKeyRotationDialogService.rotateKeysForKeyConnector).toHaveBeenCalledWith(userId);
        expect(mockKeyRotationDialogService.rotateKeys).not.toHaveBeenCalled();
      });

      it("checks for legacy cipher attachments", async () => {
        await callSubmit();

        expect(mockKeyRotationDialogService.hasLegacyCipherAttachments).toHaveBeenCalledWith(
          userId,
        );
      });

      it("closes dialog when rotation succeeds", async () => {
        mockKeyRotationDialogService.rotateKeysForKeyConnector.mockResolvedValue(true);

        await callSubmit();

        expect(mockDialogRef.close).toHaveBeenCalled();
      });

      it("does not close dialog when rotation returns false", async () => {
        await callSubmit();

        expect(mockDialogRef.close).not.toHaveBeenCalled();
      });

      describe("legacy cipher attachments", () => {
        beforeEach(() => {
          mockKeyRotationDialogService.hasLegacyCipherAttachments.mockResolvedValue(true);
          mockDialogService.openSimpleDialog.mockResolvedValue(false);
        });

        it("closes dialog and does not rotate", async () => {
          await callSubmit();

          expect(mockDialogRef.close).toHaveBeenCalled();
          expect(mockKeyRotationDialogService.rotateKeysForKeyConnector).not.toHaveBeenCalled();
        });
      });

      describe("error handling", () => {
        it("logs and shows error when rotation throws", async () => {
          const error = new Error("rotation failed");
          mockKeyRotationDialogService.rotateKeysForKeyConnector.mockRejectedValue(error);

          await callSubmit();

          expect(mockLogService.error).toHaveBeenCalledWith(error);
          expect(mockValidationService.showError).toHaveBeenCalledWith(error);
        });
      });
    });
  });
});
