import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ChangeKdfService } from "@bitwarden/common/key-management/kdf/change-kdf.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { KdfType, PBKDF2KdfConfig, Argon2KdfConfig } from "@bitwarden/key-management";

import { SharedModule } from "../../shared";

import { ChangeKdfConfirmationComponent } from "./change-kdf-confirmation.component";

describe("ChangeKdfConfirmationComponent", () => {
  let component: ChangeKdfConfirmationComponent;
  let fixture: ComponentFixture<ChangeKdfConfirmationComponent>;

  // Mock Services
  let mockI18nService: MockProxy<I18nService>;
  let mockMessagingService: MockProxy<MessagingService>;
  let mockToastService: MockProxy<ToastService>;
  let mockDialogRef: MockProxy<DialogRef<ChangeKdfConfirmationComponent>>;
  let mockConfigService: MockProxy<ConfigService>;
  let accountService: FakeAccountService;
  let mockChangeKdfService: MockProxy<ChangeKdfService>;

  const mockUserId = "user-id" as UserId;
  const mockEmail = "email";
  const mockMasterPassword = "master-password";
  const mockDialogData = jest.fn();
  const kdfConfig = new PBKDF2KdfConfig(600_001);

  beforeEach(() => {
    mockI18nService = mock<I18nService>();
    mockMessagingService = mock<MessagingService>();
    mockToastService = mock<ToastService>();
    mockDialogRef = mock<DialogRef<ChangeKdfConfirmationComponent>>();
    mockConfigService = mock<ConfigService>();
    accountService = mockAccountServiceWith(mockUserId, { email: mockEmail });
    mockChangeKdfService = mock<ChangeKdfService>();

    mockI18nService.t.mockImplementation((key) => `${key}-used-i18n`);

    // Mock config service feature flag
    mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

    mockDialogData.mockReturnValue({
      kdf: KdfType.PBKDF2_SHA256,
      kdfConfig,
    });

    TestBed.configureTestingModule({
      declarations: [ChangeKdfConfirmationComponent],
      imports: [SharedModule],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: MessagingService, useValue: mockMessagingService },
        { provide: AccountService, useValue: accountService },
        { provide: ToastService, useValue: mockToastService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ChangeKdfService, useValue: mockChangeKdfService },
        {
          provide: DIALOG_DATA,
          useFactory: mockDialogData,
        },
      ],
    });
  });

  describe("Component Initialization", () => {
    it("should create component with PBKDF2 config", () => {
      const fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
      const component = fixture.componentInstance;

      expect(component).toBeTruthy();
      expect(component.kdfConfig).toBeInstanceOf(PBKDF2KdfConfig);
      expect(component.kdfConfig.iterations).toBe(600_001);
    });

    it("should create component with Argon2id config", () => {
      mockDialogData.mockReturnValue({
        kdf: KdfType.Argon2id,
        kdfConfig: new Argon2KdfConfig(4, 65, 5),
      });

      const fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
      const component = fixture.componentInstance;

      expect(component).toBeTruthy();
      expect(component.kdfConfig).toBeInstanceOf(Argon2KdfConfig);
      const kdfConfig = component.kdfConfig as Argon2KdfConfig;
      expect(kdfConfig.iterations).toBe(4);
      expect(kdfConfig.memory).toBe(65);
      expect(kdfConfig.parallelism).toBe(5);
    });

    it("should initialize form with required master password field", () => {
      const fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
      const component = fixture.componentInstance;

      expect(component.form.controls.masterPassword).toBeInstanceOf(FormControl);
      expect(component.form.controls.masterPassword.value).toEqual(null);
      expect(component.form.controls.masterPassword.hasError("required")).toBe(true);
    });
  });

  describe("Form Validation", () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
      component = fixture.componentInstance;
    });

    it("should be invalid when master password is empty", () => {
      component.form.controls.masterPassword.setValue("");
      expect(component.form.invalid).toBe(true);
    });

    it("should be valid when master password is provided", () => {
      component.form.controls.masterPassword.setValue(mockMasterPassword);
      expect(component.form.valid).toBe(true);
    });
  });

  describe("submit method", () => {
    describe("should not update kdf and not show success toast", () => {
      beforeEach(() => {
        fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
        component = fixture.componentInstance;

        component.form.controls.masterPassword.setValue(mockMasterPassword);
      });

      it("when form is invalid", async () => {
        // Arrange
        component.form.controls.masterPassword.setValue("");
        expect(component.form.invalid).toBe(true);

        // Act
        await component.submit();

        // Assert
        expect(mockChangeKdfService.updateUserKdfParams).not.toHaveBeenCalled();
      });

      it("when no active account", async () => {
        accountService.activeAccount$ = of(null);

        await expect(component.submit()).rejects.toThrow("Null or undefined account");

        expect(mockChangeKdfService.updateUserKdfParams).not.toHaveBeenCalled();
      });

      it("when kdf is invalid", async () => {
        // Arrange
        component.kdfConfig = new PBKDF2KdfConfig(1);

        // Act
        await expect(component.submit()).rejects.toThrow();

        expect(mockChangeKdfService.updateUserKdfParams).not.toHaveBeenCalled();
      });
    });

    describe("should update kdf and show success toast", () => {
      it("should set loading to true during submission", async () => {
        // Arrange
        let loadingDuringExecution = false;
        mockChangeKdfService.updateUserKdfParams.mockImplementation(async () => {
          loadingDuringExecution = component.loading;
        });

        const fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
        const component = fixture.componentInstance;

        component.form.controls.masterPassword.setValue(mockMasterPassword);

        // Act
        await component.submit();

        expect(loadingDuringExecution).toBe(true);
        expect(component.loading).toBe(false);
      });

      it("doesn't logout and closes the dialog when feature flag is enabled", async () => {
        // Arrange
        mockConfigService.getFeatureFlag$.mockReturnValue(of(true));

        const fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
        const component = fixture.componentInstance;

        component.form.controls.masterPassword.setValue(mockMasterPassword);

        // Act
        await component.submit();

        // Assert
        expect(mockChangeKdfService.updateUserKdfParams).toHaveBeenCalledWith(
          mockMasterPassword,
          kdfConfig,
          mockUserId,
        );
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          message: "encKeySettingsChanged-used-i18n",
        });
        expect(mockDialogRef.close).toHaveBeenCalled();
        expect(mockMessagingService.send).not.toHaveBeenCalled();
      });

      it("sends a logout and displays a log back in toast when feature flag is disabled", async () => {
        // Arrange
        const fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
        const component = fixture.componentInstance;

        component.form.controls.masterPassword.setValue(mockMasterPassword);

        // Act
        await component.submit();

        // Assert
        expect(mockChangeKdfService.updateUserKdfParams).toHaveBeenCalledWith(
          mockMasterPassword,
          kdfConfig,
          mockUserId,
        );
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          title: "encKeySettingsChanged-used-i18n",
          message: "logBackIn-used-i18n",
        });
        expect(mockMessagingService.send).toHaveBeenCalledWith("logout");
        expect(mockDialogRef.close).not.toHaveBeenCalled();
      });
    });
  });
});
