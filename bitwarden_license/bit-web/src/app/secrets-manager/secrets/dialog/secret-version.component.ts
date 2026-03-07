import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnInit,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { SecretVersionView } from "../../models/view/secret-version.view";
import { SecretVersionService } from "../secret-version.service";
import { SecretService } from "../secret.service";

export interface SecretVersionDialogParams {
  organizationId: string;
  secretId: string;
  name?: string;
  currentValue?: string;
  revisionDate?: string;
}

@Component({
  templateUrl: "./secret-version.component.html",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretVersionDialogComponent implements OnInit {
  loading = true;
  protected flatVersions: SecretVersionView[] = [];
  protected visibleVersionIds = new Set<string>();
  protected expandedVersionIds = new Set<string>();
  protected currentEditorName: string | null = null;
  protected hoveredVersionId: string | null = null;
  protected currentValueVisible = false;
  protected currentValue: string | null = null;
  protected revisionDate: string | null = null;

  get name() {
    return this.params.name;
  }

  get hasCurrentValue(): boolean {
    return !!this.currentValue;
  }

  get hasVersions(): boolean {
    return this.flatVersions.length > 0;
  }

  constructor(
    @Inject(DIALOG_DATA) private params: SecretVersionDialogParams,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private logService: LogService,
    private validationService: ValidationService,
    private secretVersionService: SecretVersionService,
    private secretService: SecretService,
    private dialogService: DialogService,
    private cdr: ChangeDetectorRef,
    public dialogRef: DialogRef,
  ) {}

  protected isValueVisible(versionId: string): boolean {
    return this.visibleVersionIds.has(versionId);
  }

  protected toggleCurrentValueVisibility(): () => Promise<void> {
    return async () => {
      this.currentValueVisible = !this.currentValueVisible;
    };
  }

  protected toggleVersionExpansion(versionId: string): void {
    if (this.expandedVersionIds.has(versionId)) {
      this.expandedVersionIds.delete(versionId);
      // Hide the value when collapsing the accordion
      this.visibleVersionIds.delete(versionId);
    } else {
      this.expandedVersionIds.add(versionId);
    }
  }

  protected getToggleVisibilityAction(version: SecretVersionView): () => Promise<void> {
    return async () => {
      // If accordion is collapsed, expand it first
      if (!this.expandedVersionIds.has(version.id)) {
        this.expandedVersionIds.add(version.id);
      }

      // Toggle visibility
      if (this.visibleVersionIds.has(version.id)) {
        this.visibleVersionIds.delete(version.id);
      } else {
        this.visibleVersionIds.add(version.id);
      }
    };
  }

  async ngOnInit() {
    this.currentValue = this.params.currentValue ?? null;
    this.revisionDate = this.params.revisionDate ?? null;
    await this.load();
  }

  private async load(refreshCurrentSecret = false) {
    this.visibleVersionIds.clear();
    this.expandedVersionIds.clear();
    this.currentValueVisible = false;

    try {
      const [secretOrNull, response] = await Promise.all([
        refreshCurrentSecret
          ? this.secretService.getBySecretId(this.params.secretId)
          : Promise.resolve(null),
        this.secretVersionService.getSecretVersions(
          this.params.organizationId,
          this.params.secretId,
        ),
      ]);

      if (secretOrNull != null) {
        this.currentValue = secretOrNull.value;
        this.revisionDate = secretOrNull.revisionDate;
      }

      // Extract editor name from the most recent version (first in the list)
      if (response.versions.length > 0) {
        this.currentEditorName = response.versions[0].editorName;
      }

      this.flatVersions = response.versions;
    } catch (e) {
      this.logService.error(e);
      this.validationService.showError(e);
    }

    this.loading = false;
    this.cdr.markForCheck();
  }

  protected trackVersionById(_index: number, version: SecretVersionView): string {
    return version.id;
  }

  protected getCopyAction(value: string): () => Promise<void> {
    return async () => {
      this.platformUtilsService.copyToClipboard(value);
      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("secretValueCopied"),
      });
    };
  }

  protected getRestoreAction(version: SecretVersionView): () => Promise<void> {
    return async () => {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "restoreVersionConfirmTitle" },
        content: { key: "restoreVersionConfirmMessage" },
        acceptButtonText: { key: "restore" },
        cancelButtonText: { key: "cancel" },
        type: "warning",
      });

      if (!confirmed) {
        return;
      }

      try {
        await this.secretVersionService.restoreVersion(this.params.secretId, version.id);
        this.toastService.showToast({
          variant: "success",
          title: undefined,
          message: this.i18nService.t("secretVersionRestored"),
        });
        await this.load(true);
      } catch (e) {
        this.logService.error(e);
        this.validationService.showError(e);
      }
    };
  }
}

/**
 * Strongly typed helper to open a SecretVersionDialogComponent as a drawer
 * @param dialogService Instance of the dialog service that will be used to open the drawer
 * @param config Configuration for the drawer
 */
export const openSecretVersionDialog = (
  dialogService: DialogService,
  config: DialogConfig<SecretVersionDialogParams>,
) => {
  return dialogService.openDrawer<void, SecretVersionDialogParams>(
    SecretVersionDialogComponent,
    config,
  );
};
