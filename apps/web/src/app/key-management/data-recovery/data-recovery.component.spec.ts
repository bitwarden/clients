import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { DialogService } from "@bitwarden/components";
import { KeyService, UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { DataRecoveryComponent, StepStatus } from "./data-recovery.component";
import { RecoveryStep, RecoveryWorkingData } from "./steps";

// Mock SdkLoadService
jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: {
    Ready: Promise.resolve(),
  },
}));

describe("DataRecoveryComponent", () => {
  let component: DataRecoveryComponent;
  let fixture: ComponentFixture<DataRecoveryComponent>;

  // Mock Services
  let mockI18nService: MockProxy<I18nService>;
  let mockApiService: MockProxy<ApiService>;
  let mockAccountService: FakeAccountService;
  let mockKeyService: MockProxy<KeyService>;
  let mockFolderApiService: MockProxy<FolderApiServiceAbstraction>;
  let mockCipherEncryptService: MockProxy<CipherEncryptionService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockPrivateKeyRegenerationService: MockProxy<UserAsymmetricKeysRegenerationService>;
  let mockLogService: MockProxy<LogService>;
  let mockCryptoFunctionService: MockProxy<CryptoFunctionService>;
  let mockFileDownloadService: MockProxy<FileDownloadService>;

  const mockUserId = "user-id" as UserId;

  beforeEach(async () => {
    mockI18nService = mock<I18nService>();
    mockApiService = mock<ApiService>();
    mockAccountService = mockAccountServiceWith(mockUserId);
    mockKeyService = mock<KeyService>();
    mockFolderApiService = mock<FolderApiServiceAbstraction>();
    mockCipherEncryptService = mock<CipherEncryptionService>();
    mockDialogService = mock<DialogService>();
    mockPrivateKeyRegenerationService = mock<UserAsymmetricKeysRegenerationService>();
    mockLogService = mock<LogService>();
    mockCryptoFunctionService = mock<CryptoFunctionService>();
    mockFileDownloadService = mock<FileDownloadService>();

    mockI18nService.t.mockImplementation((key) => `${key}_used-i18n`);

    await TestBed.configureTestingModule({
      imports: [DataRecoveryComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: ApiService, useValue: mockApiService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: FolderApiServiceAbstraction, useValue: mockFolderApiService },
        { provide: CipherEncryptionService, useValue: mockCipherEncryptService },
        { provide: DialogService, useValue: mockDialogService },
        {
          provide: UserAsymmetricKeysRegenerationService,
          useValue: mockPrivateKeyRegenerationService,
        },
        { provide: LogService, useValue: mockLogService },
        { provide: CryptoFunctionService, useValue: mockCryptoFunctionService },
        { provide: FileDownloadService, useValue: mockFileDownloadService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DataRecoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("Component Initialization", () => {
    it("should create", () => {
      expect(component).toBeTruthy();
    });

    it("should initialize with default signal values", () => {
      expect(component.status()).toBe(StepStatus.NotStarted);
      expect(component.hasStarted()).toBe(false);
      expect(component.diagnosticsCompleted()).toBe(false);
      expect(component.recoveryCompleted()).toBe(false);
      expect(component.hasIssues()).toBe(false);
    });

    it("should initialize steps in correct order", () => {
      const steps = component.steps();
      expect(steps.length).toBe(5);
      expect(steps[0].title).toBe("recoveryStepUserInfoTitle_used-i18n");
      expect(steps[1].title).toBe("recoveryStepSyncTitle_used-i18n");
      expect(steps[2].title).toBe("recoveryStepPrivateKeyTitle_used-i18n");
      expect(steps[3].title).toBe("recoveryStepFoldersTitle_used-i18n");
      expect(steps[4].title).toBe("recoveryStepCipherTitle_used-i18n");
    });
  });

  describe("runDiagnostics", () => {
    let mockSteps: MockProxy<RecoveryStep>[];

    beforeEach(() => {
      // Create mock steps
      mockSteps = Array(5)
        .fill(null)
        .map(() => {
          const mockStep = mock<RecoveryStep>();
          mockStep.title = "mockStep";
          mockStep.runDiagnostics.mockResolvedValue(true);
          mockStep.canRecover.mockReturnValue(false);
          return mockStep;
        });

      // Replace recovery steps with mocks
      component["recoverySteps"] = mockSteps;
    });

    it("should not run if already running", async () => {
      component["status"].set(StepStatus.InProgress);
      await component.runDiagnostics();

      expect(mockSteps[0].runDiagnostics).not.toHaveBeenCalled();
    });

    it("should set hasStarted, isRunning and initialize workingData", async () => {
      await component.runDiagnostics();

      expect(component.hasStarted()).toBe(true);
      expect(component["workingData"]).toBeDefined();
      expect(component["workingData"]?.userId).toBeNull();
      expect(component["workingData"]?.userKey).toBeNull();
    });

    it("should run diagnostics for all steps", async () => {
      await component.runDiagnostics();

      mockSteps.forEach((step) => {
        expect(step.runDiagnostics).toHaveBeenCalledWith(
          component["workingData"],
          expect.anything(),
        );
      });
    });

    it("should mark steps as completed when diagnostics succeed", async () => {
      await component.runDiagnostics();

      const steps = component.steps();
      steps.forEach((step) => {
        expect(step.status).toBe(StepStatus.Completed);
      });
    });

    it("should mark steps as failed when diagnostics return false", async () => {
      mockSteps[2].runDiagnostics.mockResolvedValue(false);

      await component.runDiagnostics();

      const steps = component.steps();
      expect(steps[2].status).toBe(StepStatus.Failed);
    });

    it("should mark steps as failed when diagnostics throw error", async () => {
      mockSteps[3].runDiagnostics.mockRejectedValue(new Error("Test error"));

      await component.runDiagnostics();

      const steps = component.steps();
      expect(steps[3].status).toBe(StepStatus.Failed);
      expect(steps[3].message).toBe("Test error");
    });

    it("should continue diagnostics even if a step fails", async () => {
      mockSteps[1].runDiagnostics.mockRejectedValue(new Error("Step 1 failed"));
      mockSteps[3].runDiagnostics.mockResolvedValue(false);

      await component.runDiagnostics();

      // All steps should have been called despite failures
      mockSteps.forEach((step) => {
        expect(step.runDiagnostics).toHaveBeenCalled();
      });
    });

    it("should set hasIssues to true when a step can recover", async () => {
      mockSteps[2].runDiagnostics.mockResolvedValue(false);
      mockSteps[2].canRecover.mockReturnValue(true);

      await component.runDiagnostics();

      expect(component.hasIssues()).toBe(true);
    });

    it("should set hasIssues to false when no step can recover", async () => {
      mockSteps.forEach((step) => {
        step.runDiagnostics.mockResolvedValue(true);
        step.canRecover.mockReturnValue(false);
      });

      await component.runDiagnostics();

      expect(component.hasIssues()).toBe(false);
    });

    it("should set diagnosticsCompleted and status to completed when complete", async () => {
      await component.runDiagnostics();

      expect(component.diagnosticsCompleted()).toBe(true);
      expect(component.status()).toBe(StepStatus.Completed);
    });
  });

  describe("runRecovery", () => {
    let mockSteps: MockProxy<RecoveryStep>[];
    let mockWorkingData: RecoveryWorkingData;

    beforeEach(() => {
      mockWorkingData = {
        userId: mockUserId,
        userKey: null as any,
        isPrivateKeyCorrupt: false,
        encryptedPrivateKey: null,
        ciphers: [],
        folders: [],
      };

      mockSteps = Array(5)
        .fill(null)
        .map(() => {
          const mockStep = mock<RecoveryStep>();
          mockStep.title = "mockStep";
          mockStep.canRecover.mockReturnValue(false);
          mockStep.runRecovery.mockResolvedValue();
          mockStep.runDiagnostics.mockResolvedValue(true);
          return mockStep;
        });

      component["recoverySteps"] = mockSteps;
      component["workingData"] = mockWorkingData;
    });

    it("should not run if already running", async () => {
      component["status"].set(StepStatus.InProgress);
      await component.runRecovery();

      expect(mockSteps[0].runRecovery).not.toHaveBeenCalled();
    });

    it("should not run if workingData is null", async () => {
      component["workingData"] = null;
      await component.runRecovery();

      expect(mockSteps[0].runRecovery).not.toHaveBeenCalled();
    });

    it("should only run recovery for steps that can recover", async () => {
      mockSteps[1].canRecover.mockReturnValue(true);
      mockSteps[3].canRecover.mockReturnValue(true);

      await component.runRecovery();

      expect(mockSteps[0].runRecovery).not.toHaveBeenCalled();
      expect(mockSteps[1].runRecovery).toHaveBeenCalled();
      expect(mockSteps[2].runRecovery).not.toHaveBeenCalled();
      expect(mockSteps[3].runRecovery).toHaveBeenCalled();
      expect(mockSteps[4].runRecovery).not.toHaveBeenCalled();
    });

    it("should set recoveryCompleted and status when successful", async () => {
      mockSteps[1].canRecover.mockReturnValue(true);

      await component.runRecovery();

      expect(component.recoveryCompleted()).toBe(true);
      expect(component.status()).toBe(StepStatus.Completed);
    });

    it("should set status to failed if recovery is cancelled", async () => {
      mockSteps[1].canRecover.mockReturnValue(true);
      mockSteps[1].runRecovery.mockRejectedValue(new Error("User cancelled"));

      await component.runRecovery();

      expect(component.status()).toBe(StepStatus.Failed);
      expect(component.recoveryCompleted()).toBe(false);
    });

    it("should re-run diagnostics after recovery completes", async () => {
      mockSteps[1].canRecover.mockReturnValue(true);

      await component.runRecovery();

      // Diagnostics should be called twice: once for initial diagnostic scan
      mockSteps.forEach((step) => {
        expect(step.runDiagnostics).toHaveBeenCalledWith(mockWorkingData, expect.anything());
      });
    });

    it("should update hasIssues after re-running diagnostics", async () => {
      // Setup initial state with an issue
      mockSteps[1].canRecover.mockReturnValue(true);
      mockSteps[1].runDiagnostics.mockResolvedValue(false);

      // After recovery completes, the issue should be fixed
      mockSteps[1].runRecovery.mockImplementation(() => {
        // Simulate recovery fixing the issue
        mockSteps[1].canRecover.mockReturnValue(false);
        mockSteps[1].runDiagnostics.mockResolvedValue(true);
        return Promise.resolve();
      });

      await component.runRecovery();

      // Verify hasIssues is updated after re-running diagnostics
      expect(component.hasIssues()).toBe(false);
    });
  });

  describe("saveDiagnosticLogs", () => {
    it("should call fileDownloadService with log content", () => {
      component.saveDiagnosticLogs();

      expect(mockFileDownloadService.download).toHaveBeenCalledWith({
        fileName: expect.stringContaining("data-recovery-logs-"),
        blobData: expect.any(String),
        blobOptions: { type: "text/plain" },
      });
    });

    it("should include timestamp in filename", () => {
      component.saveDiagnosticLogs();

      const downloadCall = mockFileDownloadService.download.mock.calls[0][0];
      expect(downloadCall.fileName).toMatch(/data-recovery-logs-\d{4}-\d{2}-\d{2}T.*\.txt/);
    });
  });
});
