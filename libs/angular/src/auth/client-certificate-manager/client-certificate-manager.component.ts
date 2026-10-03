import { CommonModule } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  ClientCertificateError,
  ClientCertificateIdentity,
  ClientCertificateSettingsService,
  ClientCertificateView,
} from "../services/client-certificate-settings.service";

interface ManagerData {
  suggestedUrls: string[];
  allowRestart: boolean;
}

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "client-certificate-manager",
  templateUrl: "client-certificate-manager.component.html",
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, FormFieldModule, I18nPipe],
})
export class ClientCertificateManagerComponent implements OnInit, OnDestroy {
  static open(
    dialogService: DialogService,
    suggestedUrls: string[] = [],
    allowRestart = false,
  ): DialogRef<boolean> {
    return dialogService.open<boolean>(ClientCertificateManagerComponent, {
      data: { suggestedUrls, allowRestart },
    });
  }

  protected view?: ClientCertificateView;
  protected busy = false;
  protected errorKey?: string;
  protected fileName?: string;
  protected selectionId?: string;
  protected draftId?: string;
  protected inspected?: ClientCertificateIdentity;
  protected password = "";
  protected endpointText: string;
  protected replaceExisting = false;
  protected removeCandidate?: string;
  protected readonly allowRestart: boolean;

  constructor(
    @Inject(DIALOG_DATA) data: ManagerData,
    protected readonly certificates: ClientCertificateSettingsService,
    private readonly dialogRef: DialogRef<boolean>,
  ) {
    this.endpointText = data.suggestedUrls.filter(Boolean).join("\n");
    this.allowRestart = data.allowRestart;
  }

  ngOnInit(): void {
    void this.refresh();
  }

  ngOnDestroy(): void {
    if (this.draftId) {
      void this.certificates.cancelDraft(this.draftId);
    }
    this.password = "";
  }

  protected get identities(): ClientCertificateIdentity[] {
    return Object.values(this.view?.identities ?? {});
  }

  protected get bindings(): [string, string][] {
    return Object.entries(this.view?.bindings ?? {});
  }

  protected async refresh(): Promise<void> {
    const result = await this.certificates.list();
    if (result.ok === true) {
      this.view = result.value;
    } else {
      this.showError(result.error.code);
    }
  }

  protected async chooseFile(): Promise<void> {
    this.errorKey = undefined;
    this.busy = true;
    try {
      if (this.draftId) {
        await this.certificates.cancelDraft(this.draftId);
      }
      this.clearDraft();
      const result = await this.certificates.chooseFile();
      if (result.ok === true) {
        this.selectionId = result.value.selectionId;
        this.fileName = result.value.fileName;
      } else if (result.error.code !== "cancelled") {
        this.showError(result.error.code);
      }
    } finally {
      this.busy = false;
    }
  }

  protected async inspect(): Promise<void> {
    if (!this.selectionId || !this.password || this.busy) {
      return;
    }
    this.errorKey = undefined;
    this.busy = true;
    try {
      const result = await this.certificates.inspect(this.selectionId, this.password);
      this.password = "";
      if (result.ok === true) {
        this.draftId = result.value.draftId;
        this.inspected = result.value.identity;
      } else {
        this.showError(result.error.code);
      }
    } finally {
      this.busy = false;
    }
  }

  protected async commit(): Promise<void> {
    if (!this.draftId || !this.view || this.busy) {
      return;
    }
    this.errorKey = undefined;
    this.busy = true;
    try {
      const result = await this.certificates.commit({
        draftId: this.draftId,
        expectedRevision: this.view.revision,
        endpointUrls: this.endpoints(),
        replaceExisting: this.replaceExisting,
      });
      if (result.ok === true) {
        this.clearDraft();
        await this.refresh();
      } else {
        this.showError(result.error.code);
      }
    } finally {
      this.busy = false;
    }
  }

  protected async bind(fingerprint: string): Promise<void> {
    if (!this.view || this.busy) {
      return;
    }
    this.errorKey = undefined;
    this.busy = true;
    try {
      const result = await this.certificates.bind({
        fingerprint,
        expectedRevision: this.view.revision,
        endpointUrls: this.endpoints(),
        replaceExisting: this.replaceExisting,
      });
      if (result.ok === true) {
        await this.refresh();
      } else {
        this.showError(result.error.code);
      }
    } finally {
      this.busy = false;
    }
  }

  protected async unbind(endpoint: string): Promise<void> {
    if (!this.view || this.busy) {
      return;
    }
    this.busy = true;
    try {
      const result = await this.certificates.unbind(`https://${endpoint}`, this.view.revision);
      if (result.ok === true) {
        await this.refresh();
      } else {
        this.showError(result.error.code);
      }
    } finally {
      this.busy = false;
    }
  }

  protected async confirmRemove(): Promise<void> {
    if (!this.removeCandidate || !this.view || this.busy) {
      return;
    }
    this.busy = true;
    try {
      const result = await this.certificates.remove(this.removeCandidate, this.view.revision);
      if (result.ok === true) {
        this.removeCandidate = undefined;
        await this.refresh();
      } else {
        this.showError(result.error.code);
      }
    } finally {
      this.busy = false;
    }
  }

  protected async close(): Promise<void> {
    await this.dialogRef.close(this.view?.restartRequired ?? false);
  }

  protected async restartNow(): Promise<void> {
    if (!this.allowRestart || !this.view?.restartRequired) {
      return;
    }
    const result = await this.certificates.restart();
    if (result.ok === false) {
      this.showError(result.error.code);
    }
  }

  private endpoints(): string[] {
    return [
      ...new Set(
        this.endpointText
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
  }

  private clearDraft(): void {
    this.selectionId = undefined;
    this.draftId = undefined;
    this.inspected = undefined;
    this.fileName = undefined;
    this.password = "";
  }

  private showError(code: ClientCertificateError): void {
    const specific: Partial<Record<ClientCertificateError, string>> = {
      "invalid-password": "mtlsInvalidPassword",
      "invalid-file": "mtlsInvalidFile",
      "invalid-endpoint": "mtlsInvalidEndpoint",
      "certificate-expired": "mtlsExpired",
      "certificate-not-yet-valid": "mtlsNotYetValid",
      "identity-not-offered": "mtlsNotOffered",
      "store-location-unsupported": "mtlsStoreUnavailable",
      "store-password-unsupported": "mtlsStoreUnavailable",
      "store-corrupt": "mtlsStoreUnavailable",
      conflict: "mtlsConflict",
    };
    this.errorKey = specific[code] ?? "mtlsGeneralError";
  }
}
