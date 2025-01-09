// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { Subject, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { TableDataSource, ToastService } from "@bitwarden/components";

import { SecretListView } from "../models/view/secret-list.view";
import { SecretService } from "../secrets/secret.service";

@Component({
  selector: "sm-secrets-list",
  templateUrl: "./secrets-list.component.html",
})
export class SecretsListComponent implements OnDestroy {
  protected dataSource = new TableDataSource<SecretListView>();

  @Input()
  get secrets(): SecretListView[] {
    return this._secrets;
  }
  set secrets(secrets: SecretListView[]) {
    this.selection.clear();
    this._secrets = secrets;
    this.dataSource.data = secrets;
  }
  private _secrets: SecretListView[];

  @Input()
  set search(search: string) {
    this.selection.clear();
    this.dataSource.filter = search;
  }

  @Input() trash: boolean;

  @Output() editSecretEvent = new EventEmitter<string>();
  @Output() viewSecretEvent = new EventEmitter<string>();
  @Output() copySecretNameEvent = new EventEmitter<string>();
  @Output() copySecretValueEvent = new EventEmitter<string>();
  @Output() copySecretUuidEvent = new EventEmitter<string>();
  @Output() onSecretCheckedEvent = new EventEmitter<string[]>();
  @Output() deleteSecretsEvent = new EventEmitter<SecretListView[]>();
  @Output() newSecretEvent = new EventEmitter();
  @Output() restoreSecretsEvent = new EventEmitter();

  private destroy$: Subject<void> = new Subject<void>();

  selection = new SelectionModel<string>(true, []);

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
  ) {
    this.selection.changed
      .pipe(takeUntil(this.destroy$))
      .subscribe((_) => this.onSecretCheckedEvent.emit(this.selection.selected));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isAllSelected() {
    if (this.selection.selected?.length > 0) {
      const numSelected = this.selection.selected.length;
      const numRows = this.dataSource.filteredData.length;
      return numSelected === numRows;
    }
    return false;
  }

  toggleAll() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource.filteredData.map((s) => s.id));
    }
  }

  bulkDeleteSecrets() {
    if (this.selection.selected.length >= 1) {
      this.deleteSecretsEvent.emit(
        this.secrets.filter((secret) => this.selection.isSelected(secret.id)),
      );
    } else {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
    }
  }

  bulkRestoreSecrets() {
    if (this.selection.selected.length >= 1) {
      this.restoreSecretsEvent.emit(this.selection.selected);
    } else {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
    }
  }

  sortProjects = (a: SecretListView, b: SecretListView): number => {
    const aProjects = a.projects;
    const bProjects = b.projects;
    if (aProjects.length !== bProjects.length) {
      return aProjects.length - bProjects.length;
    }

    return aProjects[0]?.name.localeCompare(bProjects[0].name);
  };

  protected editSecret(secret: SecretListView) {
    if (secret.write) {
      this.editSecretEvent.emit(secret.id);
    } else {
      this.viewSecretEvent.emit(secret.id);
    }
  }

  /**
   * TODO: Refactor to smart component and remove
   */
  static copySecretName(
    name: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
  ) {
    platformUtilsService.copyToClipboard(name);
    platformUtilsService.showToast(
      "success",
      null,
      i18nService.t("valueCopied", i18nService.t("name")),
    );
  }

  /**
   * TODO: Refactor to smart component and remove
   */
  static async copySecretValue(
    id: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    secretService: SecretService,
    logService: LogService,
  ) {
    try {
      const value = await secretService.getBySecretId(id).then((secret) => secret.value);
      platformUtilsService.copyToClipboard(value);
      platformUtilsService.showToast(
        "success",
        null,
        i18nService.t("valueCopied", i18nService.t("value")),
      );
    } catch {
      logService.info("Error fetching secret value.");
    }
  }

  static copySecretUuid(
    id: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
  ) {
    platformUtilsService.copyToClipboard(id);
    platformUtilsService.showToast(
      "success",
      null,
      i18nService.t("valueCopied", i18nService.t("uuid")),
    );
  }

  /**
   * TODO: Remove in favor of updating `PlatformUtilsService.copyToClipboard`
   */
  private static copyToClipboardAsync(
    text: Promise<string>,
    platformUtilsService: PlatformUtilsService,
  ) {
    if (platformUtilsService.isSafari()) {
      return navigator.clipboard.write([
        new ClipboardItem({
          ["text/plain"]: text,
        }),
      ]);
    }

    return text.then((t) => platformUtilsService.copyToClipboard(t));
  }
}
