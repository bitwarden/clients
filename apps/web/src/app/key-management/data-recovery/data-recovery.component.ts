import { ChangeDetectionStrategy, Component, signal } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { ButtonModule, DialogService } from "@bitwarden/components";
import { KeyService, UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { LogRecorder } from "./log-recorder";
import {
  SyncStep,
  UserInfoStep,
  RecoveryStep,
  PrivateKeyStep,
  RecoveryWorkingData,
  FolderStep,
  CipherStep,
} from "./steps";

interface StepState {
  title: string;
  completed: boolean;
  inProgress: boolean;
  failed: boolean;
  message?: string;
}

@Component({
  selector: "app-data-recovery",
  templateUrl: "data-recovery.component.html",
  imports: [JslibModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataRecoveryComponent {
  private logger: LogRecorder;
  private recoverySteps: RecoveryStep[] = [];
  private workingData: RecoveryWorkingData | null = null;

  readonly isRunning = signal(false);
  readonly isCompleted = signal(false);
  readonly hasStarted = signal(false);
  readonly diagnosticsCompleted = signal(false);
  readonly recoveryCompleted = signal(false);
  readonly steps = signal<StepState[]>([]);
  readonly hasIssues = signal(false);

  constructor(
    private i18nService: I18nService,
    private apiService: ApiService,
    private accountService: AccountService,
    private keyService: KeyService,
    private folderApiService: FolderApiServiceAbstraction,
    private cipherEncryptService: CipherEncryptionService,
    private dialogService: DialogService,
    private privateKeyRegenerationService: UserAsymmetricKeysRegenerationService,
    private cryptoFunctionService: CryptoFunctionService,
    logService: LogService,
  ) {
    this.logger = new LogRecorder(logService);
    this.recoverySteps = [
      new UserInfoStep(this.accountService, this.keyService),
      new SyncStep(this.apiService),
      new PrivateKeyStep(
        this.keyService,
        this.privateKeyRegenerationService,
        this.dialogService,
        this.cryptoFunctionService,
      ),
      new FolderStep(this.folderApiService, this.dialogService),
      new CipherStep(this.apiService, this.cipherEncryptService, this.dialogService),
    ];

    // Initialize step states for UI
    this.steps.set(
      this.recoverySteps.map((step) => ({
        title: this.i18nService.t(step.title),
        completed: false,
        inProgress: false,
        failed: false,
      })),
    );
  }

  async runDiagnostics() {
    if (this.isRunning()) {
      return;
    }

    // Ensure SDK is loaded
    await SdkLoadService.Ready;

    this.hasStarted.set(true);
    this.isRunning.set(true);
    this.diagnosticsCompleted.set(false);

    this.logger.record("Starting diagnostics...");
    this.workingData = {
      userId: null,
      userKey: null,
      isPrivateKeyCorrupt: false,
      encryptedPrivateKey: null,
      ciphers: [],
      folders: [],
    };

    await this.runDiagnosticsInternal();

    this.isRunning.set(false);
    this.diagnosticsCompleted.set(true);
  }

  private async runDiagnosticsInternal() {
    if (!this.workingData) {
      this.logger.record("No working data available");
      return;
    }

    const currentSteps = this.steps();
    let hasAnyFailures = false;

    for (let i = 0; i < this.recoverySteps.length; i++) {
      const step = this.recoverySteps[i];
      currentSteps[i].inProgress = true;
      currentSteps[i].completed = false;
      currentSteps[i].failed = false;
      this.steps.set([...currentSteps]);

      this.logger.record(`Running diagnostics for step: ${step.title}`);
      try {
        const success = await step.runDiagnostics(this.workingData, this.logger);
        currentSteps[i].inProgress = false;
        currentSteps[i].completed = success;
        if (!success) {
          currentSteps[i].failed = true;
          hasAnyFailures = true;
        }
        this.steps.set([...currentSteps]);
        this.logger.record(`Diagnostics completed for step: ${step.title}`);
      } catch (error) {
        currentSteps[i].inProgress = false;
        currentSteps[i].failed = true;
        currentSteps[i].message = (error as Error).message;
        this.steps.set([...currentSteps]);
        this.logger.record(
          `Diagnostics failed for step: ${step.title} with error: ${(error as Error).message}`,
        );
        hasAnyFailures = true;
      }
    }

    if (hasAnyFailures) {
      this.logger.record("Diagnostics completed with errors");
    } else {
      this.logger.record("Diagnostics completed successfully");
    }

    // Check if any recovery can be performed
    const canRecoverAnyStep = this.recoverySteps.some((step) => step.canRecover(this.workingData!));
    this.hasIssues.set(canRecoverAnyStep);
  }

  async runRecovery() {
    if (this.isRunning() || !this.workingData) {
      return;
    }

    this.isRunning.set(true);
    this.recoveryCompleted.set(false);

    this.logger.record("Starting recovery process...");

    try {
      for (let i = 0; i < this.recoverySteps.length; i++) {
        const step = this.recoverySteps[i];
        if (step.canRecover(this.workingData)) {
          this.logger.record(`Running recovery for step: ${step.title}`);
          await step.runRecovery(this.workingData, this.logger);
        }
      }

      this.logger.record("Recovery process completed");
      this.recoveryCompleted.set(true);

      // Re-run diagnostics after recovery
      this.logger.record("Re-running diagnostics to verify recovery...");
      await this.runDiagnosticsInternal();

      this.isCompleted.set(true);
    } catch (error) {
      this.logger.record(`Recovery process cancelled or failed: ${(error as Error).message}`);
    } finally {
      this.isRunning.set(false);
    }
  }

  saveDiagnosticLogs() {
    const logs = this.logger.getLogs();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `data-recovery-logs-${timestamp}.txt`;

    const logContent = logs.join("\n");
    const blob = new Blob([logContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    window.URL.revokeObjectURL(url);
    this.logger.record("Diagnostic logs saved");
  }
}
