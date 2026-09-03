import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Inject,
  OnInit,
  signal,
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
  canWrite?: boolean;
}

/**
 * A single row of version history. The date and the action callbacks are built once when
 * the history loads so the template binds stable references instead of allocating a new
 * Date and new closures on every change detection pass.
 */
interface SecretVersionRow {
  id: string;
  value: string;
  date: Date | null;
  author: string | null;
  copy: () => Promise<void>;
  toggleVisibility: () => Promise<void>;
  restore: () => Promise<void>;
}

@Component({
  templateUrl: "./secret-version.component.html",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretVersionDialogComponent implements OnInit {
  readonly loading = signal(true);
  protected readonly rows = signal<SecretVersionRow[]>([]);
  protected readonly visibleVersionIds = signal(new Set<string>());
  protected readonly expandedVersionIds = signal(new Set<string>());
  protected readonly currentValueVisible = signal(false);
  protected readonly currentValue = signal<string | null>(null);
  protected readonly revisionDate = signal<Date | null>(null);
  protected readonly currentValueAuthor = signal<string | null>(null);

  /** Uses a null check so a secret whose value is an empty string still renders. */
  protected readonly hasCurrentValue = computed(() => this.currentValue() != null);
  protected readonly hasVersions = computed(() => this.rows().length > 0);
  protected readonly isEmpty = computed(() => !this.hasCurrentValue() && !this.hasVersions());

  get name() {
    return this.params.name;
  }

  get canWrite(): boolean {
    return this.params.canWrite ?? true;
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

  protected readonly toggleCurrentValueVisibility = async (): Promise<void> => {
    this.currentValueVisible.update((v) => !v);
  };

  protected readonly copyCurrentValue = async (): Promise<void> => {
    await this.copyValue(this.currentValue() ?? "");
  };

  protected toggleVersionExpansion(versionId: string): void {
    if (this.expandedVersionIds().has(versionId)) {
      this.expandedVersionIds.update((s) => {
        const n = new Set(s);
        n.delete(versionId);
        return n;
      });
      // Hide the value when collapsing the accordion
      this.visibleVersionIds.update((s) => {
        const n = new Set(s);
        n.delete(versionId);
        return n;
      });
    } else {
      this.expandedVersionIds.update((s) => new Set([...s, versionId]));
    }
  }

  async ngOnInit() {
    this.currentValue.set(this.params.currentValue ?? null);
    this.revisionDate.set(this.params.revisionDate ? new Date(this.params.revisionDate) : null);
    await this.load();
  }

  private createRow(version: SecretVersionView): SecretVersionRow {
    return {
      id: version.id,
      value: version.value,
      date: version.versionDate ? new Date(version.versionDate) : null,
      author: version.authorName ?? null,
      copy: () => this.copyValue(version.value),
      toggleVisibility: async () => {
        this.visibleVersionIds.update((s) => {
          const n = new Set(s);
          if (n.has(version.id)) {
            n.delete(version.id);
          } else {
            n.add(version.id);
          }
          return n;
        });
      },
      restore: () => this.restoreVersion(version),
    };
  }

  private async load(refreshCurrentSecret = false) {
    this.visibleVersionIds.set(new Set());
    this.expandedVersionIds.set(new Set());
    this.currentValueVisible.set(false);

    try {
      const [secretOrNull, history] = await Promise.all([
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
        this.revisionDate.set(
          secretOrNull.revisionDate ? new Date(secretOrNull.revisionDate) : null,
        );
      }

      this.currentValueAuthor.set(history.currentValueAuthorName ?? null);
      this.rows.set(history.versions.map((version) => this.createRow(version)));
    } catch (e) {
      this.logService.error("Retrieving secret versions failed", e);
      this.validationService.showError(e);
    }

    this.loading.set(false);
  }

  private async copyValue(value: string): Promise<void> {
    this.platformUtilsService.copyToClipboard(value);
    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("secretValueCopied"),
    });
  }

  private async restoreVersion(version: SecretVersionView): Promise<void> {
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
      await this.secretService.restoreVersion(this.params.secretId, version.id);
      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("secretVersionRestored"),
      });
      await this.load(true);
    } catch (e) {
      this.logService.error("secret restoration failed", e);
      this.validationService.showError(e);
    }
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
