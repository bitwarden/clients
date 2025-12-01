import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, FormControl } from "@angular/forms";
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
  function expectPBKDF2Validation(
    iterationsControl: FormControl<number | null>,
    memoryControl: FormControl<number | null>,
    parallelismControl: FormControl<number | null>,
  ) {
    // Assert current validators state
    expect(iterationsControl.hasError("required")).toBe(false);
    expect(iterationsControl.hasError("min")).toBe(false);
    expect(iterationsControl.hasError("max")).toBe(false);
    expect(memoryControl.validator).toBeNull();
    expect(parallelismControl.validator).toBeNull();

    // Test validation boundaries
    iterationsControl.setValue(PBKDF2KdfConfig.ITERATIONS.min - 1);
    expect(iterationsControl.hasError("min")).toBe(true);

    iterationsControl.setValue(PBKDF2KdfConfig.ITERATIONS.max + 1);
    expect(iterationsControl.hasError("max")).toBe(true);
  }

  function expectArgon2Validation(
    iterationsControl: FormControl<number | null>,
    memoryControl: FormControl<number | null>,
    parallelismControl: FormControl<number | null>,
  ) {
    // Assert current validators state
    expect(iterationsControl.hasError("required")).toBe(false);
    expect(memoryControl.hasError("required")).toBe(false);
    expect(parallelismControl.hasError("required")).toBe(false);

    // Test validation boundaries - min values
    iterationsControl.setValue(Argon2KdfConfig.ITERATIONS.min - 1);
    expect(iterationsControl.hasError("min")).toBe(true);

    memoryControl.setValue(Argon2KdfConfig.MEMORY.min - 1);
    expect(memoryControl.hasError("min")).toBe(true);

    parallelismControl.setValue(Argon2KdfConfig.PARALLELISM.min - 1);
    expect(parallelismControl.hasError("min")).toBe(true);

    // Test validation boundaries - max values
    iterationsControl.setValue(Argon2KdfConfig.ITERATIONS.max + 1);
    expect(iterationsControl.hasError("max")).toBe(true);

    memoryControl.setValue(Argon2KdfConfig.MEMORY.max + 1);
    expect(memoryControl.hasError("max")).toBe(true);

    parallelismControl.setValue(Argon2KdfConfig.PARALLELISM.max + 1);
    expect(parallelismControl.hasError("max")).toBe(true);
  }

  beforeEach(() => {
    mockDialogService = mock<DialogService>();
    mockKdfConfigService = mock<KdfConfigService>();
    mockConfigService = mock<ConfigService>();
    mockI18nService = mock<I18nService>();
    accountService = mockAccountServiceWith(mockUserId);
    formBuilder = new FormBuilder();

    mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

    mockI18nService.t.mockImplementation((key) => `${key}-used-i18n`);

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
        expect(formGroup.controls.kdf.value).toBe(KdfType.PBKDF2_SHA256);
        const kdfConfigFormGroup = formGroup.controls.kdfConfig;
        expect(kdfConfigFormGroup.controls.iterations.value).toBe(600_000);
        expect(kdfConfigFormGroup.controls.memory.value).toBeNull();
        expect(kdfConfigFormGroup.controls.parallelism.value).toBeNull();
        expect(component.kdfConfig).toEqual(mockPBKDF2Config);

        // Assert validators
        expectPBKDF2Validation(
          kdfConfigFormGroup.controls.iterations,
          kdfConfigFormGroup.controls.memory,
          kdfConfigFormGroup.controls.parallelism,
        );
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
        expect(formGroup.controls.kdf.value).toBe(KdfType.Argon2id);
        const kdfConfigFormGroup = formGroup.controls.kdfConfig;
        expect(kdfConfigFormGroup.controls.iterations.value).toBe(3);
        expect(kdfConfigFormGroup.controls.memory.value).toBe(64);
        expect(kdfConfigFormGroup.controls.parallelism.value).toBe(4);
        expect(component.kdfConfig).toEqual(mockArgon2Config);

        // Assert validators
        expectArgon2Validation(
          kdfConfigFormGroup.controls.iterations,
          kdfConfigFormGroup.controls.memory,
          kdfConfigFormGroup.controls.parallelism,
        );
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
          el.nativeElement.textContent?.includes("kdfSettingsChangeLogoutWarning"),
        );

        if (showLogOutBanner) {
          expect(calloutElement).not.toBeNull();
          expect(calloutElement.nativeElement.textContent).toContain(
            "kdfSettingsChangeLogoutWarning-used-i18n",
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

        // Act - change KDF type to Argon2id
        formGroup.controls.kdf.setValue(KdfType.Argon2id);

        // Assert form values update to Argon2id defaults
        expect(formGroup.controls.kdf.value).toBe(KdfType.Argon2id);
        const kdfConfigFormGroup = formGroup.controls.kdfConfig;
        expect(kdfConfigFormGroup.controls.iterations.value).toBe(3); // Argon2id default
        expect(kdfConfigFormGroup.controls.memory.value).toBe(64); // Argon2id default
        expect(kdfConfigFormGroup.controls.parallelism.value).toBe(4); // Argon2id default
      });

      it("should update validators when KDF type changes to Argon2id", () => {
        // Arrange
        const formGroup = component["formGroup"];

        // Act - change KDF type to Argon2id
        formGroup.controls.kdf.setValue(KdfType.Argon2id);

        // Assert validators update to Argon2id validation rules
        const kdfConfigFormGroup = formGroup.controls.kdfConfig;
        expectArgon2Validation(
          kdfConfigFormGroup.controls.iterations,
          kdfConfigFormGroup.controls.memory,
          kdfConfigFormGroup.controls.parallelism,
        );
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

        // Act - change KDF type back to PBKDF2
        formGroup.controls.kdf.setValue(KdfType.PBKDF2_SHA256);

        // Assert form values update to PBKDF2 defaults
        expect(formGroup.controls.kdf.value).toBe(KdfType.PBKDF2_SHA256);
        const kdfConfigFormGroup = formGroup.controls.kdfConfig;
        expect(kdfConfigFormGroup.controls.iterations.value).toBe(600_000); // PBKDF2 default
        expect(kdfConfigFormGroup.controls.memory.value).toBeNull(); // PBKDF2 doesn't use memory
        expect(kdfConfigFormGroup.controls.parallelism.value).toBeNull(); // PBKDF2 doesn't use parallelism
      });

      it("should update validators when KDF type changes to PBKDF2", () => {
        // Arrange
        const formGroup = component["formGroup"];

        // Act - change KDF type back to PBKDF2
        formGroup.controls.kdf.setValue(KdfType.PBKDF2_SHA256);

        // Assert validators update to PBKDF2 validation rules
        const kdfConfigFormGroup = formGroup.controls.kdfConfig;
        expectPBKDF2Validation(
          kdfConfigFormGroup.controls.iterations,
          kdfConfigFormGroup.controls.memory,
          kdfConfigFormGroup.controls.parallelism,
        );
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
