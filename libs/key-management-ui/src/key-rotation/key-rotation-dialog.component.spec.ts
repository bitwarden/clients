import { DialogRef } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
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
  let mockDeviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;

  const userId = "test-user-id" as UserId;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockKeyRotationDialogService = mock<KeyRotationDialogService>();
    mockDialogService = mock<DialogService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockDialogRef = mock<DialogRef<KeyRotationDialogComponent>>();
    mockValidationService = mock<ValidationService>();
    mockLogService = mock<LogService>();
    mockKeyConnectorService = mock<KeyConnectorService>();
    mockUserDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    mockDeviceTrustService = mock<DeviceTrustServiceAbstraction>();

    mockKeyRotationDialogService.hasLegacyCipherAttachments.mockResolvedValue(false);
    mockKeyRotationDialogService.rotateKeys.mockResolvedValue(false);
    mockKeyRotationDialogService.rotateKeysForKeyConnector.mockResolvedValue(false);
    mockKeyRotationDialogService.rotateKeysForTDE.mockResolvedValue(false);
    mockKeyConnectorService.getUsesKeyConnector.mockResolvedValue(false);
    mockKeyConnectorService.getManagingOrganization.mockResolvedValue(
      null as unknown as Organization,
    );
    mockUserDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(false));
    mockDeviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [KeyRotationDialogComponent],
      providers: [
        { provide: KeyRotationDialogService, useValue: mockKeyRotationDialogService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
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
        { provide: DeviceTrustServiceAbstraction, useValue: mockDeviceTrustService },
      ],
    })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();
  });

  async function createComponent() {
    fixture = TestBed.createComponent(KeyRotationDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe("userPrimaryEncryptionType", () => {
    it("resolves to 'masterPassword' when user has a master password", async () => {
      mockUserDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));

      await createComponent();

      expect(component["userPrimaryEncryptionType"]()).toBe("masterPassword");
    });

    it("resolves to 'keyConnector' when user uses key connector with a managing organization", async () => {
      mockKeyConnectorService.getUsesKeyConnector.mockResolvedValue(true);
      mockKeyConnectorService.getManagingOrganization.mockResolvedValue({
        id: "org-id",
      } as unknown as Organization);

      await createComponent();

      expect(component["userPrimaryEncryptionType"]()).toBe("keyConnector");
    });

    it("resolves to 'TDE' when user supports trusted device unlock", async () => {
      mockDeviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(true));

      await createComponent();

      expect(component["userPrimaryEncryptionType"]()).toBe("TDE");
    });

    it("resolves to undefined when user has no master password, no key connector, and no tde support", async () => {
      await createComponent();

      expect(component["userPrimaryEncryptionType"]()).toBeUndefined();
    });

    it("resolves to undefined when user uses key connector but has no managing organization", async () => {
      mockKeyConnectorService.getUsesKeyConnector.mockResolvedValue(true);
      mockKeyConnectorService.getManagingOrganization.mockResolvedValue(
        null as unknown as Organization,
      );

      await createComponent();

      expect(component["userPrimaryEncryptionType"]()).toBeUndefined();
    });
  });

  describe("submit", () => {
    async function callSubmit() {
      await component["submit"]();
    }

    describe("when encryption type is not yet resolved", () => {
      it("returns early without performing any actions", async () => {
        await createComponent();
        // Override signal to simulate loading state
        Object.defineProperty(component, "userPrimaryEncryptionType", {
          value: (): undefined => undefined,
        });

        await callSubmit();

        expect(mockKeyRotationDialogService.hasLegacyCipherAttachments).not.toHaveBeenCalled();
      });
    });

    describe("master password user", () => {
      beforeEach(async () => {
        mockUserDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));
        await createComponent();
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
      beforeEach(async () => {
        mockKeyConnectorService.getUsesKeyConnector.mockResolvedValue(true);
        mockKeyConnectorService.getManagingOrganization.mockResolvedValue({
          id: "org-id",
        } as unknown as Organization);
        await createComponent();
      });

      it("calls rotateKeysForKeyConnector without requiring master password", async () => {
        await callSubmit();

        expect(mockKeyRotationDialogService.rotateKeysForKeyConnector).toHaveBeenCalledWith(userId);
        expect(mockKeyRotationDialogService.rotateKeys).not.toHaveBeenCalled();
        expect(mockKeyRotationDialogService.rotateKeysForTDE).not.toHaveBeenCalled();
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

    describe("tde user", () => {
      beforeEach(async () => {
        mockDeviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(true));
        await createComponent();
      });

      it("calls rotateKeysforTDE without requiring master password", async () => {
        await callSubmit();

        expect(mockKeyRotationDialogService.rotateKeysForTDE).toHaveBeenCalledWith(userId);
        expect(mockKeyRotationDialogService.rotateKeys).not.toHaveBeenCalled();
        expect(mockKeyRotationDialogService.rotateKeysForKeyConnector).not.toHaveBeenCalled();
      });

      it("checks for legacy cipher attachments", async () => {
        await callSubmit();

        expect(mockKeyRotationDialogService.hasLegacyCipherAttachments).toHaveBeenCalledWith(
          userId,
        );
      });

      it("closes dialog when rotation succeeds", async () => {
        mockKeyRotationDialogService.rotateKeysForTDE.mockResolvedValue(true);

        await callSubmit();

        expect(mockDialogRef.close).toHaveBeenCalled();
      });

      it("legacy cipher attachments closes dialog and does not rotate", async () => {
        mockKeyRotationDialogService.hasLegacyCipherAttachments.mockResolvedValue(true);
        mockDialogService.openSimpleDialog.mockResolvedValue(false);

        await callSubmit();

        expect(mockDialogRef.close).toHaveBeenCalled();
        expect(mockKeyRotationDialogService.rotateKeysForTDE).not.toHaveBeenCalled();
      });

      it("logs and shows error when rotation throws", async () => {
        const error = new Error("rotation failed");
        mockKeyRotationDialogService.rotateKeysForTDE.mockRejectedValue(error);

        await callSubmit();

        expect(mockLogService.error).toHaveBeenCalledWith(error);
        expect(mockValidationService.showError).toHaveBeenCalledWith(error);
      });
    });
  });
});
