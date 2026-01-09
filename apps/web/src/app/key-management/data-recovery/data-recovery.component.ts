import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { ButtonModule, DialogService } from "@bitwarden/components";
import { KeyService, UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { SharedModule } from "../../shared";

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

export const StepStatus = Object.freeze({
  NotStarted: 0,
  InProgress: 1,
  Completed: 2,
  Failed: 3,
} as const);
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];

interface StepState {
  title: string;
  status: StepStatus;
  message?: string;
}

@Component({
  selector: "app-data-recovery",
  templateUrl: "data-recovery.component.html",
  standalone: true,
  imports: [JslibModule, ButtonModule, CommonModule, SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataRecoveryComponent {
  protected readonly StepStatus = StepStatus;

  private i18nService = inject(I18nService);
  private apiService = inject(ApiService);
  private accountService = inject(AccountService);
  private keyService = inject(KeyService);
  private folderApiService = inject(FolderApiServiceAbstraction);
  private cipherEncryptService = inject(CipherEncryptionService);
  private dialogService = inject(DialogService);
  private privateKeyRegenerationService = inject(UserAsymmetricKeysRegenerationService);
  private cryptoFunctionService = inject(CryptoFunctionService);
  private logService = inject(LogService);
  private fileDownloadService = inject(FileDownloadService);

  private logger: LogRecorder = new LogRecorder(this.logService);
  private recoverySteps: RecoveryStep[] = [
    new UserInfoStep(this.accountService, this.keyService),
    new SyncStep(this.apiService),
    new PrivateKeyStep(
      this.privateKeyRegenerationService,
      this.dialogService,
      this.cryptoFunctionService,
    ),
    new FolderStep(this.folderApiService, this.dialogService),
    new CipherStep(this.apiService, this.cipherEncryptService, this.dialogService),
  ];
  private workingData: RecoveryWorkingData | null = null;

  readonly status = signal<StepStatus>(StepStatus.NotStarted);
  readonly hasStarted = signal(false);
  readonly diagnosticsCompleted = signal(false);
  readonly recoveryCompleted = signal(false);
  readonly steps = signal<StepState[]>(
    this.recoverySteps.map((step) => ({
      title: this.i18nService.t(step.title),
      status: StepStatus.NotStarted,
    })),
  );
  readonly hasIssues = signal(false);

  runDiagnostics = async () => {
    if (this.status() === StepStatus.InProgress) {
      return;
    }

    this.hasStarted.set(true);

    this.status.set(StepStatus.InProgress);
    this.diagnosticsCompleted.set(false);
    await this.runDiagnosticsInternal();
    this.status.set(StepStatus.Completed);
    this.diagnosticsCompleted.set(true);
  };

  private async runDiagnosticsInternal() {
    this.logger.record("Starting diagnostics...");
    this.workingData = {
      userId: null,
      userKey: null,
      isPrivateKeyCorrupt: false,
      encryptedPrivateKey: null,
      ciphers: [],
      folders: [],
    };

    const currentSteps = this.steps();
    let hasAnyFailures = false;

    for (let i = 0; i < this.recoverySteps.length; i++) {
      const step = this.recoverySteps[i];
      currentSteps[i].status = StepStatus.InProgress;
      this.steps.set([...currentSteps]);

      this.logger.record(`Running diagnostics for step: ${step.title}`);
      try {
        const success = await step.runDiagnostics(this.workingData, this.logger);
        currentSteps[i].status = success ? StepStatus.Completed : StepStatus.Failed;
        if (!success) {
          hasAnyFailures = true;
        }
        this.steps.set([...currentSteps]);
        this.logger.record(`Diagnostics completed for step: ${step.title}`);
      } catch (error) {
        currentSteps[i].status = StepStatus.Failed;
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

  runRecovery = async () => {
    if (this.status() === StepStatus.InProgress || !this.workingData) {
      return;
    }

    this.status.set(StepStatus.InProgress);
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

      this.diagnosticsCompleted.set(false);
      await this.runDiagnosticsInternal();
      this.diagnosticsCompleted.set(true);

      this.status.set(StepStatus.Completed);
    } catch (error) {
      this.logger.record(`Recovery process cancelled or failed: ${(error as Error).message}`);
      this.status.set(StepStatus.Failed);
    }
  };

  saveDiagnosticLogs = () => {
    const logs = this.logger.getLogs();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `data-recovery-logs-${timestamp}.txt`;

    const logContent = logs.join("\n");
    this.fileDownloadService.download({
      fileName: filename,
      blobData: logContent,
      blobOptions: { type: "text/plain" },
    });

    this.logger.record("Diagnostic logs saved");
  };
}
