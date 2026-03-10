import { ChangeDetectionStrategy, Component, Inject, OnInit, signal } from "@angular/core";

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
  readonly loading = signal(true);
  protected readonly flatVersions = signal<SecretVersionView[]>([]);
  protected readonly visibleVersionIds = signal(new Set<string>());
  protected readonly expandedVersionIds = signal(new Set<string>());
  protected readonly currentEditorName = signal<string | null>(null);
  protected readonly hoveredVersionId = signal<string | null>(null);
  protected readonly currentValueVisible = signal(false);
  protected readonly currentValue = signal<string | null>(null);
  protected readonly revisionDate = signal<string | null>(null);

  get name() {
    return this.params.name;
  }

  get hasCurrentValue(): boolean {
    return !!this.currentValue();
  }

  get hasVersions(): boolean {
    return this.flatVersions().length > 0;
  }

  constructor(
    @Inject(DIALOG_DATA) private readonly params: SecretVersionDialogParams,
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
    private readonly logService: LogService,
    private readonly validationService: ValidationService,
    private readonly secretVersionService: SecretVersionService,
    private readonly secretService: SecretService,
    private readonly dialogService: DialogService,
    readonly dialogRef: DialogRef,
  ) {}

  protected isValueVisible(versionId: string): boolean {
    return this.visibleVersionIds().has(versionId);
  }

  protected toggleCurrentValueVisibility(): () => Promise<void> {
    return async () => {
      this.currentValueVisible.update((v) => !v);
    };
  }

  protected toggleVersionExpansion(versionId: string): void {
    if (this.expandedVersionIds().has(versionId)) {
      this.expandedVersionIds.update((s: Set<string>) => {
        const n = new Set(s);
        n.delete(versionId);
        return n;
      });
      // Hide the value when collapsing the accordion
      this.visibleVersionIds.update((s: Set<string>) => {
        const n = new Set(s);
        n.delete(versionId);
        return n;
      });
    } else {
      this.expandedVersionIds.update((s: Set<string>) => new Set([...s, versionId]));
    }
  }

  protected getToggleVisibilityAction(version: SecretVersionView): () => Promise<void> {
    return async () => {
      // If accordion is collapsed, expand it first
      if (!this.expandedVersionIds().has(version.id)) {
        this.expandedVersionIds.update((s: Set<string>) => new Set([...s, version.id]));
      }

      // Toggle visibility
      if (this.visibleVersionIds().has(version.id)) {
        this.visibleVersionIds.update((s: Set<string>) => {
          const n = new Set(s);
          n.delete(version.id);
          return n;
        });
      } else {
        this.visibleVersionIds.update((s: Set<string>) => new Set([...s, version.id]));
      }
    };
  }

  async ngOnInit() {
    this.currentValue.set(this.params.currentValue ?? null);
    this.revisionDate.set(this.params.revisionDate ?? null);
    await this.load();
  }

  private async load(refreshCurrentSecret = false) {
    this.visibleVersionIds.set(new Set());
    this.expandedVersionIds.set(new Set());
    this.currentValueVisible.set(false);

    try {
      const [secretOrNull, versions] = await Promise.all([
        refreshCurrentSecret
          ? this.secretService.getBySecretId(this.params.secretId)
          : Promise.resolve(null),
        this.secretVersionService.getSecretVersions(
          this.params.organizationId,
          this.params.secretId,
        ),
      ]);

      if (secretOrNull != null) {
        this.currentValue.set(secretOrNull.value);
        this.revisionDate.set(secretOrNull.revisionDate);
      }

      // Extract editor name from the most recent version (first in the list)
      if (versions.length > 0) {
        this.currentEditorName.set(versions[0].editorName);
      }

      this.flatVersions.set(versions);
    } catch (e) {
      this.logService.error(e);
      this.validationService.showError(e);
    }

    this.loading.set(false);
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
