import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import {
  FakeAccountService,
  makeEncString,
  makeSymmetricCryptoKey,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { KdfType, KeyService, PBKDF2KdfConfig, Argon2KdfConfig } from "@bitwarden/key-management";

import { SharedModule } from "../../shared";

import { ChangeKdfConfirmationComponent } from "./change-kdf-confirmation.component";

import SpyInstance = jest.SpyInstance;

describe("ChangeKdfConfirmationComponent", () => {
  let component: ChangeKdfConfirmationComponent;
  let fixture: ComponentFixture<ChangeKdfConfirmationComponent>;

  // Mock Services
  let mockApiService: MockProxy<ApiService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockKeyService: MockProxy<KeyService>;
  let mockMessagingService: MockProxy<MessagingService>;
  let mockToastService: MockProxy<ToastService>;
  let mockDialogRef: MockProxy<DialogRef<ChangeKdfConfirmationComponent>>;
  let mockConfigService: MockProxy<ConfigService>;
  let accountService: FakeAccountService;

  const mockUserId = "user-id" as UserId;
  const mockEmail = "email";
  const mockMasterPassword = "master-password";
  const mockDialogData = jest.fn();

  beforeEach(() => {
    mockApiService = mock<ApiService>();
    mockI18nService = mock<I18nService>();
    mockKeyService = mock<KeyService>();
    mockMessagingService = mock<MessagingService>();
    mockToastService = mock<ToastService>();
    mockDialogRef = mock<DialogRef<ChangeKdfConfirmationComponent>>();
    mockConfigService = mock<ConfigService>();
    accountService = mockAccountServiceWith(mockUserId, { email: mockEmail });

    // Mock i18n service
    mockI18nService.t.mockImplementation((key: string) => {
      switch (key) {
        case "encKeySettingsChanged":
          return "Encryption key settings changed";
        case "logBackIn":
          return "Please log back in";
        default:
          return key;
      }
    });

    // Mock config service feature flag
    mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

    mockDialogData.mockReturnValue({
      kdf: KdfType.PBKDF2_SHA256,
      kdfConfig: new PBKDF2KdfConfig(600_000),
    });

    TestBed.configureTestingModule({
      declarations: [ChangeKdfConfirmationComponent],
      imports: [SharedModule],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: MessagingService, useValue: mockMessagingService },
        { provide: AccountService, useValue: accountService },
        { provide: ToastService, useValue: mockToastService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: DIALOG_DATA,
          useFactory: mockDialogData,
        },
      ],
    });
  });

  describe("Component Initialization", () => {
    it("should create component with PBKDF2 config", () => {
      mockDialogData.mockReturnValue({
        kdf: KdfType.PBKDF2_SHA256,
        kdfConfig: new PBKDF2KdfConfig(600_001),
      });

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

      expect(component.form.get("masterPassword")?.value).toEqual(null);
      expect(component.form.get("masterPassword")).toBeInstanceOf(FormControl);
      expect(component.form.get("masterPassword")?.hasError("required")).toBe(true);
    });
  });

  describe("Form Validation", () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
      component = fixture.componentInstance;
    });

    it("should be invalid when master password is empty", () => {
      component.form.get("masterPassword")?.setValue("");
      expect(component.form.invalid).toBe(true);
    });

    it("should be valid when master password is provided", () => {
      component.form.get("masterPassword")?.setValue(mockMasterPassword);
      expect(component.form.valid).toBe(true);
    });
  });

  describe("submit method", () => {
    let makeKeyAndSaveSpy: SpyInstance<Promise<void>>;
    beforeEach(() => {
      fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
      component = fixture.componentInstance;

      makeKeyAndSaveSpy = jest.spyOn(component, "makeKeyAndSave");
      makeKeyAndSaveSpy.mockImplementation();
    });

    describe("when form is invalid", () => {
      it("should return early without processing", async () => {
        // Arrange
        component.form.get("masterPassword")?.setValue("");
        expect(component.form.invalid).toBe(true);

        // Act
        await component.submit();

        // Assert
        expect(makeKeyAndSaveSpy).not.toHaveBeenCalled();
      });
    });

    describe("when form is valid", () => {
      beforeEach(() => {
        component.form.get("masterPassword")?.setValue(mockMasterPassword);
      });

      it("should set loading to true during submission", async () => {
        // Arrange
        let loadingDuringExecution = false;
        makeKeyAndSaveSpy.mockImplementation(async () => {
          loadingDuringExecution = component.loading;
        });

        // Act
        await component.submit();

        expect(loadingDuringExecution).toBe(true);
        expect(component.loading).toBe(false);
      });

      it("should call makeKeyAndSaveAsync", async () => {
        // Act
        await component.submit();

        // Assert
        expect(makeKeyAndSaveSpy).toHaveBeenCalledTimes(1);
      });

      describe("when ForceUpdateKDFSettings feature flag is enabled", () => {
        it("should show success toast and close dialog", async () => {
          // Arrange - reset mocks and create component with feature flag enabled
          mockConfigService.getFeatureFlag$.mockReturnValue(of(true));

          const fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
          const component = fixture.componentInstance;

          makeKeyAndSaveSpy = jest.spyOn(component, "makeKeyAndSave");
          makeKeyAndSaveSpy.mockImplementation();

          component.form.get("masterPassword")?.setValue(mockMasterPassword);

          // Act
          await component.submit();

          // Assert
          expect(mockToastService.showToast).toHaveBeenCalledWith({
            variant: "success",
            message: "Encryption key settings changed",
          });
          expect(mockDialogRef.close).toHaveBeenCalled();
          expect(mockMessagingService.send).not.toHaveBeenCalled();
        });
      });

      describe("when ForceUpdateKDFSettings feature flag is disabled", () => {
        it("should show toast with logout message and send logout", async () => {
          // Act
          await component.submit();

          // Assert
          expect(mockToastService.showToast).toHaveBeenCalledWith({
            variant: "success",
            title: "Encryption key settings changed",
            message: "Please log back in",
          });
          expect(mockMessagingService.send).toHaveBeenCalledWith("logout");
          expect(mockDialogRef.close).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe("makeKeyAndSaveAsync", () => {
    const kdfConfig = new PBKDF2KdfConfig();
    const validateKdfConfigForSetting = jest.spyOn(kdfConfig, "validateKdfConfigForSetting");
    const mockMasterKey = makeSymmetricCryptoKey(64) as MasterKey;
    const mockNewMasterKey = makeSymmetricCryptoKey(64) as MasterKey;
    const mockNewUserKey = makeSymmetricCryptoKey(64) as UserKey;
    const mockNewUserKeyEncrypted = makeEncString("user-key");
    const mockMasterPasswordHash = "master-password-hash";
    const mockNewMasterPasswordHash = "new-master-password-hash";

    beforeEach(() => {
      fixture = TestBed.createComponent(ChangeKdfConfirmationComponent);
      component = fixture.componentInstance;

      component.kdfConfig = kdfConfig;

      component.form.get("masterPassword")?.setValue(mockMasterPassword);

      mockKeyService.getOrDeriveMasterKey.mockResolvedValue(mockMasterKey);
      mockKeyService.hashMasterKey
        .mockResolvedValueOnce(mockMasterPasswordHash)
        .mockResolvedValueOnce(mockNewMasterPasswordHash);
      mockKeyService.makeMasterKey.mockResolvedValue(mockNewMasterKey);
      mockKeyService.encryptUserKeyWithMasterKey.mockResolvedValue([
        mockNewUserKey,
        mockNewUserKeyEncrypted,
      ]);
    });

    it("should throw error when no active account", async () => {
      accountService.activeAccount$ = of(null);

      await expect(component.makeKeyAndSave()).rejects.toThrow("No active account found.");
    });

    it("should throw error when KDF validation failed", async () => {
      validateKdfConfigForSetting.mockImplementation(() => {
        throw new Error("KDF config invalid");
      });
      component.kdfConfig = kdfConfig;

      await expect(component.makeKeyAndSave()).rejects.toThrow("KDF config invalid");
    });

    it.each([new PBKDF2KdfConfig(600_001), new Argon2KdfConfig(4, 65, 5)])(
      "should post KDF request to API when kdf = %s",
      async (kdfConfig) => {
        // Arrange
        component.kdfConfig = kdfConfig;
        const expectedRequest = {
          kdf: kdfConfig.kdfType,
          kdfIterations: kdfConfig.iterations,
          kdfMemory: kdfConfig instanceof Argon2KdfConfig ? kdfConfig.memory : undefined,
          kdfParallelism: kdfConfig instanceof Argon2KdfConfig ? kdfConfig.parallelism : undefined,
          masterPasswordHash: mockMasterPasswordHash,
          newMasterPasswordHash: mockNewMasterPasswordHash,
          key: mockNewUserKeyEncrypted.encryptedString,
        };
        if (kdfConfig instanceof PBKDF2KdfConfig) {
          delete expectedRequest.kdfMemory;
          delete expectedRequest.kdfParallelism;
        }

        // Act
        await component.makeKeyAndSave();

        // Assert
        expect(validateKdfConfigForSetting).toHaveBeenCalled();
        expect(mockKeyService.getOrDeriveMasterKey).toHaveBeenCalledWith(
          mockMasterPassword,
          mockUserId,
        );
        expect(mockKeyService.hashMasterKey).toHaveBeenNthCalledWith(
          1,
          mockMasterPassword,
          mockMasterKey,
        );
        expect(mockKeyService.makeMasterKey).toHaveBeenCalledWith(
          mockMasterPassword,
          mockEmail,
          kdfConfig,
        );
        expect(mockKeyService.hashMasterKey).toHaveBeenNthCalledWith(
          2,
          mockMasterPassword,
          mockNewMasterKey,
        );
        expect(mockKeyService.encryptUserKeyWithMasterKey).toHaveBeenCalledWith(mockNewMasterKey);
        expect(mockApiService.postAccountKdf).toHaveBeenCalledWith(
          expect.objectContaining(expectedRequest),
        );
      },
    );
  });
});
