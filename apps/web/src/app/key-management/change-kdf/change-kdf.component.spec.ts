import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, FormGroup } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, PopoverModule, CalloutModule } from "@bitwarden/components";
import {
  KdfConfigService,
  Argon2KdfConfig,
  PBKDF2KdfConfig,
  KdfType,
} from "@bitwarden/key-management";

import { SharedModule } from "../../shared";

import { ChangeKdfComponent } from "./change-kdf.component";

describe("ChangeKdfComponent", () => {
  let component: ChangeKdfComponent;
  let fixture: ComponentFixture<ChangeKdfComponent>;

  // Mock Services
  let mockDialogService: MockProxy<DialogService>;
  let mockKdfConfigService: MockProxy<KdfConfigService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockI18nService: MockProxy<I18nService>;
  let accountService: FakeAccountService;
  let formBuilder: FormBuilder;

  const mockUserId = "user-id" as UserId;

  // Helper functions for validation testing
  function expectPBKDF2Validation(formGroup: FormGroup): void {
    const iterationsControl = formGroup.get("kdfConfig.iterations");
    const memoryControl = formGroup.get("kdfConfig.memory");
    const parallelismControl = formGroup.get("kdfConfig.parallelism");

    // Assert current validators state
    expect(iterationsControl?.hasError("required")).toBe(false);
    expect(iterationsControl?.hasError("min")).toBe(false);
    expect(iterationsControl?.hasError("max")).toBe(false);
    expect(memoryControl?.validator).toBeNull();
    expect(parallelismControl?.validator).toBeNull();

    // Test validation boundaries
    iterationsControl?.setValue(PBKDF2KdfConfig.ITERATIONS.min - 1);
    expect(iterationsControl?.hasError("min")).toBe(true);

    iterationsControl?.setValue(PBKDF2KdfConfig.ITERATIONS.max + 1);
    expect(iterationsControl?.hasError("max")).toBe(true);
  }

  function expectArgon2Validation(formGroup: FormGroup): void {
    const iterationsControl = formGroup.get("kdfConfig.iterations");
    const memoryControl = formGroup.get("kdfConfig.memory");
    const parallelismControl = formGroup.get("kdfConfig.parallelism");

    // Assert current validators state
    expect(iterationsControl?.hasError("required")).toBe(false);
    expect(memoryControl?.hasError("required")).toBe(false);
    expect(parallelismControl?.hasError("required")).toBe(false);

    // Test validation boundaries - min values
    iterationsControl?.setValue(Argon2KdfConfig.ITERATIONS.min - 1);
    expect(iterationsControl?.hasError("min")).toBe(true);

    memoryControl?.setValue(Argon2KdfConfig.MEMORY.min - 1);
    expect(memoryControl?.hasError("min")).toBe(true);

    parallelismControl?.setValue(Argon2KdfConfig.PARALLELISM.min - 1);
    expect(parallelismControl?.hasError("min")).toBe(true);

    // Test validation boundaries - max values
    iterationsControl?.setValue(Argon2KdfConfig.ITERATIONS.max + 1);
    expect(iterationsControl?.hasError("max")).toBe(true);

    memoryControl?.setValue(Argon2KdfConfig.MEMORY.max + 1);
    expect(memoryControl?.hasError("max")).toBe(true);

    parallelismControl?.setValue(Argon2KdfConfig.PARALLELISM.max + 1);
    expect(parallelismControl?.hasError("max")).toBe(true);
  }

  beforeEach(() => {
    mockDialogService = mock<DialogService>();
    mockKdfConfigService = mock<KdfConfigService>();
    mockConfigService = mock<ConfigService>();
    mockI18nService = mock<I18nService>();
    accountService = mockAccountServiceWith(mockUserId);
    formBuilder = new FormBuilder();

    mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

    // Mock i18n service with switch statement for all keys
    mockI18nService.t.mockImplementation((key: string) => {
      switch (key) {
        case "encKeySettings":
          return "Encryption Key Settings";
        case "kdfSettingsChangeLogoutWarning":
          return "Proceeding will log you out of all active sessions. You will need to log back in and complete two-step login, if any. We recommend exporting your vault before changing your encryption settings to prevent data loss.";
        case "encryptionKeySettingsHowShouldWeEncryptYourData":
          return "How should we encrypt your data?";
        case "encryptionKeySettingsIncreaseImproveSecurity":
          return "Increase the number of iterations to improve security at the cost of slower login times.";
        case "algorithm":
          return "Algorithm";
        case "kdfIterations":
          return "KDF Iterations";
        case "kdfIterationRecommends":
          return "Minimum 100,000 iterations recommended.";
        case "kdfMemory":
          return "Memory (MB)";
        case "kdfParallelism":
          return "Parallelism";
        case "updateEncryptionSettings":
          return "Update Encryption Settings";
        case "encryptionKeySettingsAlgorithmPopoverTitle":
          return "Encryption Key Settings";
        case "encryptionKeySettingsAlgorithmPopoverPBKDF2":
          return "PBKDF2 SHA-256 is the default algorithm and is supported by all Bitwarden applications.";
        case "encryptionKeySettingsAlgorithmPopoverArgon2Id":
          return "Argon2id is a newer algorithm that is more secure but may not be supported by older Bitwarden applications.";
        case "learnMoreAboutEncryptionAlgorithms":
          return "Learn more about encryption algorithms";
        case "learnMore":
          return "Learn more";
        default:
          return key;
      }
    });

    TestBed.configureTestingModule({
      declarations: [ChangeKdfComponent],
      imports: [SharedModule, PopoverModule, CalloutModule],
      providers: [
        { provide: DialogService, useValue: mockDialogService },
        { provide: KdfConfigService, useValue: mockKdfConfigService },
        { provide: AccountService, useValue: accountService },
        { provide: FormBuilder, useValue: formBuilder },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });
  });

  describe("Component Initialization", () => {
    describe("given PBKDF2 configuration", () => {
      it("should initialize form with PBKDF2 values and validators when component loads", async () => {
        // Arrange
        const mockPBKDF2Config = new PBKDF2KdfConfig(600_000);
        mockKdfConfigService.getKdfConfig.mockResolvedValue(mockPBKDF2Config);

        // Act
        fixture = TestBed.createComponent(ChangeKdfComponent);
        component = fixture.componentInstance;
        await component.ngOnInit();

        // Extract form controls
        const formGroup = component["formGroup"];

        // Assert form values
        expect(formGroup.get("kdf")?.value).toBe(KdfType.PBKDF2_SHA256);
        expect(formGroup.get("kdfConfig.iterations")?.value).toBe(600_000);
        expect(formGroup.get("kdfConfig.memory")?.value).toBeNull();
        expect(formGroup.get("kdfConfig.parallelism")?.value).toBeNull();
        expect(component.kdfConfig).toEqual(mockPBKDF2Config);

        // Assert validators
        expectPBKDF2Validation(formGroup);
      });
    });

    describe("given Argon2id configuration", () => {
      it("should initialize form with Argon2id values and validators when component loads", async () => {
        // Arrange
        const mockArgon2Config = new Argon2KdfConfig(3, 64, 4);
        mockKdfConfigService.getKdfConfig.mockResolvedValue(mockArgon2Config);

        // Act
        fixture = TestBed.createComponent(ChangeKdfComponent);
        component = fixture.componentInstance;
        await component.ngOnInit();

        // Extract form controls
        const formGroup = component["formGroup"];

        // Assert form values
        expect(formGroup.get("kdf")?.value).toBe(KdfType.Argon2id);
        expect(formGroup.get("kdfConfig.iterations")?.value).toBe(3);
        expect(formGroup.get("kdfConfig.memory")?.value).toBe(64);
        expect(formGroup.get("kdfConfig.parallelism")?.value).toBe(4);
        expect(component.kdfConfig).toEqual(mockArgon2Config);

        // Assert validators
        expectArgon2Validation(formGroup);
      });
    });

    it.each([
      [true, false],
      [false, true],
    ])(
      "should show log out banner = %s when feature flag observable is %s",
      async (showLogOutBanner, forceUpgradeKdfFeatureFlag) => {
        // Arrange
        const mockPBKDF2Config = new PBKDF2KdfConfig(600_000);
        mockKdfConfigService.getKdfConfig.mockResolvedValue(mockPBKDF2Config);
        mockConfigService.getFeatureFlag$.mockReturnValue(of(forceUpgradeKdfFeatureFlag));

        // Act
        fixture = TestBed.createComponent(ChangeKdfComponent);
        component = fixture.componentInstance;
        await component.ngOnInit();
        fixture.detectChanges();

        // Assert
        const calloutElement = fixture.debugElement.query((el) =>
          el.nativeElement.textContent?.includes("Proceeding will log you out"),
        );

        if (showLogOutBanner) {
          expect(calloutElement).not.toBeNull();
          expect(calloutElement.nativeElement.textContent).toContain(
            "Proceeding will log you out of all active sessions",
          );
        } else {
          expect(calloutElement).toBeNull();
        }
      },
    );
  });

  describe("KDF Type Switching", () => {
    describe("switching from PBKDF2 to Argon2id", () => {
      beforeEach(async () => {
        // Setup component with initial PBKDF2 configuration
        const mockPBKDF2Config = new PBKDF2KdfConfig(600_001);
        mockKdfConfigService.getKdfConfig.mockResolvedValue(mockPBKDF2Config);

        fixture = TestBed.createComponent(ChangeKdfComponent);
        component = fixture.componentInstance;
        await component.ngOnInit();
      });

      it("should update form structure and default values when KDF type changes to Argon2id", () => {
        // Arrange
        const formGroup = component["formGroup"];
        const kdfControl = formGroup.get("kdf");

        // Act - change KDF type to Argon2id
        kdfControl?.setValue(KdfType.Argon2id);

        // Assert form values update to Argon2id defaults
        expect(formGroup.get("kdf")?.value).toBe(KdfType.Argon2id);
        expect(formGroup.get("kdfConfig.iterations")?.value).toBe(3); // Argon2id default
        expect(formGroup.get("kdfConfig.memory")?.value).toBe(64); // Argon2id default
        expect(formGroup.get("kdfConfig.parallelism")?.value).toBe(4); // Argon2id default
      });

      it("should update validators when KDF type changes to Argon2id", () => {
        // Arrange
        const formGroup = component["formGroup"];
        const kdfControl = formGroup.get("kdf");

        // Act - change KDF type to Argon2id
        kdfControl?.setValue(KdfType.Argon2id);

        // Assert validators update to Argon2id validation rules
        expectArgon2Validation(formGroup);
      });
    });

    describe("switching from Argon2id to PBKDF2", () => {
      beforeEach(async () => {
        // Setup component with initial Argon2id configuration
        const mockArgon2IdConfig = new Argon2KdfConfig(4, 65, 5);
        mockKdfConfigService.getKdfConfig.mockResolvedValue(mockArgon2IdConfig);

        fixture = TestBed.createComponent(ChangeKdfComponent);
        component = fixture.componentInstance;
        await component.ngOnInit();
      });

      it("should update form structure and default values when KDF type changes to PBKDF2", () => {
        // Arrange
        const formGroup = component["formGroup"];
        const kdfControl = formGroup.get("kdf");

        // Act - change KDF type back to PBKDF2
        kdfControl?.setValue(KdfType.PBKDF2_SHA256);

        // Assert form values update to PBKDF2 defaults
        expect(formGroup.get("kdf")?.value).toBe(KdfType.PBKDF2_SHA256);
        expect(formGroup.get("kdfConfig.iterations")?.value).toBe(600_000); // PBKDF2 default
        expect(formGroup.get("kdfConfig.memory")?.value).toBeNull(); // PBKDF2 doesn't use memory
        expect(formGroup.get("kdfConfig.parallelism")?.value).toBeNull(); // PBKDF2 doesn't use parallelism
      });

      it("should update validators when KDF type changes to PBKDF2", () => {
        // Arrange
        const formGroup = component["formGroup"];
        const kdfControl = formGroup.get("kdf");

        // Act - change KDF type back to PBKDF2
        kdfControl?.setValue(KdfType.PBKDF2_SHA256);

        // Assert validators update to PBKDF2 validation rules
        expectPBKDF2Validation(formGroup);
      });
    });
  });

  describe("openConfirmationModal", () => {
    describe("when form is valid", () => {
      it("should open confirmation modal with PBKDF2 config when form is submitted", async () => {
        // Arrange
        const mockPBKDF2Config = new PBKDF2KdfConfig(600_001);
        mockKdfConfigService.getKdfConfig.mockResolvedValue(mockPBKDF2Config);

        fixture = TestBed.createComponent(ChangeKdfComponent);
        component = fixture.componentInstance;
        await component.ngOnInit();

        // Act
        await component.openConfirmationModal();

        // Assert
        expect(mockDialogService.open).toHaveBeenCalledWith(
          expect.any(Function),
          expect.objectContaining({
            data: expect.objectContaining({
              kdfConfig: mockPBKDF2Config,
            }),
          }),
        );
      });

      it("should open confirmation modal with Argon2id config when form is submitted", async () => {
        // Arrange
        const mockArgon2Config = new Argon2KdfConfig(4, 65, 5);
        mockKdfConfigService.getKdfConfig.mockResolvedValue(mockArgon2Config);

        fixture = TestBed.createComponent(ChangeKdfComponent);
        component = fixture.componentInstance;
        await component.ngOnInit();

        // Act
        await component.openConfirmationModal();

        // Assert
        expect(mockDialogService.open).toHaveBeenCalledWith(
          expect.any(Function),
          expect.objectContaining({
            data: expect.objectContaining({
              kdfConfig: mockArgon2Config,
            }),
          }),
        );
      });
    });

    describe("when form is invalid", () => {
      it("should not open modal when form is invalid", async () => {
        // Arrange
        const mockPBKDF2Config = new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.min - 1);
        mockKdfConfigService.getKdfConfig.mockResolvedValue(mockPBKDF2Config);

        fixture = TestBed.createComponent(ChangeKdfComponent);
        component = fixture.componentInstance;
        await component.ngOnInit();

        // Act
        await component.openConfirmationModal();

        // Assert
        expect(mockDialogService.open).not.toHaveBeenCalled();
      });
    });
  });
});
