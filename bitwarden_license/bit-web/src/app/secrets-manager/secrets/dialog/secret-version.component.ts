import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  AccordionComponent,
  AccordionGroupComponent,
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
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

interface SecretVersionRow {
  id: string;
  value: string;
  date: Date | undefined;
  author: string | undefined;
  copy: () => Promise<void>;
  toggleVisibility: () => Promise<void>;
  restore: () => Promise<void>;
}

@Component({
  templateUrl: "./secret-version.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccordionComponent,
    AccordionGroupComponent,
    AsyncActionsModule,
    ButtonModule,
    CardComponent,
    CommonModule,
    DialogModule,
    FormFieldModule,
    IconButtonModule,
    IconModule,
    JslibModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class SecretVersionDialogComponent implements OnInit {
  protected readonly dateFormat = "medium";
  /** Stand-in rendered instead of the real value while a version is hidden. */
  protected readonly maskedValue = "•".repeat(16);

  protected readonly loading = signal(true);
  protected readonly rows = signal<SecretVersionRow[]>([]);
  protected readonly visibleVersionIds = signal(new Set<string>());
  protected readonly expandedVersionIds = signal(new Set<string>());
  protected readonly currentValueVisible = signal(false);
  protected readonly currentValue = signal<string | undefined>(undefined);
  protected readonly revisionDate = signal<Date | undefined>(undefined);
  protected readonly currentValueAuthor = signal<string | undefined>(undefined);

  /** Uses a undefined check so a secret whose value is an empty string still renders. */
  protected readonly hasCurrentValue = computed(() => this.currentValue() != undefined);
  protected readonly hasVersions = computed(() => this.rows().length > 0);

  private readonly params = inject<SecretVersionDialogParams>(DIALOG_DATA);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly validationService = inject(ValidationService);
  private readonly secretVersionService = inject(SecretVersionService);
  private readonly secretService = inject(SecretService);
  private readonly dialogService = inject(DialogService);
  readonly dialogRef = inject(DialogRef);

  protected get name() {
    return this.params.name;
  }

  protected get canWrite(): boolean {
    return this.params.canWrite ?? true;
  }

  protected readonly toggleCurrentValueVisibility = async (): Promise<void> => {
    this.currentValueVisible.update((v) => !v);
  };

  protected readonly copyCurrentValue = async (): Promise<void> => {
    await this.copyValue(this.currentValue() ?? "");
  };

  protected setVersionExpanded(versionId: string, expanded: boolean): void {
    if (expanded) {
      this.expandedVersionIds.update((s) => new Set([...s, versionId]));
      return;
    }

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
  }

  async ngOnInit() {
    this.currentValue.set(this.params.currentValue ?? undefined);
    this.revisionDate.set(
      this.params.revisionDate ? new Date(this.params.revisionDate) : undefined,
    );
    await this.load();
  }

  private createRow(version: SecretVersionView): SecretVersionRow {
    return {
      id: version.id,
      value: version.value,
      date: version.versionDate ? new Date(version.versionDate) : undefined,
      author: version.authorName ?? undefined,
      copy: () => this.copyValue(version.value),
      toggleVisibility: () => this.toggleVersionVisibility(version.id),
      restore: () => this.restoreVersion(version),
    };
  }

  private async load(refreshCurrentSecret = false) {
    this.visibleVersionIds.set(new Set());
    this.expandedVersionIds.set(new Set());
    this.currentValueVisible.set(false);

    try {
      const [secretOrUndefined, history] = await Promise.all([
        refreshCurrentSecret
          ? this.secretService.getBySecretId(this.params.secretId)
          : Promise.resolve(undefined),
        this.secretVersionService.getSecretVersions(
          this.params.organizationId,
          this.params.secretId,
        ),
      ]);

      if (secretOrUndefined != undefined) {
        this.currentValue.set(secretOrUndefined.value);
        this.revisionDate.set(
          secretOrUndefined.revisionDate ? new Date(secretOrUndefined.revisionDate) : undefined,
        );
      }

      this.currentValueAuthor.set(history.currentValueAuthorName ?? undefined);
      if (history.currentValueDate != undefined) {
        this.revisionDate.set(new Date(history.currentValueDate));
      }
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
      message: this.i18nService.t("secretValueCopied"),
    });
  }

  private async toggleVersionVisibility(versionId: string): Promise<void> {
    this.visibleVersionIds.update((s) => {
      const n = new Set(s);
      if (n.has(versionId)) {
        n.delete(versionId);
      } else {
        n.add(versionId);
      }
      return n;
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
